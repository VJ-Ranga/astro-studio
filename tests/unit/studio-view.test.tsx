import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { StudioView } from '../../webview/studio-view';
import type { StudioState } from '../../src/panel/messages';
import { stoppedPreview } from '../../src/preview/preview-types';
import { emptyContent } from '../../src/content/content-types';

const render = (state: Omit<StudioState, 'preview' | 'content'> & Partial<Pick<StudioState, 'preview' | 'content'>>) => renderToStaticMarkup(<StudioView state={{ ...state, preview: state.preview ?? stoppedPreview(), content: state.content ?? emptyContent() }} request={() => undefined} />);
it('explains an empty workspace and keeps Start disabled', () => {
  const html = render({ status: 'no-folder', project: null, trusted: false });
  expect(html).toContain('Open a local Astro folder');
  expect(html).toContain('Restricted mode');
  expect(html).toContain('disabled=""');
  expect(html).toContain('Start preview runs');
});
it('renders a running preview with its actual URL and bounded logs', () => {
  const html = render({ status: 'no-folder', trusted: true, project: null,
    preview: { status: 'running', rootPath: '/site', url: 'http://localhost:4322/', message: null, logs: ['dev ready'] },
  });
  expect(html).toContain('Running');
  expect(html).toContain('http://localhost:4322/');
  expect(html).toContain('Open preview');
  expect(html).toContain('dev ready');
});
it('renders stopping without a reopen action and keeps Start disabled', () => {
  const html = render({ status: 'no-folder', trusted: true, project: null,
    preview: { status: 'stopping', rootPath: '/site', url: null, message: null, logs: [] },
  });
  expect(html).toContain('Stopping');
  expect(html).not.toContain('Open preview');
  expect(html).toContain('disabled=""');
});
it('renders hostile project metadata as text and shows manager diagnostics', () => {
  const html = render({ status: 'discovered', trusted: true, project: {
    kind: 'astro', rootPath: '/work/<site>', name: '<script>alert(1)</script>', astroVersion: '^7.4.2',
    packageManager: null, packageManagerSource: 'unresolved', devScript: 'astro dev',
    diagnostics: [{ severity: 'error', message: 'Multiple package managers have lockfiles.' }],
  } });
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
  expect(html).toContain('Multiple package managers');
  expect(html).toContain('Unresolved');
  expect(html).toContain('astro dev');
});
it.each(['invalid', 'not-astro'] as const)('keeps %s states actionable', kind => {
  const html = render({ status: 'discovered', trusted: false, project: {
    kind, rootPath: '/bad', diagnostics: [{ severity: 'error', message: 'Fix package.json and refresh.' }],
  } });
  expect(html).toContain('Fix package.json and refresh.');
  expect(html).toContain('Refresh project');
  expect(html).toContain('Select project');
});
