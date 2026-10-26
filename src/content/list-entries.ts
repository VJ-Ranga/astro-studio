import type { ContentEntry } from './content-types';
import { createHash } from 'node:crypto';
import { readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { analyzeContent } from './frontmatter';
import { contentRoot, isContained, readContentFile, resolveContentFile } from './content-files';

export interface ContentScan {
  entries: ContentEntry[];
  diagnostics: string[];
  files: Map<string, string>;
}
export async function listEntries(projectRoot: string): Promise<ContentScan> {
  const scan: ContentScan = { entries: [], diagnostics: [], files: new Map() };
  const note = (message: string) => { if (scan.diagnostics.length < 40) scan.diagnostics.push(message); };
  try {
    const project = await realpath(projectRoot);
    const root = await contentRoot(project);
    if (!root) return scan;
    let directories = 0;
    let limited = false;
    const visited = new Set<string>();
    const walk = async (relative: string, depth: number): Promise<void> => {
      if (limited) return;
      if (depth > 12) { note(`Skipped ${relative}: directory depth exceeds 12.`); return; }
      if (++directories > 500) { limited = true; note('Content scan stopped at the 500-directory limit.'); return; }
      const directory = await realpath(path.join(root, relative));
      if (!isContained(root, directory)) { note(`Skipped ${relative}: directory resolves outside the content root.`); return; }
      if (visited.has(directory)) return;
      visited.add(directory);
      const children = (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
      for (const child of children) {
        if (limited) break;
        const entryPath = path.join(relative, child.name);
        if (child.isDirectory()) {
          try { await walk(entryPath, depth + 1); }
          catch { note(`Cannot inspect directory ${entryPath}. Check permissions and refresh.`); }
          continue;
        }
        if (!/\.(md|mdx)$/i.test(child.name)) {
          if (child.isSymbolicLink()) note(`Skipped directory/non-content symlink ${entryPath}.`);
          continue;
        }
        if (!child.isFile() && !child.isSymbolicLink()) { note(`Skipped special file ${entryPath}.`); continue; }
        if (scan.entries.length >= 200) { limited = true; note('Content scan stopped at the 200-entry limit.'); break; }
        let canonical: string;
        try { canonical = await resolveContentFile(project, entryPath); }
        catch (error) { note(`Skipped ${entryPath}: ${(error as Error).message}`); continue; }
        const displayPath = entryPath.split(path.sep).join('/');
        const id = createHash('sha256').update(project + '\0' + displayPath).digest('hex').slice(0, 24);
        let analysis;
        try { analysis = analyzeContent(await readContentFile(canonical), path.extname(child.name)); }
        catch (error) { analysis = { mode: 'source-only' as const, fields: {}, ranges: {}, diagnostics: [(error as Error).message.slice(0, 240)] }; }
        scan.entries.push({ id, path: displayPath, ...analysis });
        scan.files.set(id, entryPath);
      }
    };
    await walk('', 0);
    scan.entries.sort((a, b) => a.path.localeCompare(b.path));
  } catch (error) { note(`Cannot browse local content: ${(error as Error).message.slice(0, 240)}`); }
  return scan;
}
