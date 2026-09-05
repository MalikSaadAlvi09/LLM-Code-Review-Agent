import { createHash } from 'crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { initializeApp } from 'firebase-admin/app';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

initializeApp();

const geminiApiKey = defineSecret('GEMINI_API_KEY');
const openRouterApiKey = defineSecret('OPENROUTER_API_KEY');
const MAX_FILES = 100;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

interface ReviewFileInput { path: string; language?: string; content?: string; storagePath?: string; }
interface ReviewRequest { projectId: string; projectName: string; sourceType?: string; scope?: string; files: ReviewFileInput[]; model: string; }
interface Finding { line?: number; severity?: string; title: string; description?: string; suggested_fix?: string; }

function requireAuth(request: any) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in before starting a review.');
  return request.auth.uid as string;
}

function safePath(value: string) {
  const normalized = String(value || '').replaceAll('\\', '/');
  if (normalized.startsWith('/') || normalized.split('/').includes('..')) throw new HttpsError('invalid-argument', 'Unsafe source path.');
  return normalized.split('/').filter(Boolean).map(segment => segment.replace(/[^a-zA-Z0-9._-]/g, '_')).join('/');
}

function parseReview(value: unknown) {
  if (typeof value === 'object' && value !== null) return value as any;
  if (typeof value !== 'string' || !value.trim()) throw new Error('The model returned an empty review.');
  const clean = value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  try { return JSON.parse(start >= 0 && end > start ? clean.slice(start, end + 1) : clean); }
  catch { throw new Error('The model returned invalid review JSON.'); }
}

function normalizeReview(value: any) {
  const findings: Finding[] = Array.isArray(value?.findings) ? value.findings : Array.isArray(value?.issues) ? value.issues : [];
  if (!value || (!Array.isArray(value.findings) && !Array.isArray(value.issues))) throw new Error('The model response has no findings array.');
  return {
    summary: typeof value.summary === 'string' ? value.summary : 'Review completed.',
    issues: findings,
    recommendations: Array.isArray(value.recommendations) ? value.recommendations : findings.map(finding => finding.suggested_fix).filter(Boolean),
    score: typeof value.score === 'number' ? value.score : typeof value.qualityScore === 'number' ? value.qualityScore : 0,
  };
}

function getSecret(secretParam: { value: () => string }, envVarName: string): string {
  try {
    const val = secretParam.value();
    if (val) return val;
  } catch {
    // Secret not bound or running in local emulator
  }
  return process.env[envVarName] || '';
}

async function reviewWithProvider(files: ReviewFileInput[], model: string) {
  const prompt = files.map(file => `File: ${file.path}\n\`\`\`\n${file.content || ''}\n\`\`\``).join('\n\n');
  const system = 'You are a senior code reviewer. Return only JSON with summary, issues, recommendations, and score. Each issue should include line, severity, title, description, and suggested_fix.';
  if (model.includes('/') || model.includes('llama') || model.includes('nemotron')) {
    const apiKey = getSecret(openRouterApiKey, 'OPENROUTER_API_KEY');
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], temperature: 0.2 }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error?.message || `OpenRouter returned HTTP ${response.status}`);
    return normalizeReview(parseReview(payload.choices?.[0]?.message?.content));
  }
  const apiKey = getSecret(geminiApiKey, 'GEMINI_API_KEY');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || `Gemini returned HTTP ${response.status}`);
  return normalizeReview(parseReview(payload.candidates?.[0]?.content?.parts?.[0]?.text));
}

export const startStructuredReview = onCall({ region: 'us-central1', timeoutSeconds: 300, memory: '1GiB', secrets: [geminiApiKey, openRouterApiKey], enforceAppCheck: false }, async request => {
  const uid = requireAuth(request);
  const data = request.data as ReviewRequest;
  if (!data?.projectId || !data?.projectName || !data?.model) throw new HttpsError('invalid-argument', 'Project, name, and model are required.');
  if (!Array.isArray(data.files) || data.files.length === 0 || data.files.length > MAX_FILES) throw new HttpsError('invalid-argument', `Provide between 1 and ${MAX_FILES} files.`);
  const files = data.files.map(file => ({ ...file, path: safePath(file.path) }));
  if (files.some(file => file.content && Buffer.byteLength(file.content, 'utf8') > MAX_FILE_BYTES)) throw new HttpsError('invalid-argument', 'A source file exceeds the 2 MB limit.');
  const db = getFirestore();
  const projectRef = db.doc(`users/${uid}/projects/${data.projectId}`);
  const project = await projectRef.get();
  if (project.exists && project.data()?.ownerUid !== uid) throw new HttpsError('permission-denied', 'You do not own this project.');
  await projectRef.set({ ownerUid: uid, name: data.projectName, sourceType: data.sourceType || 'files', status: 'reviewing', totalFiles: files.length, supportedFiles: files.length, ignoredFiles: 0, storageRoot: `users/${uid}/projects/${data.projectId}/source`, updatedAt: FieldValue.serverTimestamp(), createdAt: project.exists ? project.data()?.createdAt : FieldValue.serverTimestamp() }, { merge: true });
  for (const file of files) {
    if (!file.content && file.storagePath) {
      const [buffer] = await getStorage().bucket().file(file.storagePath).download();
      file.content = buffer.toString('utf8');
    }
    await projectRef.collection('files').doc(createHash('sha256').update(file.path).digest('hex').slice(0, 24)).set({ ownerUid: uid, projectId: data.projectId, path: file.path, name: file.path.split('/').pop(), language: file.language || 'text', size: Buffer.byteLength(file.content || '', 'utf8'), lineCount: (file.content || '').split('\n').length, storagePath: file.storagePath || `users/${uid}/projects/${data.projectId}/source/${file.path}`, selected: true, status: 'ready' });
  }
  const reviewId = `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sessionRef = projectRef.collection('reviewSessions').doc(reviewId);
  await sessionRef.set({ ownerUid: uid, projectId: data.projectId, model: data.model, scope: data.scope || 'selected-files', selectedFileIds: [], status: 'processing', reviewedFiles: 0, totalFiles: files.length, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  try {
    const review = await reviewWithProvider(files, data.model);
    const batch = db.batch();
    review.issues.forEach((finding: Finding, index: number) => batch.set(sessionRef.collection('findings').doc(`${index}-${Date.now()}`), { ownerUid: uid, filePath: files[index % files.length].path, fileId: '', severity: finding.severity || 'medium', category: 'code-review', title: finding.title, explanation: finding.description || '', recommendation: finding.suggested_fix || '', fingerprint: createHash('sha256').update(JSON.stringify(finding)).digest('hex') }));
    batch.set(sessionRef, { status: 'ready', reviewedFiles: files.length, summary: review.summary, score: review.score, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    batch.set(projectRef, { status: 'completed', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await batch.commit();
    return { success: true, sessionId: reviewId, projectId: data.projectId, reviewedFiles: files.length, review };
  } catch (error: any) {
    await sessionRef.set({ status: 'failed', error: { code: 'provider-error', message: 'The AI review could not be completed.' }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    throw new HttpsError('failed-precondition', 'The AI review could not be completed.', process.env.NODE_ENV === 'production' ? undefined : error.message);
  }
});

export const sendReviewFollowUp = onCall({ region: 'us-central1', timeoutSeconds: 120, secrets: [geminiApiKey, openRouterApiKey], enforceAppCheck: false }, async request => {
  const uid = requireAuth(request);
  const { projectId, sessionId, question, model } = request.data || {};
  if (!projectId || !sessionId || !question?.trim() || !model) throw new HttpsError('invalid-argument', 'Project, session, model, and question are required.');
  const sessionRef = getFirestore().doc(`users/${uid}/projects/${projectId}/reviewSessions/${sessionId}`);
  const session = await sessionRef.get();
  if (!session.exists || !['ready', 'partial'].includes(session.data()?.status)) throw new HttpsError('failed-precondition', 'This review session is not ready for follow-up.');
  const messageRef = sessionRef.collection('messages').doc();
  await messageRef.set({ ownerUid: uid, projectId, sessionId, role: 'user', content: question.trim(), status: 'complete', createdAt: FieldValue.serverTimestamp() });
  try {
    const answerReview = await reviewWithProvider([{ path: 'review follow-up', language: 'text', content: `Answer this question about the completed review session:\n${question.trim()}` }], model);
    const answer = answerReview.summary;
    const assistantRef = sessionRef.collection('messages').doc();
    await assistantRef.set({ ownerUid: uid, projectId, sessionId, role: 'assistant', content: answer, status: 'complete', createdAt: FieldValue.serverTimestamp() });
    return { success: true, sessionId, messageId: assistantRef.id, answer };
  } catch { throw new HttpsError('unavailable', 'The follow-up answer could not be completed.'); }
});

export const registerGitHubConnection = onCall({ region: 'us-central1', enforceAppCheck: false }, async request => {
  const uid = requireAuth(request);
  const { accessToken } = request.data || {};
  if (!accessToken) throw new HttpsError('invalid-argument', 'GitHub access token is required.');

  const ghRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'LLM-Code-Review-Agent',
      Accept: 'application/vnd.github+json',
    },
  });

  if (!ghRes.ok) throw new HttpsError('unauthenticated', 'Invalid or expired GitHub access token.');
  const ghUser = await ghRes.json();

  const db = getFirestore();
  await db.doc(`users/${uid}/connections/github`).set({
    connected: true,
    username: ghUser.login,
    avatarUrl: ghUser.avatar_url,
    githubId: ghUser.id,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return {
    success: true,
    username: ghUser.login,
    avatarUrl: ghUser.avatar_url,
  };
});
