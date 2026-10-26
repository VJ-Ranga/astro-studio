import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { discoverProject } from '../../src/workspace/discover-project';
import { DevServerController } from '../../src/preview/dev-server';

const roots: string[] = [];
const servers: DevServerController[] = [];
const controller = (timeout = 5_000) => {
  const server = new DevServerController({ startupTimeoutMs: timeout });
  servers.push(server);
  return server;
};
async function fixture(script: string) {
  const root = await mkdtemp(path.join(tmpdir(), 'astro preview space '));
  roots.push(root);
  await writeFile(path.join(root, 'package.json'), JSON.stringify({
    dependencies: { astro: '*' }, packageManager: 'npm@10.9.8', scripts: { dev: 'node server.cjs' },
  }));
  await writeFile(path.join(root, 'server.cjs'), script);
  return { root, project: await discoverProject(root) };
}
afterEach(async () => {
  vi.unstubAllEnvs();
  // Regressions intentionally create workers that can outlive the Day 3 controller.
  for (const root of roots) {
    try {
      const { pid } = JSON.parse(await readFile(path.join(root, 'worker.json'), 'utf8')) as { pid: number };
      try { process.kill(pid, 'SIGKILL'); } catch { /* The owned fixture worker already exited. */ }
    } catch { /* This fixture did not create a worker. */ }
  }
  await Promise.all(servers.splice(0).map(server => server.stop()));
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

async function stubbornFixture(leaderExits = false) {
  const { root, project } = await fixture(`
const fs = require('node:fs');
const child = require('node:child_process').spawn(process.execPath, ['worker.cjs'], { stdio: ${leaderExits ? "'inherit'" : "'ignore'"} });
const ready = setInterval(() => {
  if (!fs.existsSync('worker.json')) return;
  clearInterval(ready);
  const worker = JSON.parse(fs.readFileSync('worker.json', 'utf8'));
  console.log('Local ' + worker.url);
  ${leaderExits ? 'setTimeout(() => process.exit(9), 50);' : "process.on('SIGTERM', () => process.exit(0)); setInterval(() => {}, 1000);"}
}, 10);
`);
  await writeFile(path.join(root, 'worker.cjs'), `
const http = require('node:http');
process.on('SIGTERM', () => {});
const server = http.createServer((request, response) => response.end('stubborn owned worker'));
server.listen(0, '127.0.0.1', () => {
  require('node:fs').writeFileSync('worker.json', JSON.stringify({ pid: process.pid, url: 'http://127.0.0.1:' + server.address().port + '/' }));
});
`);
  return { root, project };
}

it('stops stubborn descendants even after their leader closes redirected output', async () => {
  const { project } = await stubbornFixture();
  const server = controller();
  const ready = await server.start(project, true);
  expect(ready.status).toBe('running');
  expect((await server.stop()).status).toBe('stopped');
  await expect(fetch(ready.url!, { signal: AbortSignal.timeout(500) })).rejects.toThrow();
}, 15_000);

it('cleans up after a leader exits while its stubborn worker holds pipes open', async () => {
  const { project } = await stubbornFixture(true);
  const server = controller();
  const ready = await server.start(project, true);
  expect(ready.status).toBe('running');
  await vi.waitFor(() => expect(server.snapshot.status).toBe('failed'), { timeout: 5_000 });
  await server.stop();
  await expect(fetch(ready.url!, { signal: AbortSignal.timeout(500) })).rejects.toThrow();
}, 15_000);

it('exposes stopping immediately and blocks starts until cleanup completes', async () => {
  const { project } = await stubbornFixture();
  const server = controller();
  await server.start(project, true);
  const stopping = server.stop();
  expect(server.snapshot.status).toBe('stopping');
  expect(server.snapshot.url).toBeNull();
  expect((await server.start(project, true)).status).toBe('stopping');
  await stopping;
}, 15_000);

it('awaits idempotent disposal and refuses further starts', async () => {
  const { project } = await stubbornFixture();
  const server = controller();
  const ready = await server.start(project, true);
  await Promise.all([server.dispose(), server.dispose()]);
  await expect(fetch(ready.url!, { signal: AbortSignal.timeout(500) })).rejects.toThrow();
  expect((await server.start(project, true)).status).toBe('failed');
}, 15_000);

it('recovers after a missing executable without changing PATH for future starts', async () => {
  const { project } = await fixture(liveScript);
  const server = controller();
  vi.stubEnv('PATH', '/nonexistent-astro-studio-test-path');
  const failed = await server.start(project, true);
  vi.unstubAllEnvs();
  expect(failed.status).toBe('failed');
  expect(failed.message).toContain('npm');
  const recovered = await server.start(project, true);
  expect(recovered.status).toBe('running');
}, 15_000);

it('retains ownership after a signalling error and allows Stop to retry cleanup', async () => {
  const { project } = await fixture(liveScript);
  const server = controller();
  const ready = await server.start(project, true);
  const original = process.kill.bind(process);
  const signal = vi.spyOn(process, 'kill').mockImplementation((pid, requested) => {
    if (pid < 0 && requested === 'SIGTERM') throw Object.assign(new Error('test signal denied'), { code: 'EPERM' });
    return original(pid, requested);
  });
  try {
    expect(await server.stop()).toMatchObject({ status: 'failed', cleanupPending: true });
    expect(await server.start(project, true)).toMatchObject({ status: 'failed', cleanupPending: true });
  } finally { signal.mockRestore(); }
  expect((await server.stop()).status).toBe('stopped');
  await expect(fetch(ready.url!, { signal: AbortSignal.timeout(500) })).rejects.toThrow();
}, 15_000);

it('recovers after a repaired script without retaining old errors in new logs', async () => {
  const { root, project } = await fixture("console.error('old failed script'); process.exit(3);");
  const server = controller();
  expect((await server.start(project, true)).status).toBe('failed');
  await writeFile(path.join(root, 'server.cjs'), liveScript);
  const ready = await server.start(project, true);
  expect(ready.status).toBe('running');
  expect(ready.message).toBeNull();
  expect(ready.logs.join('\n')).not.toContain('old failed script');
}, 15_000);

it('restarts repeatedly and cancels startup without publishing a stale URL', async () => {
  const { root, project } = await fixture(liveScript);
  const server = controller();
  for (let index = 0; index < 3; index++) {
    const ready = await server.start(project, true);
    expect(ready.status).toBe('running');
    expect((await server.stop()).status).toBe('stopped');
    await expect(fetch(ready.url!, { signal: AbortSignal.timeout(500) })).rejects.toThrow();
  }
  await writeFile(path.join(root, 'server.cjs'), 'setInterval(() => {}, 1000);');
  const pending = server.start(project, true);
  const stopped = server.stop();
  expect((await stopped).status).toBe('stopped');
  expect((await pending).status).toBe('stopped');
  expect(server.snapshot.url).toBeNull();
}, 15_000);

const liveScript = `
const http = require('node:http');
require('node:fs').appendFileSync('starts.txt', 'started\\n');
const server = http.createServer((request, response) => response.end('owned preview'));
server.listen(0, '127.0.0.1', () => {
  process.stdout.write('x'.repeat(50000) + '\\n');
  for (let index = 0; index < 150; index++) console.log('line-' + index + ':' + 'x'.repeat(200));
  process.stdout.write('\\x1b[32m┃ Local ht');
  process.stderr.write('unrelated http://evil.example/\\n');
  setTimeout(() => process.stdout.write('tp://127.0.0.1:' + server.address().port + '/\\x1b[0m\\n'), 25);
});
`;

it('starts a real script once, handles split output, and exposes a bounded log tail', async () => {
  const { root, project } = await fixture(liveScript);
  const server = controller();
  const starting = server.start(project, true);
  expect(server.snapshot.status).toBe('starting');
  expect((await server.start(project, true)).status).toBe('starting');
  const running = await starting;
  expect(running.status).toBe('running');
  expect(running.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
  expect(await (await fetch(running.url!)).text()).toBe('owned preview');
  expect((await server.start(project, true)).url).toBe(running.url);
  expect((await readFile(path.join(root, 'starts.txt'), 'utf8')).trim()).toBe('started');
  expect(running.logs.join('\n').length).toBeLessThanOrEqual(16_384);
  expect(running.logs.join('\n')).not.toContain('line-0:');
  expect(running.logs.join('\n')).toContain('line-149:');
  expect((await server.stop()).status).toBe('stopped');
  await expect(fetch(running.url!)).rejects.toThrow();
}, 15_000);

it('blocks untrusted workspaces before executing their scripts', async () => {
  const { root, project } = await fixture("require('node:fs').writeFileSync('executed', 'bad');");
  const result = await controller().start(project, false);
  expect(result.status).toBe('failed');
  expect(result.message).toContain('trusted');
  await expect(readFile(path.join(root, 'executed'))).rejects.toThrow();
});

it.each([
  null,
  { kind: 'not-astro' as const, rootPath: '/tmp', diagnostics: [] },
])('rejects missing or non-Astro discovery before spawning', async project => {
  expect((await controller().start(project, true)).status).toBe('failed');
});

it('rejects unresolved managers and missing dev scripts', async () => {
  const { project } = await fixture(liveScript);
  if (project.kind !== 'astro') throw new Error('Fixture discovery must succeed');
  expect((await controller().start({ ...project, packageManager: null }, true)).message).toContain('package manager');
  expect((await controller().start({ ...project, devScript: null }, true)).message).toContain('dev script');
});

it('reports script failure with the exit code and retained logs', async () => {
  const { project } = await fixture("console.error('fixture startup failed'); process.exit(7);");
  const result = await controller().start(project, true);
  expect(result.status).toBe('failed');
  expect(result.message).toContain('7');
  expect(result.logs.join('\n')).toContain('fixture startup failed');
}, 15_000);

it('times out a server that never emits a valid Local URL', async () => {
  const { project } = await fixture('setInterval(() => {}, 1000);');
  const result = await controller(500).start(project, true);
  expect(result.status).toBe('failed');
  expect(result.message).toContain('Timed out');
}, 15_000);
