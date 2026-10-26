import * as vscode from 'vscode';
import { parsePreviewUrl } from './preview-url';

export async function openPreview(url: string): Promise<void> {
  const validated = parsePreviewUrl(`Local ${url}`);
  if (!validated) throw new Error('Preview URL must be a valid local HTTP(S) endpoint.');
  try {
    await vscode.commands.executeCommand('simpleBrowser.show', validated);
  } catch {
    if (!await vscode.env.openExternal(vscode.Uri.parse(validated))) {
      throw new Error('VS Code could not open the preview. Open the local URL shown in Studio.');
    }
  }
}
