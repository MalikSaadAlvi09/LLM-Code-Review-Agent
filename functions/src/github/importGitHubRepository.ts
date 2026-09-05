import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { createHash, randomUUID } from 'crypto';

export interface ParsedGitHubUrl {
  owner: string;
  repository: string;
  branch?: string;
}

export function parseGitHubUrl(githubUrl: string): ParsedGitHubUrl {
  const trimmed = (githubUrl || '').trim();
  if (!trimmed) {
    throw new HttpsError('invalid-argument', 'Enter a valid GitHub repository URL.');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new HttpsError('invalid-argument', 'Enter a valid GitHub repository URL.');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new HttpsError('invalid-argument', 'Enter a valid HTTP or HTTPS GitHub repository URL.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== 'github.com' && hostname !== 'www.github.com') {
    throw new HttpsError('invalid-argument', 'Enter a github.com repository URL.');
  }

  if (parsed.username || parsed.password) {
    throw new HttpsError('invalid-argument', 'URLs containing embedded credentials are rejected.');
  }

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length < 2) {
    throw new HttpsError('invalid-argument', 'Use https://github.com/owner/repository.');
  }

  const owner = segments[0];
  const repository = segments[1].replace(/\.git$/i, '');

  if (!owner || !repository) {
    throw new HttpsError('invalid-argument', 'Missing owner or repository in URL.');
  }

  if (/[\s\\<>|"`']/.test(owner) || /[\s\\<>|"`']/.test(repository)) {
    throw new HttpsError('invalid-argument', 'Malformed or unsafe path values in URL.');
  }

  let branch: string | undefined = undefined;
  if (segments[2] === 'tree' && segments.length >= 4) {
    branch = segments.slice(3).join('/');
  }

  return { owner, repository, branch };
}

const ALLOWED_EXTENSIONS = /\.(py|js|jsx|ts|tsx|java|c|h|cc|cpp|hpp|cs|go|rs|php|rb|swift|kt|dart|html|css|scss|sql|sh|bash|ps1|json|ya?ml|xml|md|toml|tf)$/i;
const IGNORED_PATHS = /(^|\/)(\.git|\.github|node_modules|vendor|dist|build|coverage|\.next|\.nuxt|\.cache|venv|\.venv|env|__pycache__|\.pytest_cache|\.mypy_cache|\.idea|\.vscode|target|bin|obj|Pods|DerivedData)(\/|$)|\.min\.js$|\.map$|\.lock$|\.log$|\.pyc$|\.class$/i;

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  '.py': 'python', '.js': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
  '.java': 'java', '.c': 'c', '.h': 'c', '.cc': 'cpp', '.cpp': 'cpp', '.hpp': 'cpp', '.cs': 'csharp',
  '.go': 'go', '.rs': 'rust', '.php': 'php', '.rb': 'ruby', '.swift': 'swift', '.kt': 'kotlin', '.dart': 'dart',
  '.html': 'html', '.css': 'css', '.scss': 'scss', '.sql': 'sql', '.sh': 'shell', '.bash': 'shell', '.ps1': 'powershell',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.xml': 'xml', '.md': 'markdown', '.toml': 'toml', '.tf': 'terraform',
};

export const importGitHubRepository = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 300,
    memory: '1GiB',
    enforceAppCheck: false,
  },
  async (request) => {
    // 1. Auth check
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'Sign in before importing a repository.');
    }
    const uid = request.auth.uid;

    const { repositoryUrl, branch: customBranch } = request.data || {};
    if (!repositoryUrl || typeof repositoryUrl !== 'string') {
      throw new HttpsError('invalid-argument', 'Enter a valid GitHub repository URL.');
    }

    // 2. Parse URL
    const { owner, repository, branch: urlBranch } = parseGitHubUrl(repositoryUrl);

    // 3. Obtain user's GitHub connection & token if available
    const db = getFirestore();
    let githubAccessToken: string | null = null;
    let hasConnection = false;

    // Check safe connection metadata
    const connSnap = await db.doc(`users/${uid}/connections/github`).get();
    const altConnSnap = await db.doc(`users/${uid}/githubConnections/primary`).get();
    hasConnection = (connSnap.exists && connSnap.data()?.connected) || (altConnSnap.exists && altConnSnap.data()?.status === 'connected');

    // Check secret token
    const secretSnap = await db.doc(`users/${uid}/secretConnections/github`).get();
    const secretData = secretSnap.data();
    if (secretSnap.exists && secretData?.accessToken) {
      githubAccessToken = secretData.accessToken;
      hasConnection = true;
    }

    // Prepare headers for GitHub API
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'llm-code-review-agent',
    };
    if (githubAccessToken) {
      headers.Authorization = `Bearer ${githubAccessToken}`;
    }

    // 4. Request Metadata
    const repoApiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
    const metadataRes = await fetch(repoApiUrl, { headers });
    const githubApiStatus = metadataRes.status;
    const githubRequestId = metadataRes.headers ? (metadataRes.headers.get('x-github-request-id') || undefined) : undefined;

    if (!metadataRes.ok) {
      console.error('GitHub import failed diagnostic', {
        requestedUrl: repositoryUrl,
        requestType: 'GET_METADATA',
        status: metadataRes.status,
        responseContentType: metadataRes.headers.get('content-type'),
        firebaseFunctionName: 'importGitHubRepository',
        firebaseRegion: 'us-central1',
        githubOwner: owner,
        githubRepository: repository,
        githubApiStatus,
        githubRequestId,
      });

      if (githubApiStatus === 404) {
        if (!hasConnection) {
          throw new HttpsError(
            'permission-denied',
            'Repository not found or it is private. Connect the GitHub account that has access to this repository and try again.'
          );
        } else {
          throw new HttpsError(
            'permission-denied',
            'Your connected GitHub account does not have access to this repository. Check repository permissions or organization SSO.'
          );
        }
      }

      if (githubApiStatus === 401) {
        throw new HttpsError('unauthenticated', 'Your GitHub authorization has expired. Reconnect GitHub.');
      }

      if (githubApiStatus === 403) {
        const ratelimitRemaining = metadataRes.headers.get('x-ratelimit-remaining');
        if (ratelimitRemaining === '0') {
          throw new HttpsError('resource-exhausted', 'GitHub API rate limit reached. Connect GitHub or try again later.');
        }
        throw new HttpsError(
          'permission-denied',
          'Your connected GitHub account does not have access to this repository. Check repository permissions or organization SSO.'
        );
      }

      const metaErrorJson = await metadataRes.json().catch(() => ({}));
      throw new HttpsError('invalid-argument', metaErrorJson.message || 'Repository not found. Check the owner and repository name.');
    }

    const metadata = await metadataRes.json();
    const targetBranch = customBranch || urlBranch || metadata.default_branch || 'main';

    // 5. Fetch Repository Tree
    const treeApiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/git/trees/${encodeURIComponent(targetBranch)}?recursive=1`;
    const treeRes = await fetch(treeApiUrl, { headers });

    if (!treeRes.ok) {
      console.error('GitHub tree fetch failed diagnostic', {
        requestedUrl: repositoryUrl,
        requestType: 'GET_TREE',
        status: treeRes.status,
        firebaseFunctionName: 'importGitHubRepository',
        firebaseRegion: 'us-central1',
        githubOwner: owner,
        githubRepository: repository,
        githubApiStatus: treeRes.status,
      });
      if (treeRes.status === 404) {
        throw new HttpsError('not-found', `Branch '${targetBranch}' was not found in the repository.`);
      }
      throw new HttpsError('invalid-argument', `Could not load repository tree for branch '${targetBranch}'.`);
    }

    const treeData = await treeRes.json();
    if (treeData.truncated) {
      throw new HttpsError(
        'resource-exhausted',
        'The repository tree is too large and was truncated by GitHub API. Please import specific subdirectories or a ZIP archive.'
      );
    }

    const candidates = (treeData.tree || []).filter(
      (entry: any) => entry.type === 'blob' && typeof entry.path === 'string'
    );

    const filteredEntries = candidates
      .filter((entry: any) => ALLOWED_EXTENSIONS.test(entry.path) && !IGNORED_PATHS.test(entry.path))
      .slice(0, 100);

    if (filteredEntries.length === 0) {
      throw new HttpsError('invalid-argument', 'No supported source code files found in this repository.');
    }

    // 6. Download source files & upload to Storage / save to Firestore
    const projectId = `proj-gh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const storageBucket = getStorage().bucket();

    const downloadedFiles: any[] = [];
    for (const entry of filteredEntries) {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repository}/${encodeURIComponent(targetBranch)}/${entry.path.split('/').map(encodeURIComponent).join('/')}`;
      const rawHeaders: Record<string, string> = { Accept: 'text/plain' };
      if (githubAccessToken) {
        rawHeaders.Authorization = `Bearer ${githubAccessToken}`;
      }

      let content = '';
      const rawRes = await fetch(rawUrl, { headers: rawHeaders });
      if (rawRes.ok) {
        content = await rawRes.text();
      } else {
        const contentsRes = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/contents/${entry.path}?ref=${encodeURIComponent(targetBranch)}`,
          { headers }
        );
        if (contentsRes.ok) {
          const contentsData = await contentsRes.json();
          if (contentsData.content && contentsData.encoding === 'base64') {
            content = Buffer.from(contentsData.content, 'base64').toString('utf8');
          }
        }
      }

      if (!content || content.includes('\0') || Buffer.byteLength(content, 'utf8') > 2 * 1024 * 1024) {
        continue;
      }

      const fileId = randomUUID();
      const dotIndex = entry.path.lastIndexOf('.');
      const ext = dotIndex >= 0 ? entry.path.slice(dotIndex).toLowerCase() : '';
      const language = LANGUAGE_BY_EXTENSION[ext] || (entry.path.toLowerCase().includes('dockerfile') ? 'dockerfile' : 'text');
      const storagePath = `users/${uid}/projects/${projectId}/source/${entry.path}`;

      try {
        await storageBucket.file(storagePath).save(content, {
          contentType: 'text/plain; charset=utf-8',
        });
      } catch (err) {
        console.warn(`Storage upload note for ${entry.path}:`, err);
      }

      downloadedFiles.push({
        id: fileId,
        path: entry.path,
        name: entry.path.split('/').pop() || entry.path,
        extension: ext,
        language,
        size: Buffer.byteLength(content, 'utf8'),
        content,
        storagePath,
        selected: true,
        status: 'ready',
      });
    }

    if (downloadedFiles.length === 0) {
      throw new HttpsError('invalid-argument', 'Could not read any supported source files from this repository.');
    }

    // 7. Save metadata in Firestore
    const projectRef = db.doc(`users/${uid}/projects/${projectId}`);
    await projectRef.set({
      id: projectId,
      ownerUid: uid,
      name: repository,
      sourceType: 'github',
      repository: {
        owner,
        name: repository,
        url: `https://github.com/${owner}/${repository}`,
        branch: targetBranch,
        commitSha: treeData.sha || null,
        isPrivate: Boolean(metadata.private),
      },
      status: 'ready',
      totalFiles: downloadedFiles.length,
      storageRoot: `users/${uid}/projects/${projectId}/source`,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const filesCol = projectRef.collection('files');
    const batch = db.batch();
    for (const file of downloadedFiles) {
      const fileDocRef = filesCol.doc(createHash('sha256').update(file.path).digest('hex').slice(0, 24));
      batch.set(fileDocRef, {
        id: file.id,
        ownerUid: uid,
        projectId,
        path: file.path,
        name: file.name,
        extension: file.extension,
        language: file.language,
        size: file.size,
        storagePath: file.storagePath,
        selected: true,
        status: 'ready',
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();

    return {
      success: true,
      projectId,
      repository: {
        owner,
        name: repository,
        url: `https://github.com/${owner}/${repository}`,
        branch: targetBranch,
        commitSha: treeData.sha || null,
        isPrivate: Boolean(metadata.private),
      },
      files: downloadedFiles,
      message: 'Repository imported successfully.',
    };
  }
);
