import type { ContentFields } from './content-types';
import { analyzeContent } from './frontmatter';
import { isContentFields } from './content-values';

export interface ScalarReplacement { start: number; end: number; text: string }
export function planContentEdits(source: string, changes: ContentFields, extension = '.md'): ScalarReplacement[] {
  if (Buffer.byteLength(source, 'utf8') > 1_048_576) throw new Error('Document exceeds the 1 MiB editing limit.');
  if (!isContentFields(changes)) throw new Error('Only existing string title/description fields and boolean draft are editable; strings are limited to 4096 characters.');
  const analysis = analyzeContent(source, extension);
  if (analysis.mode !== 'supported') throw new Error('This document is source-only. Open source to edit its unsupported syntax.');
  const edits: ScalarReplacement[] = [];
  for (const key of Object.keys(changes) as (keyof ContentFields)[]) {
    const range = analysis.ranges[key];
    if (!Object.hasOwn(analysis.fields, key) || !range) throw new Error(`${key} is not an existing supported field. Missing fields are not created.`);
    if (analysis.fields[key] === changes[key]) continue;
    if (range.start < 0 || range.end > source.length || range.end <= range.start) throw new Error('Invalid source range; reload the form.');
    edits.push({ ...range, text: JSON.stringify(changes[key]) });
  }
  edits.sort((a, b) => b.start - a.start);
  const next = edits.reduce((text, edit) => text.slice(0, edit.start) + edit.text + text.slice(edit.end), source);
  if (Buffer.byteLength(next, 'utf8') > 1_048_576) throw new Error('Edited document would exceed the 1 MiB editing limit.');
  const checked = analyzeContent(next, extension);
  const expected = { ...analysis.fields, ...changes };
  if (checked.mode !== 'supported' || (Object.keys(expected) as (keyof ContentFields)[]).some(key => checked.fields[key] !== expected[key])) {
    throw new Error('Values cannot be represented in the supported YAML subset. Source was not changed.');
  }
  return edits;
}
