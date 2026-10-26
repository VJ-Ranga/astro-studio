import { expect, it } from 'vitest';
import { planContentEdits } from '../../src/content/content-edits';
import { analyzeContent } from '../../src/content/frontmatter';
import type { ContentFields } from '../../src/content/content-types';

const apply = (source: string, changes: ContentFields, extension = '.md') =>
  planContentEdits(source, changes, extension).reduce((text, edit) => text.slice(0, edit.start) + edit.text + text.slice(edit.end), source);

it.each(['\n', '\r\n'])('replaces only intended scalar spans while retaining BOM, Unicode, comments and %j', newline => {
  const source = '\uFEFF' + ['---', 'title: "Old 世界" # keep title comment', "description: 'Keep this spelling'", 'draft: false # keep boolean comment', 'unknown:', '  nested: [one, two]', '---', '# Original body', '<Widget prop={1} />', ''].join(newline);
  const expected = source.replace('"Old 世界"', '"New 🌍"').replace('draft: false', 'draft: true');
  expect(apply(source, { title: 'New 🌍', draft: true, description: 'Keep this spelling' })).toBe(expected);
});
it('quotes YAML-sensitive strings and escaped newlines without touching the body', () => {
  const source = '---\ntitle: Old\ndescription: Old description\n---\nBody remains identical\n';
  const title = 'true: "quoted" # not a comment';
  const description = 'Line one\nLine two\\path';
  const next = apply(source, { title, description });
  expect(analyzeContent(next).fields).toEqual({ title, description });
  expect(next.endsWith('\n---\nBody remains identical\n')).toBe(true);
});
it('does not reserialize unchanged values', () => {
  const source = "---\ntitle: 'Same title' # keep this\ndraft: false\n---\nBody\n";
  expect(planContentEdits(source, { title: 'Same title', draft: false })).toEqual([]);
});
it.each([
  { missing: 'value' }, { title: 123 }, { draft: 'false' }, { description: 'absent field' }, { title: 'x'.repeat(4097) },
])('rejects invalid or missing fields %j', changes => {
  expect(() => planContentEdits('---\ntitle: Hello\ndraft: false\n---\nBody', changes as ContentFields)).toThrow();
});
it.each([
  '# No frontmatter', '---\ntitle: &x Hello\nother: *x\n---\n',
  '---\ntitle: First\ntitle: Second\n---\n', '---\ntitle: |\n  Multiline\n---\n',
])('refuses source-only content without creating replacements', source => {
  expect(() => planContentEdits(source, { title: 'New' })).toThrow('source-only');
});
it('refuses MDX even when fields look supported', () => {
  expect(() => planContentEdits('---\ntitle: Old\n---\n<Component />', { title: 'New' }, '.mdx')).toThrow('source-only');
});
