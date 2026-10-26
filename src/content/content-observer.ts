import * as vscode from 'vscode';
import path from 'node:path';
import { isContained } from './content-files';

export interface ContentObserverOptions {
  refresh: () => Promise<void>;
  document: (document: vscode.TextDocument, reason: 'change' | 'save') => void;
  file: (filePath: string) => Promise<void>;
}
export class ContentObserver {
  private root: string | undefined;
  private watcher: vscode.FileSystemWatcher | undefined;
  private fileListeners: vscode.Disposable[] = [];
  private readonly documentListeners: vscode.Disposable[];
  private timer: NodeJS.Timeout | undefined;
  private readonly pendingFiles = new Set<string>();
  private disposed = false;
  constructor(private readonly options: ContentObserverOptions) {
    this.documentListeners = [
      vscode.workspace.onDidChangeTextDocument(event => {
        if (this.includes(event.document.uri)) this.options.document(event.document, 'change');
      }),
      vscode.workspace.onDidSaveTextDocument(document => {
        if (!this.includes(document.uri)) return;
        this.options.document(document, 'save');
        this.schedule();
      }),
    ];
  }

  private includes(uri: vscode.Uri): boolean {
    return !this.disposed && !!this.root && uri.scheme === 'file' && isContained(path.join(this.root, 'src', 'content'), path.resolve(uri.fsPath));
  }

  private schedule(filePath?: string): void {
    if (filePath && this.pendingFiles.size < 500) this.pendingFiles.add(filePath);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const root = this.root;
      const files = [...this.pendingFiles];
      this.pendingFiles.clear();
      if (this.disposed || !root) return;
      void (async () => {
        // Inspect the final saved file, not transient rename/delete events from an atomic save.
        await Promise.all(files.map(file => this.options.file(file)));
        if (!this.disposed && this.root === root) await this.options.refresh();
      })().catch(error => console.error('Astro Studio content observation failed:', error));
    }, 150);
  }

  setRoot(root?: string): void {
    const next = root ? path.resolve(root) : undefined;
    if (this.disposed || next === this.root) return;
    clearTimeout(this.timer);
    this.pendingFiles.clear();
    for (const listener of this.fileListeners) listener.dispose();
    this.fileListeners = [];
    this.watcher?.dispose();
    this.watcher = undefined;
    this.root = next;
    if (!next) return;
    this.watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(next, 'src/content/**/*'));
    const changed = (uri: vscode.Uri) => {
      if (!this.includes(uri)) return;
      this.schedule(uri.fsPath);
    };
    this.fileListeners = [this.watcher.onDidCreate(changed), this.watcher.onDidChange(changed), this.watcher.onDidDelete(changed)];
  }

  dispose(): void {
    if (this.disposed) return;
    this.setRoot();
    this.disposed = true;
    clearTimeout(this.timer);
    for (const listener of this.documentListeners) listener.dispose();
  }
}
