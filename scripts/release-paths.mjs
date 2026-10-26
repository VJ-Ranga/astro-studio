import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
export const artifact = path.join(root, 'artifacts', `astro-studio-${manifest.version}-linux-x64.vsix`);
