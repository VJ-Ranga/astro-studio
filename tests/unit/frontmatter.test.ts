import { expect, it } from 'vitest';
import { analyzeContent } from '../../src/content/frontmatter';

it.each(['\n', '\r\n'])('inspects Unicode and unknown fields without changing %j source spans', newline => {
  const source = '\uFEFF' + ['---', 'title: "Hello 世界" # keep comment', "description: 'A journal'", 'draft: false', 'unknown:', '  - untouched', '---', '# Body', '<Component value={1} />', ''].join(newline);
  const result = analyzeContent(source);
  expect(result.mode).toBe('supported');
  expect(result.fields).toEqual({ title: 'Hello 世界', description: 'A journal', draft: false });
  const title = result.ranges.title!;
  expect(source.slice(title.start, title.end)).toBe('"Hello 世界"');
  expect(source).toContain('# keep comment');
});

it.each([
  ['no frontmatter', '# Body only'],
  ['unterminated frontmatter', '---\ntitle: Missing end\n'],
  ['invalid YAML', '---\ntitle: [broken\n---\n'],
  ['duplicate keys', '---\ntitle: First\ntitle: Second\n---\n'],
  ['aliases and anchors', '---\ntitle: &name First\nother: *name\n---\n'],
  ['multiline scalar', '---\ntitle: |\n  Hello\n  World\n---\n'],
  ['multiline quoted scalar', '---\ntitle: "Hello\n  World"\n---\n'],
  ['custom tag', '---\ntitle: !custom Hello\n---\n'],
  ['explicit scalar tag', '---\ntitle: !!str Hello\n---\n'],
  ['merge key', '---\ntitle: Hello\n<<: { other: value }\n---\n'],
  ['directives', '---\n%YAML 1.1\n---\ntitle: Hello\n---\n'],
  ['non-string key', '---\n123: value\ntitle: Hello\n---\n'],
  ['unsupported title type', '---\ntitle: 123\n---\n'],
  ['unsupported draft type', '---\ntitle: Hello\ndraft: "false"\n---\n'],
  ['no supported fields', '---\nother: untouched\n---\n'],
  ['non-mapping document', '---\n- first\n- second\n---\n'],
])('keeps %s source-only with a diagnostic', (_name, source) => {
  const result = analyzeContent(source);
  expect(result.mode).toBe('source-only');
  expect(result.diagnostics.length).toBeGreaterThan(0);
});

it('keeps MDX source-only even when its frontmatter is supported', () => {
  const result = analyzeContent('---\ntitle: MDX article\n---\n<Component />', '.mdx');
  expect(result.mode).toBe('source-only');
  expect(result.fields.title).toBe('MDX article');
  expect(result.diagnostics.join(' ')).toContain('MDX');
});

it('bounds field values before sending them to the panel', () => {
  const result = analyzeContent('---\ntitle: ' + 'a'.repeat(4_097) + '\n---\n');
  expect(result.mode).toBe('source-only');
  expect(result.fields.title).toBeUndefined();
  expect(result.diagnostics.length).toBeGreaterThan(0);
});
