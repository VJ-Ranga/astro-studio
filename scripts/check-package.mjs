import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { artifact, manifest, root } from './release-paths.mjs';

const files = execFileSync('unzip', ['-Z1', artifact], { encoding: 'utf8' }).trim().split('\n').filter(file => !file.endsWith('/')).sort();
const expected = [...manifest.files.map(file => `extension/${file === 'README.md' ? 'readme.md' : file === 'CHANGELOG.md' ? 'changelog.md' : file}`), '[Content_Types].xml', 'extension.vsixmanifest'].sort();
assert.deepEqual(files, expected, 'The VSIX must contain only the explicit release allowlist');
const packaged = JSON.parse(execFileSync('unzip', ['-p', artifact, 'extension/package.json'], { encoding: 'utf8' }));
assert.equal(packaged.version, manifest.version);
assert.equal(packaged.main, './dist/extension.cjs');
assert.equal(packaged.engines.vscode, manifest.engines.vscode);
for (const file of manifest.files.filter(file => !['package.json', 'README.md', 'CHANGELOG.md'].includes(file))) {
  assert.deepEqual(execFileSync('unzip', ['-p', artifact, `extension/${file}`]), await readFile(path.join(root, file)), `Packaged ${file} must match the verified source/build output`);
}
const data = await readFile(artifact);
const sha256 = createHash('sha256').update(data).digest('hex');
await writeFile(artifact + '.sha256', `${sha256}  ${path.basename(artifact)}\n`);
await writeFile(path.join(path.dirname(artifact), 'package-report.json'), JSON.stringify({ version: manifest.version, artifact: path.basename(artifact), bytes: data.length, sha256, files }, null, 2) + '\n');
console.log(`PASS: VSIX allowlist (${files.length} files), version ${manifest.version}, ${data.length} bytes, SHA-256 ${sha256}`);
