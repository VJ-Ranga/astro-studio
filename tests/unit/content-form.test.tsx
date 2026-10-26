import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { ContentForm } from '../../webview/content-form';
import { emptyContentForm } from '../../src/content/content-types';

it('renders only existing supported fields and explains unsaved native edits', () => {
  const html = renderToStaticMarkup(<ContentForm form={{ ...emptyContentForm(), status: 'ready', id: 'a'.repeat(24), token: 'b'.repeat(32), documentVersion: 3, mode: 'supported', fields: { title: 'Current title', draft: false }, dirty: true }} request={() => undefined} />);
  expect(html).toContain('Title');
  expect(html).toContain('Draft');
  expect(html).not.toContain('Description');
  expect(html).toContain('Apply to editor');
  expect(html).toContain('Save in VS Code');
});
it('shows conflict recovery without hiding the draft fields', () => {
  const html = renderToStaticMarkup(<ContentForm form={{ ...emptyContentForm(), status: 'conflict', id: 'a'.repeat(24), token: 'b'.repeat(32), documentVersion: 1, mode: 'supported', fields: { title: 'Old title' }, message: 'Document changed; draft kept.' }} request={() => undefined} />);
  expect(html).toContain('draft kept');
  expect(html).toContain('Reload fields (discard form changes)');
  expect(html).toContain('Old title');
});
it('does not expose inputs for source-only buffers', () => {
  const html = renderToStaticMarkup(<ContentForm form={{ ...emptyContentForm(), status: 'ready', id: 'a'.repeat(24), diagnostics: ['Unsupported YAML'] }} request={() => undefined} />);
  expect(html).toContain('Unsupported YAML');
  expect(html).not.toContain('<input');
  expect(html).not.toContain('<textarea');
});
