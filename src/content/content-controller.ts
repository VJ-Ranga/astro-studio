import { emptyContent, type ContentState } from './content-types';
import { realpath } from 'node:fs/promises';
import { listEntries } from './list-entries';
import { resolveContentFile } from './content-files';

export interface ContentControllerOptions {
  onState?: () => void;
  openDocument: (filePath: string) => Promise<void>;
}
export class ContentController {
  private state = emptyContent();
  private root: string | undefined;
  private files = new Map<string, string>();
  private generation = 0;
  private scanRevision = 0;
  private refreshPending = false;
  private disposed = false;
  constructor(private readonly options: ContentControllerOptions) {}
  get snapshot(): ContentState { return { ...this.state, entries: [...this.state.entries], diagnostics: [...this.state.diagnostics] }; }
  private publish(): void { if (!this.disposed) this.options.onState?.(); }

  async load(root?: string): Promise<void> {
    if (this.disposed) return;
    const generation = ++this.generation;
    ++this.scanRevision;
    this.refreshPending = false;
    this.root = undefined;
    this.files.clear();
    this.state = { status: root ? 'loading' : 'idle', entries: [], diagnostics: [] };
    this.publish();
    if (!root) return;
    try {
      const canonical = await realpath(root);
      const scan = await listEntries(canonical);
      if (generation !== this.generation || this.disposed) return;
      this.root = canonical;
      this.files = scan.files;
      this.state = { status: 'ready', entries: scan.entries, diagnostics: scan.diagnostics };
    } catch {
      if (generation !== this.generation || this.disposed) return;
      this.state = { status: 'error', entries: [], diagnostics: ['Cannot inspect this project content directory. Check its path and permissions, then refresh.'] };
    }
    this.publish();
    if (this.refreshPending && generation === this.generation && !this.disposed) {
      this.refreshPending = false;
      await this.refresh();
    }
  }

  async resolve(id: string): Promise<string> {
    const relative = this.files.get(id);
    const root = this.root;
    const generation = this.generation;
    if (this.disposed || !root || !relative) throw new Error('Content entry is not in the current scan. Refresh content and select it again.');
    const canonical = await resolveContentFile(root, relative);
    if (generation !== this.generation || this.disposed || this.files.get(id) !== relative) throw new Error('The selected project or entry changed. Refresh content and select the entry again.');
    return canonical;
  }

  async refresh(): Promise<void> {
    const root = this.root;
    const generation = this.generation;
    const revision = ++this.scanRevision;
    if (this.disposed) return;
    if (!root) { this.refreshPending = this.state.status === 'loading'; return; }
    const scan = await listEntries(root);
    if (this.disposed || generation !== this.generation || revision !== this.scanRevision) return;
    this.files = scan.files;
    this.state = { status: 'ready', entries: scan.entries, diagnostics: scan.diagnostics };
    this.publish();
  }

  async open(id: string): Promise<void> {
    await this.options.openDocument(await this.resolve(id));
  }

  dispose(): void {
    this.disposed = true;
    ++this.generation;
    this.root = undefined;
    this.files.clear();
  }
}
