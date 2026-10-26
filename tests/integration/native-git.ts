import assert from 'node:assert/strict';
import path from 'node:path';
import * as vscode from 'vscode';
import { openSourceControl, reviewContentDiff } from '../../src/git/native-source-control';

export async function verifyNativeGit(root: string): Promise<void> {
  assert.equal(await openSourceControl(root), true);
  const git = await vscode.extensions.getExtension<any>('vscode.git')!.activate();
  const api = git.getAPI(1);
  const file = path.join(root, 'src/content/post.md');
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline && !api.repositories.some((repo: any) => repo.state.workingTreeChanges.some((change: any) => change.uri.fsPath === file))) {
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.ok(api.repositories.some((repo: any) => repo.state.workingTreeChanges.some((change: any) => change.uri.fsPath === file)), 'Native Git must detect the saved modification');
  assert.equal(await reviewContentDiff(root, file), true);
  const tabDeadline = Date.now() + 3_000;
  while (Date.now() < tabDeadline && !vscode.window.tabGroups.all.flatMap(group => group.tabs).some(tab => tab.input instanceof vscode.TabInputTextDiff)) {
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.ok(vscode.window.tabGroups.all.flatMap(group => group.tabs).some(tab => tab.input instanceof vscode.TabInputTextDiff), 'Native Git diff must open');
  console.log('PASS: disposable real Git repository, native Source Control, saved change detection, and native diff editor');
}
