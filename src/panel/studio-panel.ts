import * as vscode from 'vscode';
import { panelHtml } from './panel-html';
import { parseWebviewRequest, type HostEvent, type WebviewRequest } from './messages';

export class StudioPanel implements vscode.Disposable {
  private readonly panel: vscode.WebviewPanel;
  private readonly listeners: vscode.Disposable[];
  private closed = false;

  constructor(extensionUri: vscode.Uri, handle: (request: WebviewRequest) => Promise<void>, onClose: () => void) {
    const assets = vscode.Uri.joinPath(extensionUri, 'dist', 'webview');
    this.panel = vscode.window.createWebviewPanel('astroStudio.project', 'Astro Studio', vscode.ViewColumn.One, {
      enableScripts: true, localResourceRoots: [assets], retainContextWhenHidden: true,
    });
    this.listeners = [
      this.panel.webview.onDidReceiveMessage(async (value: unknown) => {
        const request = parseWebviewRequest(value);
        if (!request || this.closed) return;
        await handle(request);
      }),
      this.panel.onDidDispose(() => {
        this.release();
        onClose();
      }),
    ];
    this.panel.webview.html = panelHtml(this.panel.webview, assets);
  }

  reveal(): void { this.panel.reveal(); }

  send(event: HostEvent): void {
    if (!this.closed) void Promise.resolve(this.panel.webview.postMessage(event)).catch(() => undefined);
  }

  private release(): void {
    if (this.closed) return;
    this.closed = true;
    for (const listener of this.listeners) listener.dispose();
  }

  dispose(): void {
    if (this.closed) return;
    this.panel.dispose();
    this.release();
  }
}
