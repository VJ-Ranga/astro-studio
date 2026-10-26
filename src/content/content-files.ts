import { constants } from 'node:fs';
import { lstat, open, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

export function isContained(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

export async function contentRoot(projectRoot: string): Promise<string | null> {
  const project = await realpath(projectRoot);
  const expected = path.join(project, 'src', 'content');
  try { await lstat(expected); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  const root = await realpath(expected);
  if (!isContained(project, root)) throw new Error('Content root resolves outside the selected project.');
  if (!(await stat(root)).isDirectory()) throw new Error('src/content must be a directory.');
  return root;
}

export async function resolveContentFile(projectRoot: string, relative: string): Promise<string> {
  if (path.isAbsolute(relative) || relative.includes('\\') || !/\.(md|mdx)$/i.test(relative)) throw new Error('Invalid local content path.');
  const root = await contentRoot(projectRoot);
  if (!root) throw new Error('The content directory no longer exists. Refresh content.');
  const candidate = path.resolve(root, relative);
  if (!isContained(root, candidate)) throw new Error('Content path resolves outside the authorized content root.');
  const canonical = await realpath(candidate);
  if (!isContained(root, canonical)) throw new Error('Content symlink resolves outside the authorized content root.');
  if (!(await stat(canonical)).isFile()) throw new Error('Content entry is not a regular file. Directory symlinks and special files are skipped.');
  return canonical;
}

export async function readContentFile(filePath: string): Promise<string> {
  const file = await open(filePath, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
  try {
    const info = await file.stat();
    if (!info.isFile()) throw new Error('Content entry is not a regular file.');
    const limit = 1_048_576;
    if (info.size > limit) throw new Error('File exceeds the 1 MiB inspection limit. Open source to review it.');
    const buffer = Buffer.alloc(limit + 1);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    if (bytesRead > limit) throw new Error('File exceeds the 1 MiB inspection limit.');
    return buffer.subarray(0, bytesRead).toString('utf8');
  } finally { await file.close(); }
}
