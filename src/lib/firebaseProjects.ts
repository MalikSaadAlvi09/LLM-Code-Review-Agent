import { doc, setDoc, storage, ref, uploadBytesResumable, getDownloadURL, db } from './firebase';
import { ImportedProject } from '../types';

function cleanRecord<T extends Record<string, unknown>>(record: T): Partial<T> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function safePath(path: string) {
  return path.replaceAll('\\', '/').split('/').filter(segment => segment && segment !== '.' && segment !== '..').map(segment => segment.replace(/[^a-zA-Z0-9._-]/g, '_')).join('/');
}

export async function persistImportedProject(uid: string, project: ImportedProject, onProgress?: (completed: number, total: number) => void) {
  const projectPath = `users/${uid}/projects/${project.id}`;
  const projectRef = doc(db, projectPath);
  const readyFiles = project.files.filter(file => file.status === 'ready');
  await setDoc(projectRef, cleanRecord({
    ownerUid: uid,
    name: project.name,
    sourceType: project.sourceType,
    status: 'processing',
    storageRoot: `${projectPath}/source`,
    totalFiles: project.files.length,
    supportedFiles: readyFiles.length,
    ignoredFiles: project.files.length - readyFiles.length,
    totalBytes: project.files.reduce((total, file) => total + file.size, 0),
    totalLines: readyFiles.reduce((total, file) => total + file.content.split('\n').length, 0),
    repository: project.repository,
    createdAt: project.createdAt,
    updatedAt: new Date().toISOString(),
  }), { merge: true });

  let completed = 0;
  for (const file of project.files) {
    const fileRef = doc(db, `${projectPath}/files/${file.id}`);
    const metadata = cleanRecord({
      ownerUid: uid,
      projectId: project.id,
      path: file.path,
      name: file.name,
      extension: file.extension,
      language: file.language,
      size: file.size,
      lineCount: file.status === 'ready' ? file.content.split('\n').length : 0,
      selected: file.selected,
      status: file.status,
      ignoredReason: file.reason,
    });
    if (file.status === 'ready') {
      const storagePath = `${projectPath}/source/${safePath(file.path)}`;
      const upload = uploadBytesResumable(ref(storage, storagePath), new Blob([file.content], { type: 'text/plain' }));
      await new Promise<void>((resolve, reject) => {
        upload.on('state_changed', undefined, reject, resolve);
      });
      await setDoc(fileRef, cleanRecord({ ...metadata, storagePath, contentHash: `${file.size}-${file.content.length}` }), { merge: true });
    } else {
      await setDoc(fileRef, metadata, { merge: true });
    }
    completed += 1;
    onProgress?.(completed, project.files.length);
  }
  await setDoc(projectRef, { status: 'ready', updatedAt: new Date().toISOString() }, { merge: true });
  return project.id;
}

export async function downloadProjectFile(storagePath: string) {
  return getDownloadURL(ref(storage, storagePath));
}
