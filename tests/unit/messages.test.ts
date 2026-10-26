import { expect, it } from 'vitest';
import { parseWebviewRequest } from '../../src/panel/messages';

it.each(['ready', 'refreshProject', 'selectProject', 'startPreview', 'stopPreview', 'openPreview', 'showPreviewLogs', 'refreshContent', 'openSourceControl'])('accepts versioned %s', type => {
  expect(parseWebviewRequest({ version: 1, type })).toEqual({ version: 1, type });
});
it('accepts only an exact, opaque Open Source entry ID', () => {
  expect(parseWebviewRequest({ version: 1, type: 'openContent', id: 'a'.repeat(24) }))
    .toEqual({ version: 1, type: 'openContent', id: 'a'.repeat(24) });
  for (const input of [
    { version: 1, type: 'openContent' },
    { version: 1, type: 'openContent', id: '../../secret.md' },
    { version: 1, type: 'openContent', id: 'a'.repeat(24), path: '/etc/passwd' },
  ]) expect(parseWebviewRequest(input)).toBeUndefined();
});
it('accepts a typed form submission and rejects forged or unbounded form data', () => {
  const message = { version: 1, type: 'applyContent', id: 'a'.repeat(24), token: 'b'.repeat(32), documentVersion: 1, fields: { title: 'New', draft: false } };
  expect(parseWebviewRequest(message)).toEqual(message);
  expect(parseWebviewRequest({ version: 1, type: 'editContent', id: message.id })).toEqual({ version: 1, type: 'editContent', id: message.id });
  for (const invalid of [
    { ...message, path: '/etc/passwd' }, { ...message, ranges: [] },
    { ...message, token: 'forged' }, { ...message, documentVersion: 0 },
    { ...message, documentVersion: 1.5 }, { ...message, fields: {} },
    { ...message, fields: { title: 'x'.repeat(4097) } },
    { ...message, fields: { draft: 'false' } }, { ...message, fields: { unknown: 'new' } },
  ]) expect(parseWebviewRequest(invalid)).toBeUndefined();
});
it.each([
  undefined, null, [], 'refreshProject', 1, {}, { version: 2, type: 'ready' },
  { version: 1, type: 'executeCommand' }, { type: 'refreshProject' },
  { version: 1, type: 'refreshProject', rootPath: '/etc' },
  { version: 1, type: 'startPreview', command: 'arbitrary shell' },
])('rejects malformed or privileged input %j', input => {
  expect(parseWebviewRequest(input)).toBeUndefined();
});
