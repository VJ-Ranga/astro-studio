import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ContentView } from '../../webview/content-view';

it('shows an actionable empty content state', () => {
  const html = renderToStaticMarkup(<ContentView content={{ status: 'ready', entries: [], diagnostics: [] }} request={() => undefined} />);
  expect(html).toContain('No local entries');
  expect(html).toContain('src/content');
  expect(html).toContain('Refresh content');
});
it('shows read-only supported fields and an Open Source action', () => {
  const html = renderToStaticMarkup(<ContentView content={{ status: 'ready', entries: [{
    id: 'a'.repeat(24), path: 'posts/welcome.md', mode: 'supported', fields: { title: 'Welcome', draft: false }, ranges: {}, diagnostics: [],
  }], diagnostics: [] }} request={() => undefined} />);
  expect(html).toContain('posts/welcome.md');
  expect(html).toContain('Welcome');
  expect(html).toContain('false');
  expect(html).toContain('Open source');
  expect(html).not.toContain('<input');
});
it('escapes source-only filenames and diagnostics', () => {
  const html = renderToStaticMarkup(<ContentView content={{ status: 'ready', entries: [{
    id: 'b'.repeat(24), path: '<script>.mdx', mode: 'source-only', fields: {}, ranges: {}, diagnostics: ['MDX stays source-only'],
  }], diagnostics: ['Skipped an escaping symlink.'] }} request={() => undefined} />);
  expect(html).toContain('&lt;script&gt;.mdx');
  expect(html).toContain('MDX stays source-only');
  expect(html).toContain('Skipped an escaping symlink.');
});
