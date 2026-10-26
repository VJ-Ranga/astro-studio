import { expect, it } from 'vitest';
import { parsePreviewUrl } from '../../src/preview/preview-url';

it.each([
  ['  ┃ Local    http://localhost:4321/', 'http://localhost:4321/'],
  ['\u001b[32m  Local: http://127.0.0.1:4322/blog/\u001b[0m', 'http://127.0.0.1:4322/blog/'],
  ['│ Local https://[::1]:45322/base/', 'https://[::1]:45322/base/'],
])('parses the actual labelled local endpoint %s', (line, expected) => {
  expect(parsePreviewUrl(line)).toBe(expected);
});

it.each([
  'Docs: http://localhost:4321/', 'Network http://192.168.1.2:4321/',
  'Local http://evil.example:4321/', 'Local http://localhost.evil.example/',
  'Local javascript:alert(1)', 'Local file:///etc/passwd',
  'Local http://user:secret@localhost:4321/', 'Local http://localhost:99999/',
  'Local http://localhost:0/', 'Local http://localhost:4321/#fragment',
  'Local http://localhost:4321/?token=secret', 'Local http://0.0.0.0:4321/',
  'Local http://localhost\\@evil.example/', 'Random prefix Local http://localhost:4321/',
])('rejects non-preview or invalid output %s', line => {
  expect(parsePreviewUrl(line)).toBeUndefined();
});
