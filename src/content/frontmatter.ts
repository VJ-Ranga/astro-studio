import type { ContentAnalysis } from './content-types';
import { isAlias, isMap, isPair, isScalar, parseDocument, visit } from 'yaml';

export function analyzeContent(source: string, extension = '.md'): ContentAnalysis {
  const result: ContentAnalysis = { mode: 'source-only', fields: {}, ranges: {}, diagnostics: [] };
  const note = (message: string) => { if (!result.diagnostics.includes(message) && result.diagnostics.length < 8) result.diagnostics.push(message); };
  if (extension.toLowerCase() === '.mdx') note('MDX remains source-only. Open source to edit its frontmatter and components.');
  const opening = /^(?:\uFEFF)?---[ \t]*\r?\n/.exec(source);
  if (!opening) { note('No opening frontmatter block. Open source to add or edit metadata.'); return result; }
  const offset = opening[0].length;
  const rest = source.slice(offset);
  const closing = /^---[ \t]*\r?$/m.exec(rest);
  if (!closing) { note('Frontmatter is missing its closing --- line.'); return result; }
  const yaml = rest.slice(0, closing.index);
  try {
    const document = parseDocument(yaml, { schema: 'core', version: '1.2', uniqueKeys: true, keepSourceTokens: true, prettyErrors: false });
    for (const error of [...document.errors, ...document.warnings]) note(`YAML: ${error.message.slice(0, 180)}`);
    if (/^%(?:YAML|TAG)\b/m.test(yaml) || document.directives?.yaml.explicit || document.directives?.docEnd) note('YAML directives and multiple-document markers remain source-only.');
    if (!isMap(document.contents)) { note('Frontmatter must be one YAML mapping with string keys.'); return result; }
    visit(document, (_key, node) => {
      if (isAlias(node)) note('YAML aliases and anchors remain source-only.');
      if (isPair(node) && (!isScalar(node.key) || typeof node.key.value !== 'string')) note('YAML mapping keys must be strings.');
      if (isPair(node) && isScalar(node.key) && node.key.value === '<<') note('YAML merge keys remain source-only.');
      if (typeof node === 'object' && node !== null && 'anchor' in node && node.anchor) note('YAML aliases and anchors remain source-only.');
      if (typeof node === 'object' && node !== null && 'tag' in node && node.tag) note('Explicit YAML tags remain source-only.');
      if (isScalar(node)) {
        const range = node.range;
        if (node.type === 'BLOCK_LITERAL' || node.type === 'BLOCK_FOLDED' || (range && /[\r\n]/.test(yaml.slice(range[0], range[1])))) {
          note('Multiline YAML scalars remain source-only.');
        }
      }
    });
    for (const pair of document.contents.items) {
      if (!isScalar(pair.key) || typeof pair.key.value !== 'string') continue;
      const key = pair.key.value;
      if (key !== 'title' && key !== 'description' && key !== 'draft') continue;
      const value = pair.value;
      if (!isScalar(value) || !value.range || (key === 'draft' ? typeof value.value !== 'boolean' : typeof value.value !== 'string')) {
        note(`${key} must be ${key === 'draft' ? 'a boolean' : 'a string scalar'}; its current type is source-only.`);
        continue;
      }
      if (typeof value.value === 'string' && value.value.length > 4_096) { note(`${key} exceeds the 4096-character field inspection limit.`); continue; }
      if (key === 'draft') result.fields.draft = value.value as boolean;
      else result.fields[key] = value.value as string;
      result.ranges[key] = { start: offset + value.range[0], end: offset + value.range[1] };
    }
    if (!Object.keys(result.fields).length) note('No supported title, description, or draft field is present.');
    if (!result.diagnostics.length) result.mode = 'supported';
  } catch {
    note('Frontmatter cannot be inspected safely. Open source to review its YAML syntax.');
  }
  return result;
}
