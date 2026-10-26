import * as vscode from 'vscode';
import { discoverProject } from './workspace/discover-project';
import { selectProject } from './workspace/select-project';
import { StudioPanel } from './panel/studio-panel';
import type { StudioState, WebviewRequest } from './panel/messages';
import { DevServerController } from './preview/dev-server';
import { openPreview } from './preview/open-preview';
import { stoppedPreview, type PreviewState } from './preview/preview-types';
import { ContentController } from './content/content-controller';
import { emptyContent } from './content/content-types';
import { ContentDocuments } from './content/content-documents';
import { ContentObserver } from './content/content-observer';
import { openSourceControl, reviewContentDiff } from './git/native-source-control';

class StudioController implements vscode.Disposable {
  private readonly output = vscode.window.createOutputChannel('Astro Studio');
  private readonly registrations: vscode.Disposable[] = [];
  private disposed = false;
  private panel: StudioPanel | undefined;
  private root: string | undefined;
  private generation = 0;
  private state: StudioState = { status: 'no-folder', trusted: vscode.workspace.isTrusted, project: null, preview: stoppedPreview(), content: emptyContent() };
  private previewRequest = 0;
  private startPending = false;
  private shutdown: Promise<void> | undefined;
  private readonly preview = new DevServerController({
    onState: () => this.publish(),
    onLogs: logs => this.output.replace(logs.join('\n') + '\n'),
  });
  private readonly content = new ContentController({
    onState: () => this.publish(),
    openDocument: async filePath => {
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
      await vscode.window.showTextDocument(document, { preview: true });
    },
  });
  private readonly forms = new ContentDocuments({
    onState: () => this.publish(),
    resolveEntry: async id => {
      if (this.disposed || !this.root || !this.hasRoot(this.root)) throw new Error('Select a current local Astro project before editing content.');
      return this.content.resolve(id);
    },
  });
  private readonly observer = new ContentObserver({
    refresh: () => this.content.refresh(),
    document: (document, reason) => this.forms.observe(document, reason),
    file: filePath => this.forms.externalChange(filePath),
  });

  constructor(private readonly extensionUri: vscode.Uri) {
    this.registrations.push(
      vscode.commands.registerCommand('astroStudio.open', () => this.open()),
      vscode.commands.registerCommand('astroStudio.startPreview', () => this.startPreview()),
      vscode.commands.registerCommand('astroStudio.stopPreview', () => this.stopPreview()),
      vscode.workspace.onDidChangeWorkspaceFolders(() => {
        if (this.root && this.hasRoot(this.root)) {
          void this.refresh();
        } else {
          ++this.generation;
          ++this.previewRequest;
          void this.preview.stop();
          this.root = undefined;
          this.observer.setRoot();
          this.forms.reset();
          void this.content.load();
          this.emptyState();
        }
      }),
      vscode.workspace.onDidGrantWorkspaceTrust(() => this.publish()),
    );
  }

  private hasRoot(root: string): boolean {
    return !!vscode.workspace.workspaceFolders?.some(folder => folder.uri.scheme === 'file' && folder.uri.fsPath === root);
  }

  private emptyState(): void {
    const local = vscode.workspace.workspaceFolders?.some(folder => folder.uri.scheme === 'file');
    this.state = { ...this.state, status: local ? 'selection-required' : 'no-folder', trusted: vscode.workspace.isTrusted, project: null };
    this.publish();
  }

  private publish(): void {
    if (this.disposed) return;
    this.state = { ...this.state, trusted: vscode.workspace.isTrusted, preview: this.preview.snapshot, content: { ...this.content.snapshot, form: this.forms.snapshot } };
    this.panel?.send({ version: 1, type: 'state', state: this.state });
  }

  private async open(): Promise<StudioState> {
    if (!this.panel) {
      this.panel = new StudioPanel(this.extensionUri, request => this.handle(request), () => { this.panel = undefined; });
    } else this.panel.reveal();
    await this.refresh();
    return this.state;
  }

  private async handle(request: WebviewRequest): Promise<void> {
    if (this.disposed) return;
    switch (request.type) {
      case 'ready': this.publish(); break;
      case 'refreshProject': await this.refresh(); break;
      case 'selectProject': await this.refresh(true); break;
      case 'startPreview': await this.startPreview(); break;
      case 'stopPreview': await this.stopPreview(); break;
      case 'openPreview': await this.openCurrentPreview(); break;
      case 'showPreviewLogs': this.output.show(true); break;
      case 'refreshContent': await this.content.refresh(); break;
      case 'openSourceControl':
      case 'reviewContentDiff':
        try {
          if (!this.root || !this.hasRoot(this.root)) throw new Error('Select a current local project before reviewing changes.');
          if (request.type === 'openSourceControl') await openSourceControl(this.root);
          else if (request.type === 'reviewContentDiff') await reviewContentDiff(this.root, await this.content.resolve(request.id));
        } catch (error) { void vscode.window.showInformationMessage(`Astro Studio: ${(error as Error).message}`); }
        break;
      case 'openContent':
        try {
          if (!this.root || !this.hasRoot(this.root)) throw new Error('Select a current local Astro project before opening content.');
          await this.content.open(request.id);
        }
        catch (error) { void vscode.window.showInformationMessage(`Astro Studio: ${(error as Error).message}`); }
        break;
      case 'editContent':
      case 'applyContent':
        try {
          if (request.type === 'editContent') await this.forms.load(request.id);
          else if (request.type === 'applyContent') await this.forms.apply(request);
        } catch (error) {
          if (this.forms.snapshot.id !== request.id || !this.forms.snapshot.message) {
            void vscode.window.showInformationMessage(`Astro Studio: ${(error as Error).message}`);
          }
        }
        break;
    }
  }

  private async refresh(choose = false): Promise<boolean> {
    const generation = ++this.generation;
    if (!this.root || choose) {
      const selection = await selectProject();
      if (generation !== this.generation || this.disposed) return false;
      if (selection && this.hasRoot(selection)) {
        if (this.root && this.root !== selection) {
          ++this.previewRequest;
          const stopped = await this.preview.stop();
          if (generation !== this.generation || this.disposed || stopped.cleanupPending || !this.hasRoot(selection)) return false;
        }
        if (this.root !== selection) { this.forms.reset(); this.observer.setRoot(); }
        this.root = selection;
      }
    }
    if (!this.root || !this.hasRoot(this.root)) {
      this.root = undefined;
      this.observer.setRoot();
      this.forms.reset();
      await this.content.load();
      this.emptyState();
      return true;
    }
    const root = this.root;
    await this.content.load();
    if (generation !== this.generation || this.disposed) return false;
    this.state = { ...this.state, status: 'loading', trusted: vscode.workspace.isTrusted, project: null };
    this.publish();
    const project = await discoverProject(root);
    if (generation !== this.generation || this.disposed || !this.hasRoot(root)) return false;
    this.state = { ...this.state, status: 'discovered', trusted: vscode.workspace.isTrusted, project };
    this.publish();
    this.observer.setRoot(project.kind === 'astro' ? root : undefined);
    await this.content.load(project.kind === 'astro' ? root : undefined);
    if (generation !== this.generation || this.disposed) return false;
    return true;
  }

  private async startPreview(): Promise<PreviewState> {
    if (!vscode.workspace.isTrusted) {
      void vscode.window.showInformationMessage('Astro Studio: Preview requires a trusted workspace. Review the project and manage Workspace Trust in VS Code.');
      return this.preview.snapshot;
    }
    if (this.startPending || this.preview.snapshot.cleanupPending || ['starting', 'running', 'stopping'].includes(this.preview.snapshot.status)) return this.preview.snapshot;
    this.startPending = true;
    const request = ++this.previewRequest;
    try {
      const current = await this.refresh();
      if (!current || this.disposed || request !== this.previewRequest) return this.preview.snapshot;
      if (!vscode.workspace.isTrusted) return this.preview.snapshot;
      const result = await this.preview.start(this.state.project, vscode.workspace.isTrusted);
      if (request === this.previewRequest && !this.disposed && result.rootPath === this.root && result.status === 'running') {
        await this.openCurrentPreview();
      }
      return result;
    } finally { this.startPending = false; }
  }

  private async stopPreview(): Promise<PreviewState> {
    ++this.previewRequest;
    return this.preview.stop();
  }

  private async openCurrentPreview(): Promise<void> {
    const preview = this.preview.snapshot;
    if (preview.status !== 'running' || !preview.url || !this.hasRoot(preview.rootPath ?? '')) return;
    try { await openPreview(preview.url); }
    catch (error) { void vscode.window.showInformationMessage(`Astro Studio: ${(error as Error).message}`); }
  }

  dispose(): Promise<void> {
    if (this.shutdown) return this.shutdown;
    this.disposed = true;
    ++this.generation;
    ++this.previewRequest;
    this.observer.dispose();
    this.content.dispose();
    this.forms.dispose();
    this.shutdown = Promise.resolve(this.preview.dispose());
    // Subscription disposal cannot await; observe failures while deactivate awaits this same promise.
    void this.shutdown.catch(error => console.error('Astro Studio preview shutdown failed:', error));
    this.panel?.dispose();
    for (const registration of this.registrations) registration.dispose();
    this.output.dispose();
    return this.shutdown;
  }
}

let controller: StudioController | undefined;
let deactivation: Promise<void> | undefined;

export function activate(context: vscode.ExtensionContext): void {
  deactivation = undefined;
  controller = new StudioController(context.extensionUri);
  context.subscriptions.push(controller);
}

export function deactivate(): Promise<void> {
  if (controller) {
    deactivation = controller.dispose();
    controller = undefined;
  }
  return deactivation ?? Promise.resolve();
}
