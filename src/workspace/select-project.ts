import * as vscode from 'vscode';

export async function selectProject(): Promise<string | undefined> {
  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
  const folders = workspaceFolders.filter(folder => folder.uri.scheme === 'file');
  if (workspaceFolders.length === 1 && folders.length === 1) return folders[0]!.uri.fsPath;
  if (!folders.length) return undefined;
  const choice = await vscode.window.showQuickPick(
    folders.map(folder => ({ label: folder.name, description: folder.uri.fsPath, folder })),
    { title: 'Select an Astro Studio project', placeHolder: 'Choose the local project root to inspect', ignoreFocusOut: true },
  );
  return choice?.folder.uri.fsPath;
}
