import { open, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { Diagnostic, PackageManager, ProjectDiscovery } from './project-types';

const lockfiles: Record<string, PackageManager> = {
  'package-lock.json': 'npm', 'npm-shrinkwrap.json': 'npm',
  'pnpm-lock.yaml': 'pnpm', 'yarn.lock': 'yarn', 'bun.lock': 'bun', 'bun.lockb': 'bun',
};
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;

export async function discoverProject(rootPath: string): Promise<ProjectDiscovery> {
  const invalid = (message: string): ProjectDiscovery => ({
    kind: 'invalid', rootPath, diagnostics: [{ severity: 'error', message }],
  });
  let source: string;
  try {
    const file = await open(path.join(rootPath, 'package.json'), 'r');
    try {
      const limit = 1_048_576;
      const metadata = await file.stat();
      if (!metadata.isFile()) return invalid('package.json must be a regular file.');
      // Read at most one byte beyond the limit, even if a file grows after stat.
      const buffer = Buffer.alloc(limit + 1);
      const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
      if (bytesRead > limit || metadata.size > limit) return invalid('package.json exceeds the 1 MiB discovery limit.');
      source = buffer.subarray(0, bytesRead).toString('utf8');
    } finally {
      await file.close();
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return invalid(code === 'ENOENT'
      ? 'No package.json found. Select an existing Astro project root.'
      : 'Cannot read package.json. Check the selected root and file permissions.');
  }

  let metadata: unknown;
  try { metadata = JSON.parse(source); }
  catch { return invalid('package.json is not valid JSON. Fix it and refresh discovery.'); }
  if (!isObject(metadata)) return invalid('package.json must contain a JSON object.');
  for (const field of ['dependencies', 'devDependencies', 'scripts']) {
    if (metadata[field] !== undefined && !isObject(metadata[field])) {
      return invalid(`package.json ${field} must be an object. Fix it and refresh discovery.`);
    }
  }
  const dependencies = metadata.dependencies as Record<string, unknown> | undefined;
  const devDependencies = metadata.devDependencies as Record<string, unknown> | undefined;
  const astroVersion = text(dependencies?.astro) ?? text(devDependencies?.astro);
  if (!astroVersion) return {
    kind: 'not-astro', rootPath,
    diagnostics: [{ severity: 'warning', message: 'Astro is not declared in dependencies or devDependencies. Select an Astro project.' }],
  };

  const diagnostics: Diagnostic[] = [];
  const scripts = metadata.scripts as Record<string, unknown> | undefined;
  const devScript = text(scripts?.dev);
  if (!devScript) diagnostics.push({ severity: 'warning', message: 'No nonempty scripts.dev found. Add a dev script before starting preview.' });
  let packageManager: PackageManager | null = null;
  let packageManagerSource: 'declaration' | 'lockfile' | 'fallback' | 'unresolved' = 'unresolved';
  if (metadata.packageManager !== undefined) {
    const declaration = typeof metadata.packageManager === 'string'
      ? /^(npm|pnpm|yarn|bun)@\d+\.\d+\.\d+(?:[-+][\w.+-]+)?$/.exec(metadata.packageManager)
      : null;
    if (declaration) {
      packageManager = declaration[1] as PackageManager;
      packageManagerSource = 'declaration';
    } else diagnostics.push({ severity: 'error', message: 'Unsupported packageManager declaration. Use npm, pnpm, yarn, or bun with an exact version (for example pnpm@10.0.0).' });
  } else {
    try {
      const entries = await readdir(rootPath);
      const managers = [...new Set(entries.flatMap(name => Object.hasOwn(lockfiles, name) ? [lockfiles[name]!] : []))];
      if (managers.length > 1) {
        diagnostics.push({ severity: 'error', message: 'Multiple package managers have lockfiles. Set packageManager explicitly or remove stale lockfiles.' });
      } else {
        packageManager = managers[0] ?? 'npm';
        packageManagerSource = managers.length ? 'lockfile' : 'fallback';
        if (!managers.length) diagnostics.push({ severity: 'info', message: 'No packageManager or lockfile found. npm is the fallback; declare packageManager to choose explicitly.' });
      }
    } catch {
      diagnostics.push({ severity: 'error', message: 'Cannot inspect root lockfiles. Check directory permissions and refresh.' });
    }
  }
  return {
    kind: 'astro', rootPath, diagnostics,
    name: text(metadata.name) ?? path.basename(rootPath), astroVersion,
    packageManager, packageManagerSource, devScript,
  };
}
