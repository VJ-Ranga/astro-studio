import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import path from 'node:path';
import { discoverProject } from '../../src/workspace/discover-project';
import { DevServerController } from '../../src/preview/dev-server';

const root = path.resolve('tests/fixtures/preview site');
const occupied = createServer((_request, response) => response.end('Occupied port: not the Astro site'));
const preview = new DevServerController();

async function main(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    occupied.once('error', reject);
    occupied.listen(45321, '127.0.0.1', () => resolve());
  });
  try {
    const project = await discoverProject(root);
    assert.equal(project.kind, 'astro');
    const starting = preview.start(project, true);
    assert.equal(preview.snapshot.status, 'starting');
    assert.equal((await preview.start(project, true)).status, 'starting');
    const ready = await starting;
    assert.equal(ready.status, 'running', `${ready.message}\n${ready.logs.join('\n')}`);
    assert.ok(ready.url);
    assert.notEqual(new URL(ready.url).port, '45321', 'Astro must report an alternate port');
    const response = await fetch(ready.url, { signal: AbortSignal.timeout(5_000) });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Astro Studio preview is running/);
    assert.equal((await preview.start(project, true)).url, ready.url, 'Duplicate start must reuse the owned process');
    assert.match(await (await fetch('http://127.0.0.1:45321/')).text(), /not the Astro site/);
    assert.equal((await preview.stop()).status, 'stopped');
    await assert.rejects(fetch(ready.url, { signal: AbortSignal.timeout(1_000) }));
    for (let cycle = 0; cycle < 2; cycle++) {
      const restarted = await preview.start(project, true);
      assert.equal(restarted.status, 'running', restarted.message ?? undefined);
      assert.ok(restarted.url);
      assert.match(await (await fetch(restarted.url)).text(), /Astro Studio preview is running/);
      await preview.stop();
      await assert.rejects(fetch(restarted.url, { signal: AbortSignal.timeout(1_000) }));
    }
    const final = await preview.start(project, true);
    assert.equal(final.status, 'running');
    assert.ok(final.url);
    await Promise.all([preview.dispose(), preview.dispose()]);
    await assert.rejects(fetch(final.url, { signal: AbortSignal.timeout(1_000) }));
    assert.match(await (await fetch('http://127.0.0.1:45321/')).text(), /not the Astro site/);
    console.log(`PASS: Astro 7.4.2 occupied-port startup (${ready.url}), duplicate rejection, 3 start/stop cycles, awaited disposal, and unrelated-listener preservation`);
  } finally {
    await preview.stop();
    await new Promise<void>(resolve => occupied.close(() => resolve()));
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
