// Run with the browser tool's run_code entry point while tests/browser/serve.mjs runs.
async (page) => {
  const equal = (actual, expected, message = 'Values must match') => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${message}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
  };
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  try {
    await page.setViewportSize({ width: 1000, height: 850 });
    await page.goto('http://127.0.0.1:4372/');
    await page.waitForFunction(() => window.requests.some(request => request.type === 'ready'));
    const send = state => page.evaluate(state => window.dispatchEvent(new MessageEvent('message', {
      data: { version: 1, type: 'state', state: { preview: { status: 'stopped', rootPath: null, url: null, message: null, logs: [] }, content: { status: 'idle', entries: [], diagnostics: [] }, ...state } },
    })), state);
    await send({ status: 'no-folder', trusted: false, project: null });
    await page.getByRole('heading', { name: 'Open a local Astro folder' }).waitFor();
    equal(await page.getByRole('button', { name: 'Start preview' }).isDisabled(), true);
    await page.getByRole('button', { name: 'Select project' }).click();
    await page.getByRole('button', { name: 'Refresh project' }).click();
    equal(await page.evaluate(() => window.requests.map(request => request.type)), ['ready', 'selectProject', 'refreshProject']);

    await send({ status: 'discovered', trusted: true, project: {
      kind: 'astro', name: 'Studio journal', rootPath: '/home/editor/Projects/studio journal',
      astroVersion: '7.4.2', packageManager: null, packageManagerSource: 'unresolved', devScript: 'astro dev',
      diagnostics: [{ severity: 'error', message: 'Multiple package managers have lockfiles. Set packageManager explicitly.' }],
    } });
    await page.getByRole('heading', { name: 'Studio journal' }).waitFor();
    equal(await page.getByText('Unresolved', { exact: false }).isVisible(), true);
    await page.getByRole('button', { name: 'Source Control', exact: true }).click();
    equal(await page.evaluate(() => window.requests.at(-1)), { version: 1, type: 'openSourceControl' });
    const project = {
      kind: 'astro', name: 'Studio journal', rootPath: '/site', astroVersion: '7.4.2',
      packageManager: 'npm', packageManagerSource: 'declaration', devScript: 'astro dev', diagnostics: [],
    };
    await send({ status: 'discovered', trusted: true, project });
    await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(button => button.textContent === 'Start preview').disabled);
    await page.getByRole('button', { name: 'Start preview' }).click();
    await send({ status: 'discovered', trusted: true, project, preview: {
      status: 'running', rootPath: '/site', url: 'http://127.0.0.1:45322/', message: null, logs: ['Astro ready'],
    } });
    await page.getByRole('button', { name: 'Open preview' }).click();
    await page.getByRole('button', { name: 'Show preview logs' }).click();
    await page.getByRole('button', { name: 'Stop preview' }).click();
    equal(await page.evaluate(() => window.requests.slice(-4).map(request => request.type)), ['startPreview', 'openPreview', 'showPreviewLogs', 'stopPreview']);
    equal(await page.getByRole('button', { name: 'Start preview' }).isDisabled(), true);
    await send({ status: 'discovered', trusted: true, project, content: { status: 'ready', entries: [
      { id: 'a'.repeat(24), path: 'posts/welcome.md', mode: 'supported', fields: { title: 'Welcome article', draft: false }, ranges: {}, diagnostics: [] },
      { id: 'b'.repeat(24), path: 'posts/components.mdx', mode: 'source-only', fields: {}, ranges: {}, diagnostics: ['MDX stays source-only'] },
    ], diagnostics: ['Skipped escaping symlink.'] } });
    await page.getByRole('heading', { name: 'Local content' }).waitFor();
    await page.getByRole('button', { name: 'Inspect posts/components.mdx' }).click();
    await page.getByText('MDX stays source-only', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Review diff', exact: true }).click();
    equal(await page.evaluate(() => window.requests.at(-1)), { version: 1, type: 'reviewContentDiff', id: 'b'.repeat(24) });
    await page.getByRole('button', { name: 'Open source', exact: true }).click();
    await page.getByRole('button', { name: 'Refresh content', exact: true }).click();
    equal(await page.evaluate(() => window.requests.slice(-2)), [
      { version: 1, type: 'openContent', id: 'b'.repeat(24) }, { version: 1, type: 'refreshContent' },
    ]);
    await page.getByRole('button', { name: 'Inspect posts/welcome.md' }).click();
    await page.getByText('Welcome article', { exact: true }).waitFor();
    equal(await page.locator('input,textarea').count(), 0);
    await page.getByRole('button', { name: 'Edit fields', exact: true }).click();
    equal(await page.evaluate(() => window.requests.at(-1)), { version: 1, type: 'editContent', id: 'a'.repeat(24) });
    const contentEntries = [
      { id: 'a'.repeat(24), path: 'posts/welcome.md', mode: 'supported', fields: { title: 'Welcome article', draft: false }, ranges: {}, diagnostics: [] },
      { id: 'b'.repeat(24), path: 'posts/components.mdx', mode: 'source-only', fields: {}, ranges: {}, diagnostics: ['MDX stays source-only'] },
    ];
    const form = { status: 'ready', id: 'a'.repeat(24), token: 'c'.repeat(32), documentVersion: 7, mode: 'supported', fields: { title: 'Welcome article', draft: false }, diagnostics: [], dirty: false, message: null };
    const formState = value => send({ status: 'discovered', trusted: true, project, content: { status: 'ready', entries: contentEntries, diagnostics: [], form: value } });
    await formState(form);
    await page.waitForFunction(() => document.getElementById('content-title')?.value === 'Welcome article');
    await page.getByLabel('Title', { exact: true }).fill('New form title');
    await page.getByLabel('Draft', { exact: true }).check();
    await page.getByRole('button', { name: 'Apply to editor', exact: true }).click();
    equal(await page.evaluate(() => window.requests.at(-1)), {
      version: 1, type: 'applyContent', id: form.id, token: form.token, documentVersion: 7, fields: { title: 'New form title', draft: true },
    });
    await formState({ ...form, status: 'conflict', message: 'Document changed. Your draft is kept.' });
    await page.getByRole('alert').filter({ hasText: 'Your draft is kept' }).waitFor();
    equal(await page.getByLabel('Title', { exact: true }).inputValue(), 'New form title');
    equal(await page.getByRole('button', { name: 'Apply to editor', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Inspect posts/components.mdx' }).click();
    await page.getByRole('button', { name: 'Inspect posts/welcome.md' }).click();
    equal(await page.getByLabel('Title', { exact: true }).inputValue(), 'New form title');
    await page.getByRole('button', { name: 'Reload fields (discard form changes)', exact: true }).click();
    equal(await page.evaluate(() => window.requests.at(-1)), { version: 1, type: 'editContent', id: form.id });
    await formState({ ...form, token: 'd'.repeat(32), documentVersion: 8, fields: { title: 'Concurrent editor title', draft: false } });
    await page.waitForFunction(() => document.getElementById('content-title')?.value === 'Concurrent editor title');
    await page.setViewportSize({ width: 360, height: 800 });
    equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'Content browser must fit a narrow panel');
    await send({ status: 'discovered', trusted: true, project, preview: {
      status: 'stopping', rootPath: '/site', url: null, message: null, logs: [], cleanupPending: true,
    } });
    await page.getByRole('status').filter({ hasText: 'Stopping' }).waitFor();
    equal(await page.getByRole('button', { name: 'Start preview' }).isDisabled(), true);
    equal(await page.getByRole('button', { name: 'Stop preview' }).isDisabled(), true);
    equal(await page.getByRole('button', { name: 'Open preview' }).count(), 0);
    await send({ status: 'discovered', trusted: true, project, preview: {
      status: 'failed', rootPath: '/site', url: null, message: 'Cleanup failed. Retry Stop preview.', logs: [], cleanupPending: true,
    } });
    await page.getByRole('alert').waitFor();
    equal(await page.getByRole('button', { name: 'Start preview' }).isDisabled(), true);
    equal(await page.getByRole('button', { name: 'Stop preview' }).isDisabled(), false);
    await page.getByRole('button', { name: 'Stop preview' }).click();
    await page.setViewportSize({ width: 360, height: 800 });
    equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'Narrow panel must not overflow horizontally');
    await send({ status: 'discovered', trusted: false, project: {
      kind: 'invalid', rootPath: '/site', diagnostics: [{ severity: 'error', message: '<script>window.injected = true</script>' }],
    } });
    await page.getByRole('heading', { name: 'Project metadata needs attention' }).waitFor();
    equal(await page.evaluate(() => window.injected), undefined);
    equal(await page.getByText('<script>window.injected = true</script>', { exact: true }).isVisible(), true);
    equal(errors, []);
    return { result: 'PASS', checks: ['ready handshake', 'select/refresh requests', 'empty and restricted state', 'Astro metadata and diagnostics', 'start/open/logs/stop preview actions', 'running and stopping state guards', 'cleanup failure and Stop retry', 'content selection and source actions', 'typed form submissions', 'draft preservation on conflict and entry inspection', 'explicit reload', '360px layout', 'hostile metadata escaped', 'no browser exceptions'] };
  } finally {
    page.off('pageerror', onError);
  }
}
