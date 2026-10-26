import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverProject } from '../../src/workspace/discover-project';

const roots: string[] = [];
async function fixture(metadata: unknown, files: Record<string, string> = {}): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'astro studio discovery '));
  roots.push(root);
  if (metadata !== undefined) await writeFile(path.join(root, 'package.json'), JSON.stringify(metadata));
  for (const [name, content] of Object.entries(files)) await writeFile(path.join(root, name), content);
  return root;
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

describe('read-only project discovery', () => {
  it.each(['dependencies', 'devDependencies'])('recognizes Astro in %s without evaluating config', async field => {
    const root = await fixture({ name: 'demo', [field]: { astro: '^7.4.2' }, scripts: { dev: 'astro dev' } }, {
      'astro.config.mjs': 'throw new Error("Configuration must never execute");',
    });
    expect(await discoverProject(root)).toMatchObject({
      kind: 'astro', rootPath: root, name: 'demo', astroVersion: '^7.4.2',
      devScript: 'astro dev', packageManager: 'npm', packageManagerSource: 'fallback',
    });
  });

  it('distinguishes valid non-Astro metadata', async () => {
    expect(await discoverProject(await fixture({ name: 'other' }))).toMatchObject({ kind: 'not-astro' });
  });

  it.each([undefined, null, [], 'wrong', { dependencies: [] }, { scripts: false }])('rejects missing or invalid metadata %j', async metadata => {
    const result = await discoverProject(await fixture(metadata));
    expect(result.kind).toBe('invalid');
    expect(result.diagnostics[0]?.severity).toBe('error');
  });

  it('reports malformed JSON', async () => {
    const root = await fixture(undefined, { 'package.json': '{broken' });
    const result = await discoverProject(root);
    expect(result.kind).toBe('invalid');
    expect(result.diagnostics[0]?.message).toContain('valid JSON');
  });

  it('reports a missing dev script and unresolved manager instead of choosing among lockfiles', async () => {
    const result = await discoverProject(await fixture({ dependencies: { astro: '*' } }, {
      'yarn.lock': '', 'package-lock.json': '',
    }));
    expect(result).toMatchObject({ kind: 'astro', devScript: null, packageManager: null, packageManagerSource: 'unresolved' });
    expect(result.diagnostics.map(item => item.message).join(' ')).toMatch(/scripts.dev/);
    expect(result.diagnostics.map(item => item.message).join(' ')).toMatch(/Multiple package managers/);
  });

  it('prefers an explicit supported declaration over lockfiles', async () => {
    const result = await discoverProject(await fixture({
      dependencies: { astro: '*' }, packageManager: 'pnpm@10.0.0+sha512.123', scripts: { dev: 'astro dev' },
    }, { 'package-lock.json': '', 'yarn.lock': '' }));
    expect(result).toMatchObject({ kind: 'astro', packageManager: 'pnpm', packageManagerSource: 'declaration' });
  });

  it.each(['npm', 'bun', 'other@1.0.0', 42])('does not silently fall back from invalid declaration %j', async packageManager => {
    const result = await discoverProject(await fixture({ dependencies: { astro: '*' }, packageManager }));
    expect(result).toMatchObject({ kind: 'astro', packageManager: null, packageManagerSource: 'unresolved' });
  });

  it.each([
    ['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'], ['bun.lockb', 'bun'], ['npm-shrinkwrap.json', 'npm'],
  ])('infers manager from %s', async (lockfile, manager) => {
    expect(await discoverProject(await fixture({ dependencies: { astro: '*' } }, { [lockfile]: '' })))
      .toMatchObject({ kind: 'astro', packageManager: manager, packageManagerSource: 'lockfile' });
  });

  it('treats multiple npm lockfiles as one manager', async () => {
    expect(await discoverProject(await fixture({ dependencies: { astro: '*' } }, {
      'package-lock.json': '', 'npm-shrinkwrap.json': '',
    }))).toMatchObject({ kind: 'astro', packageManager: 'npm' });
  });

  it('rejects oversized metadata', async () => {
    const result = await discoverProject(await fixture(undefined, { 'package.json': ' '.repeat(1_048_577) }));
    expect(result.kind).toBe('invalid');
    expect(result.diagnostics[0]?.message).toContain('1 MiB');
  });
});
