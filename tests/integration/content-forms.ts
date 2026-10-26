import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as vscode from 'vscode';
import { ContentController } from '../../src/content/content-controller';
import { ContentDocuments } from '../../src/content/content-documents';
import type { ContentFields, ContentFormState } from '../../src/content/content-types';
import { ContentObserver } from '../../src/content/content-observer';

const submission = (form: ContentFormState, fields: ContentFields) => {
  assert.ok(form.id && form.token && form.documentVersion !== null);
  return { id: form.id, token: form.token, documentVersion: form.documentVersion, fields };
};

async function waitForTitle(url: string, title: string): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
    if (response.ok && (await response.text()).includes(title)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.fail(`Saved title did not appear in Astro preview: ${title}`);
}

async function waitForBuffer(document: vscode.TextDocument, expected: string, message: string): Promise<void> {
  const started = Date.now();
  const deadline = started + 3_000;
  while (document.getText() !== expected && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
  if (Date.now() > started + 10) console.log(`Native document update observed after ${Date.now() - started} ms; active=${vscode.window.activeTextEditor?.document.uri.fsPath}`);
  assert.equal(document.getText(), expected, message);
}

export async function verifyContentForms(root: string, previewUrl: string): Promise<void> {
  const content = new ContentController({ openDocument: async () => undefined });
  const forms = new ContentDocuments({ resolveEntry: id => content.resolve(id) });
  const observer = new ContentObserver({ refresh: () => content.refresh(), document: (document, reason) => forms.observe(document, reason), file: file => forms.externalChange(file) });
  observer.setRoot(root);
  const file = path.join(root, 'src/content/posts/welcome.md');
  const originalBytes = await readFile(file);
  const original = originalBytes.toString('utf8');
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
  const focus = () => vscode.window.showTextDocument(document, { preview: false });
  try {
    await content.load(root);
    const entry = content.snapshot.entries.find(item => item.path === 'posts/welcome.md');
    assert.ok(entry);
    const loaded = await forms.load(entry.id);
    assert.equal(loaded.mode, 'supported');
    const first = await forms.apply(submission(loaded, { title: 'Day 6 unsaved title', draft: true }));
    assert.equal(first.status, 'applied');
    assert.equal(document.isDirty, true);
    assert.equal(document.getText(), original.replace('"Welcome to Astro Studio"', '"Day 6 unsaved title"').replace('draft: false', 'draft: true'));
    assert.deepEqual(await readFile(file), originalBytes, 'Applying must not save any source');
    const dirty = await forms.load(entry.id);
    assert.equal(dirty.fields.title, 'Day 6 unsaved title');
    assert.equal(dirty.dirty, true);
    await focus();
    await vscode.commands.executeCommand('undo');
    await waitForBuffer(document, original, 'One undo must restore all form scalar edits');

    const stale = await forms.load(entry.id);
    const editor = await focus();
    await editor.edit(builder => builder.insert(document.positionAt(document.getText().length), '\nConcurrent source edit\n'), { undoStopBefore: true, undoStopAfter: true });
    const concurrent = document.getText();
    assert.equal(forms.snapshot.status, 'conflict', 'Editor changes must be observed before Apply');
    await assert.rejects(forms.apply(submission(stale, { title: 'Must not overwrite concurrent source' })), /changed/);
    assert.equal(document.getText(), concurrent);
    assert.equal(forms.snapshot.status, 'conflict');
    await focus();
    await vscode.commands.executeCommand('undo');
    await waitForBuffer(document, original, 'Undo must restore the concurrent source-edit fixture');

    const externalBaseline = await forms.load(entry.id);
    await writeFile(file, original.replace('"Welcome to Astro Studio"', '"External filesystem title"'));
    const observedDeadline = Date.now() + 5_000;
    while (Date.now() < observedDeadline && (forms.snapshot.status !== 'conflict' || content.snapshot.entries.find(item => item.id === entry.id)?.fields.title !== 'External filesystem title')) {
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.equal(forms.snapshot.status, 'conflict');
    assert.equal(forms.snapshot.token, externalBaseline.token);
    assert.equal(content.snapshot.entries.find(item => item.id === entry.id)?.fields.title, 'External filesystem title');
    await assert.rejects(forms.apply(submission(externalBaseline, { title: 'Must not overwrite external source' })), /changed/);
    const restore = await focus();
    await restore.edit(builder => builder.replace(new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), original), { undoStopBefore: true, undoStopAfter: true });
    await document.save();

    const sourceOnly = content.snapshot.entries.find(item => item.path === 'source-only/aliases.md');
    assert.ok(sourceOnly);
    const unsupported = await forms.load(sourceOnly.id);
    assert.equal(unsupported.mode, 'source-only');
    assert.equal(unsupported.token, null);
    await assert.rejects(forms.apply({ id: sourceOnly.id, token: '0'.repeat(32), documentVersion: unsupported.documentVersion!, fields: { title: 'Rejected' } }));

    const fresh = await forms.load(entry.id);
    await forms.apply(submission(fresh, { title: 'Day 6 saved preview title' }));
    assert.deepEqual(await readFile(file), originalBytes);
    const beforeSave = await (await fetch(previewUrl)).text();
    assert.ok(beforeSave.includes('Welcome to Astro Studio') && !beforeSave.includes('Day 6 saved preview title'));
    assert.equal(await document.save(), true, 'This explicit test action simulates the user saving in VS Code');
    assert.equal(forms.snapshot.dirty, false);
    await waitForTitle(previewUrl, 'Day 6 saved preview title');
    const listDeadline = Date.now() + 5_000;
    while (Date.now() < listDeadline && content.snapshot.entries.find(item => item.id === entry.id)?.fields.title !== 'Day 6 saved preview title') await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(content.snapshot.entries.find(item => item.id === entry.id)?.fields.title, 'Day 6 saved preview title');
    assert.notEqual(forms.snapshot.status, 'conflict', 'A normal explicit save must not create a false external conflict');
    assert.equal(await readFile(file, 'utf8'), original.replace('"Welcome to Astro Studio"', '"Day 6 saved preview title"'));
    console.log('PASS: native form apply/undo, proactive editor conflict, external-save refresh, preserved form token, explicit Save, saved-state observation, and live Astro title update');
  } finally {
    observer.dispose();
    forms.dispose();
    // Restore only the fixture edited intentionally by this test, through the native document API.
    if (document.getText() !== original) {
      const editor = await focus();
      assert.ok(await editor.edit(builder => builder.replace(new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), original), { undoStopBefore: true, undoStopAfter: true }));
    }
    if (document.isDirty) assert.ok(await document.save());
    assert.deepEqual(await readFile(file), originalBytes, 'Fixture bytes must be restored after verification');
    content.dispose();
  }
}
