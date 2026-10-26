import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { listEntries } from '../../src/content/list-entries';
import { execFileSync } from 'node:child_process';

const roots: string[] = [];
async function fixture(files: Record<string, string> = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'astro content space '));
  roots.push(root);
  for (const [name, source] of Object.entries(files)) {
    const file = path.join(root, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, source);
  }
  return root;
}
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
const markdown = '---\r\ntitle: Hello 世界\r\ndraft: false\r\n---\r\n# Original body\r\n';

it('lists nested Markdown/MDX and retains original bytes', async () => {
  const root = await fixture({
    'src/content/posts/hello.md': markdown,
    'src/content/components.mdx': '---\ntitle: Components\n---\n<Widget />',
    'src/content/body.md': '# No metadata',
    'src/content/ignored.txt': 'not content',
  });
  const scan = await listEntries(root);
  expect(scan.entries.map(entry => entry.path)).toEqual(['body.md', 'components.mdx', 'posts/hello.md']);
  expect(scan.entries.find(entry => entry.path === 'posts/hello.md')).toMatchObject({ mode: 'supported', fields: { title: 'Hello 世界', draft: false } });
  expect(scan.entries.find(entry => entry.path === 'components.mdx')?.mode).toBe('source-only');
  expect(await readFile(path.join(root, 'src/content/posts/hello.md'), 'utf8')).toBe(markdown);
  expect(scan.files.size).toBe(3);
});

it('uses an empty state for a missing content directory', async () => {
  const scan = await listEntries(await fixture());
  expect(scan.entries).toEqual([]);
  expect(scan.diagnostics).toEqual([]);
});

it('rejects escaping files and directory symlinks without reading outside content', async () => {
  const root = await fixture({ 'src/content/inside.md': markdown, 'outside/secret.md': '---\ntitle: SECRET\n---\n' });
  await symlink(path.join(root, 'outside/secret.md'), path.join(root, 'src/content/escape.md'));
  await symlink(path.join(root, 'outside'), path.join(root, 'src/content/loop'));
  const scan = await listEntries(root);
  expect(scan.entries.map(entry => entry.path)).toEqual(['inside.md']);
  expect(scan.diagnostics.join(' ')).toContain('escape.md');
  expect(scan.diagnostics.join(' ')).not.toContain('SECRET');
});

it('permits contained file symlinks and creates project-specific IDs', async () => {
  const root = await fixture({ 'src/content/inside.md': markdown });
  await symlink(path.join(root, 'src/content/inside.md'), path.join(root, 'src/content/alias.md'));
  const scan = await listEntries(root);
  expect(scan.entries).toHaveLength(2);
  const other = await listEntries(await fixture({ 'src/content/inside.md': markdown }));
  expect(scan.entries.find(entry => entry.path === 'inside.md')?.id).not.toBe(other.entries[0]?.id);
});

it('rejects a content-root symlink outside the project', async () => {
  const root = await fixture({ 'src/keep.txt': '' });
  const outside = await fixture({ 'secret.md': markdown });
  await symlink(outside, path.join(root, 'src/content'));
  const scan = await listEntries(root);
  expect(scan.entries).toEqual([]);
  expect(scan.diagnostics.join(' ')).toContain('outside');
});

it('reports oversized files as source-only without reading their body', async () => {
  const scan = await listEntries(await fixture({ 'src/content/large.md': 'a'.repeat(1_048_577) }));
  expect(scan.entries[0]?.mode).toBe('source-only');
  expect(scan.entries[0]?.diagnostics.join(' ')).toContain('1 MiB');
});

it('caps the number of entries and reports truncation', async () => {
  const files = Object.fromEntries(Array.from({ length: 201 }, (_, index) => [`src/content/${index.toString().padStart(3, '0')}.md`, markdown]));
  const scan = await listEntries(await fixture(files));
  expect(scan.entries).toHaveLength(200);
  expect(scan.diagnostics.join(' ')).toContain('200');
});

it('skips FIFOs rather than waiting for a writer', async () => {
  const root = await fixture({ 'src/content/keep.md': markdown });
  execFileSync('mkfifo', [path.join(root, 'src/content/pipe.md')]);
  const scan = await listEntries(root);
  expect(scan.entries.map(entry => entry.path)).toEqual(['keep.md']);
  expect(scan.diagnostics.join(' ')).toContain('special file');
});

it('bounds directory depth and reports the skipped subtree', async () => {
  const nested = 'src/content/' + Array.from({ length: 13 }, (_, index) => `d${index}`).join('/') + '/deep.md';
  const scan = await listEntries(await fixture({ [nested]: markdown }));
  expect(scan.entries).toEqual([]);
  expect(scan.diagnostics.join(' ')).toContain('depth exceeds 12');
});
