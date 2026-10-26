import { randomBytes } from 'node:crypto';
import * as vscode from 'vscode';

export function panelHtml(webview: vscode.Webview, assets: vscode.Uri): string {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const script = escape(webview.asWebviewUri(vscode.Uri.joinPath(assets, 'main.js')).toString());
  const stylesheet = escape(webview.asWebviewUri(vscode.Uri.joinPath(assets, 'main.css')).toString());
  const nonce = randomBytes(24).toString('hex');
  const policy = escape(`default-src 'none'; script-src 'nonce-${nonce}'; style-src ${webview.cspSource}; base-uri 'none'; form-action 'none';`);
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${policy}">
<link rel="stylesheet" href="${stylesheet}">
<title>Astro Studio</title>
</head><body><div id="root"></div>
<script nonce="${nonce}" src="${script}"></script>
</body></html>`;
}
