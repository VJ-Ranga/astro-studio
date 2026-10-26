import * as vscode from 'vscode';
import path from 'node:path';
import { isContained } from '../content/content-files';

interface Repository { rootUri: vscode.Uri }
interface GitAPI { repositories: Repository[]; openRepository?: (uri: vscode.Uri) => Promise<Repository | null> }
interface GitExtension { enabled: boolean; getAPI(version: 1): GitAPI }

async function repositoryFor(root: string): Promise<Repository | null> {
  const extension = vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (!extension) {
    void vscode.window.showInformationMessage('Astro Studio: VS Code Git integration is unavailable. Enable the built-in Git extension and install Git.');
    return null;
  }
  const git = await extension.activate();
  if (!git.enabled) {
    void vscode.window.showInformationMessage('Astro Studio: VS Code Git integration is disabled. Enable it to review project changes.');
    return null;
  }
  const api = git.getAPI(1);
  const repository = [...api.repositories].filter(item => item.rootUri.scheme === 'file' && isContained(item.rootUri.fsPath, root))
    .sort((a, b) => b.rootUri.fsPath.length - a.rootUri.fsPath.length)[0]
    ?? await api.openRepository?.(vscode.Uri.file(root));
  if (!repository) void vscode.window.showInformationMessage('Astro Studio: No Git repository found for this project. Initialize one explicitly through VS Code Source Control if desired.');
  return repository ?? null;
}

export async function openSourceControl(root: string): Promise<boolean> {
  const repository = await repositoryFor(root);
  await vscode.commands.executeCommand('workbench.view.scm');
  return !!repository;
}

export async function reviewContentDiff(root: string, file: string): Promise<boolean> {
  if (!isContained(path.resolve(root), path.resolve(file))) throw new Error('Diff file is outside the selected project.');
  if (!await repositoryFor(root)) return false;
  await vscode.commands.executeCommand('git.openChange', vscode.Uri.file(file));
  return true;
}
