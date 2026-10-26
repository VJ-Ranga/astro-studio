import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as vscode from 'vscode';
import type { StudioState } from '../../src/panel/messages';
import type { PreviewState } from '../../src/preview/preview-types';
import { createRequire } from 'node:module';
import { ContentController } from '../../src/content/content-controller';
import { verifyContentForms } from './content-forms';
import { verifyNativeGit } from './native-git';

async function waitUntil(condition: () => boolean, message: string): Promise<void> {
  const deadline = Date.now() + 3_000;
  while (!condition() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
  assert.ok(condition(), message);
}

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension('astro-studio-local.astro-studio');
  assert.ok(extension, 'The development extension must be discoverable');
  assert.equal(extension.isActive, false, 'Activation should be command-driven');

  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const before = root ? await readFile(path.join(root, 'package.json'), 'utf8') : undefined;
  const livePreview = root?.endsWith('preview site') ?? false;
  const gitFixture = root?.endsWith('git-workflow') ?? false;
  // A command activates the real extension and creates its webview panel.
  const state = await vscode.commands.executeCommand<StudioState>('astroStudio.open');
  assert.equal(extension.isActive, true, 'Open Studio must activate the extension');
  assert.ok(state);
  if (root) {
    assert.equal(state.status, 'discovered');
    assert.equal(state.project?.kind, 'astro');
    assert.equal(state.project.rootPath, root);
    if (state.project.kind === 'astro') {
      assert.equal(state.project.name, livePreview ? 'studio-preview-fixture' : gitFixture ? 'studio-git-fixture' : 'studio-discovery-fixture');
      assert.equal(state.project.packageManager, 'npm');
      assert.equal(state.project.devScript, 'astro dev');
    }
    assert.equal(await readFile(path.join(root, 'package.json'), 'utf8'), before, 'Discovery must not write metadata');
  } else assert.equal(state.status, 'no-folder');

  const studioTabs = () => vscode.window.tabGroups.all.flatMap(group => group.tabs)
    .filter(tab => tab.label === 'Astro Studio');
  await waitUntil(() => studioTabs().length === 1, 'Studio must create one editor panel');
  await vscode.commands.executeCommand('astroStudio.open');
  assert.equal(studioTabs().length, 1, 'Repeated opens must reuse the panel');
  await vscode.window.tabGroups.close(studioTabs());
  assert.equal(studioTabs().length, 0, 'The panel must close');
  await vscode.commands.executeCommand('astroStudio.open');
  await waitUntil(() => studioTabs().length === 1, 'Studio must reopen after panel disposal');

  const expected = ['astroStudio.open', 'astroStudio.startPreview', 'astroStudio.stopPreview'];
  const contributed = extension.packageJSON.contributes.commands.map(
    (command: { command: string }) => command.command,
  );
  assert.deepEqual(contributed, expected);
  const registered = await vscode.commands.getCommands(true);
  for (const command of expected) {
    assert.ok(registered.includes(command), `${command} must be registered`);
    // The metadata-only fixture deliberately has no Astro installation.
    if (command !== 'astroStudio.startPreview') await vscode.commands.executeCommand(command);
  }
  if (livePreview) {
    assert.equal(vscode.workspace.isTrusted, true);
    assert.equal(state.content.status, 'ready');
    assert.equal(state.content.entries.length, 7);
    const welcome = state.content.entries.find(entry => entry.path === 'posts/welcome.md');
    assert.ok(welcome);
    assert.equal(welcome?.mode, 'supported');
    assert.equal(welcome.fields.title, 'Welcome to Astro Studio');
    assert.equal(state.content.entries.find(entry => entry.path.endsWith('.mdx'))?.mode, 'source-only');
    const contentFile = path.join(root!, 'src/content/posts/welcome.md');
    const originalContent = await readFile(contentFile, 'utf8');
    const content = new ContentController({ openDocument: async filePath => {
      await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(vscode.Uri.file(filePath)), { preview: true });
    } });
    try {
      await content.load(root);
      await content.open(welcome.id);
      const editor = vscode.window.activeTextEditor;
      assert.ok(editor);
      assert.equal(editor?.document.uri.fsPath, contentFile);
      assert.equal(editor.document.getText(), originalContent);
      const edit = new vscode.WorkspaceEdit();
      edit.insert(editor.document.uri, new vscode.Position(0, 0), '<!-- unsaved test buffer -->\n');
      assert.ok(await vscode.workspace.applyEdit(edit));
      assert.equal(editor.document.isDirty, true);
      await content.open(welcome.id);
      assert.match(vscode.window.activeTextEditor!.document.getText(), /^<!-- unsaved test buffer -->/);
      assert.equal(await readFile(contentFile, 'utf8'), originalContent, 'Content browser must never save or change source');
      // Revert only this isolated fixture's intentional unsaved test edit.
      await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
      console.log('PASS: content discovery, supported/source-only metadata, native source opening, unchanged bytes, and dirty-buffer preservation');
    } finally { content.dispose(); }
    // Load the same compiled module instance that VS Code activated, not a test bundle copy.
    const hooks = createRequire(__filename)(path.join(extension.extensionPath, 'dist/extension.cjs')) as { deactivate(): Promise<void> };
    try {
      const preview = await vscode.commands.executeCommand<PreviewState>('astroStudio.startPreview');
      assert.equal(preview?.status, 'running', `${preview?.message}\n${preview?.logs.join('\n')}`);
      assert.ok(preview.url);
      assert.match(await (await fetch(preview.url, { signal: AbortSignal.timeout(5_000) })).text(), /Astro Studio preview is running/);
      const duplicate = await vscode.commands.executeCommand<PreviewState>('astroStudio.startPreview');
      assert.equal(duplicate?.url, preview.url);
      await waitUntil(() => vscode.window.tabGroups.all.flatMap(group => group.tabs).some(tab => tab.label === 'Simple Browser' || tab.label.includes('Astro Studio preview fixture') || tab.label.includes(new URL(preview.url!).host)), 'Native browser must open the actual preview');
      await verifyContentForms(root!, preview.url);
      const stopped = await vscode.commands.executeCommand<PreviewState>('astroStudio.stopPreview');
      assert.equal(stopped?.status, 'stopped');
      await assert.rejects(fetch(preview.url, { signal: AbortSignal.timeout(1_000) }));
      const restarted = await vscode.commands.executeCommand<PreviewState>('astroStudio.startPreview');
      assert.equal(restarted?.status, 'running');
      assert.ok(restarted.url);
      assert.match(await (await fetch(restarted.url)).text(), /Astro Studio preview is running/);
      await Promise.all([hooks.deactivate(), hooks.deactivate()]);
      await assert.rejects(fetch(restarted.url, { signal: AbortSignal.timeout(1_000) }));
      console.log(`PASS: real Astro preview, native browser, Stop, restart, and awaited extension deactivation at ${restarted.url}`);
    } finally {
      await hooks.deactivate();
    }
  } else if (gitFixture) {
    await verifyNativeGit(root!);
  } else if (!root) {
    const preview = await vscode.commands.executeCommand<PreviewState>('astroStudio.startPreview');
    assert.equal(preview?.status, 'failed', 'No-folder startup must fail without a process');
  }
  assert.equal(vscode.workspace.textDocuments.filter(document => document.isDirty).length, 0);
  console.log(`PASS: ${root ? 'Astro fixture discovery' : 'no-folder state'}, command activation, panel reuse/close/reopen, and command registration in VS Code ${vscode.version}; trusted=${state.trusted}`);
}
