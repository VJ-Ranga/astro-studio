import assert from 'node:assert/strict';
import * as vscode from 'vscode';
import type { StudioState } from '../../src/panel/messages';
import type { PreviewState } from '../../src/preview/preview-types';

export async function run(): Promise<void> {
  assert.equal(vscode.workspace.isTrusted, false, 'This profile must actually run in Restricted Mode');
  const state = await vscode.commands.executeCommand<StudioState>('astroStudio.open');
  assert.equal(state?.trusted, false);
  assert.equal(state.project?.kind, 'astro');
  assert.equal(state.content.entries.length, 7);
  const preview = await vscode.commands.executeCommand<PreviewState>('astroStudio.startPreview');
  assert.equal(preview?.status, 'stopped');
  assert.equal(preview.url, null);
  assert.equal(preview.rootPath, null);
  console.log(`PASS: installed extension in actual Restricted Mode, read-only discovery, and blocked project execution in VS Code ${vscode.version}`);
}
