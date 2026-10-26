import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { artifact, root } from './release-paths.mjs';

await mkdir(path.dirname(artifact), { recursive: true });
execFileSync(process.execPath, [path.join(root, 'node_modules/@vscode/vsce/vsce'), 'package', '--no-dependencies', '--target', 'linux-x64', '--githubBranch', 'main', '--skip-license', '--out', artifact], { cwd: root, stdio: 'inherit', timeout: 120_000 });
