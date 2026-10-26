import { emptyContentForm, type ContentFormState, type ContentFormSubmission } from './content-types';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import * as vscode from 'vscode';
import { analyzeContent } from './frontmatter';
import { planContentEdits } from './content-edits';
import { readContentFile } from './content-files';

export interface ContentDocumentOptions {
  resolveEntry: (id: string) => Promise<string>;
  onState?: () => void;
}
interface FormSession {
  id: string;
  token: string;
  filePath: string;
  uri: string;
  version: number;
  hash: string;
}
class ContentConflict extends Error {}
const fingerprint = (source: string) => createHash('sha256').update(source).digest('hex');

export class ContentDocuments {
  private state = emptyContentForm();
  private session: FormSession | undefined;
  private generation = 0;
  private disposed = false;
  private busy = false;
  constructor(private readonly options: ContentDocumentOptions) {}
  get snapshot(): ContentFormState { return { ...this.state, fields: { ...this.state.fields }, diagnostics: [...this.state.diagnostics] }; }
  private publish(): void { if (!this.disposed) this.options.onState?.(); }

  private capture(id: string, filePath: string, document: vscode.TextDocument, status: 'ready' | 'applied', message: string | null): void {
    const source = document.getText();
    if (Buffer.byteLength(source, 'utf8') > 1_048_576) throw new Error('Document exceeds the 1 MiB editing limit. Open source to review it.');
    const analysis = analyzeContent(source, path.extname(filePath));
    const token = analysis.mode === 'supported' ? randomBytes(16).toString('hex') : null;
    this.session = token ? { id, token, filePath, uri: document.uri.toString(), version: document.version, hash: fingerprint(source) } : undefined;
    this.state = {
      status, id, token, documentVersion: document.version, fields: analysis.fields,
      mode: analysis.mode, diagnostics: analysis.diagnostics, dirty: document.isDirty, message,
    };
    this.publish();
  }

  async load(id: string): Promise<ContentFormState> {
    if (this.disposed) throw new Error('Form session expired. Reopen Studio.');
    const generation = ++this.generation;
    this.session = undefined;
    this.state = { ...emptyContentForm(), status: 'loading', id };
    this.publish();
    try {
      const filePath = await this.options.resolveEntry(id);
      if (generation !== this.generation || this.disposed) throw new Error('Form session expired because the selected project changed.');
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
      if (generation !== this.generation || this.disposed) throw new Error('Form session expired because the selected project changed.');
      this.capture(id, filePath, document, 'ready', null);
      return this.snapshot;
    } catch (error) {
      if (generation === this.generation && !this.disposed) {
        this.state = { ...this.state, status: 'error', message: (error as Error).message };
        this.publish();
      }
      throw error;
    }
  }

  private check(session: FormSession, document: vscode.TextDocument): void {
    if (this.disposed || this.session !== session) throw new Error('Form session expired. Reload fields before applying.');
    if (document.uri.toString() !== session.uri || document.version !== session.version || fingerprint(document.getText()) !== session.hash) {
      throw new ContentConflict('The document changed since this form loaded. Your form draft is kept; reload fields to review the current buffer.');
    }
  }

  async apply(request: ContentFormSubmission): Promise<ContentFormState> {
    const session = this.session;
    if (this.disposed || !session || session.id !== request.id || session.token !== request.token) throw new Error('Form session expired. Reload fields before applying.');
    if (this.state.status === 'conflict') throw new ContentConflict('The source changed. Reload fields before applying; your form draft is kept.');
    if (this.busy) throw new Error('An apply operation is already in progress.');
    this.busy = true;
    this.state = { ...this.state, status: 'applying', message: null };
    this.publish();
    try {
      if (request.documentVersion !== session.version) throw new ContentConflict('The document version changed. Reload fields before applying.');
      const filePath = await this.options.resolveEntry(request.id);
      if (filePath !== session.filePath) throw new Error('Content authorization changed. Reload fields before applying.');
      if (this.disposed || this.session !== session) throw new Error('Form session expired. Reload fields before applying.');
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
      this.check(session, document);
      const replacements = planContentEdits(document.getText(), request.fields, path.extname(filePath));
      if (!replacements.length) {
        this.capture(request.id, filePath, document, 'ready', 'No field changes to apply.');
        return this.snapshot;
      }
      const editor = await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true, preview: false });
      this.check(session, editor.document);
      // No await between the final version check and the version-bound native edit.
      const applied = await editor.edit(builder => {
        for (const edit of replacements) builder.replace(new vscode.Range(document.positionAt(edit.start), document.positionAt(edit.end)), edit.text);
      }, { undoStopBefore: true, undoStopAfter: true });
      if (!applied) throw new ContentConflict('The document changed while applying. No stale replacements were retried; reload fields to review the current buffer.');
      if (this.session !== session || this.disposed) throw new Error('Form session expired after the editor operation. Review the open source document.');
      this.capture(request.id, filePath, document, 'applied', 'Applied to the editor without saving. Select the opened source editor and use Save in VS Code to update the preview.');
      return this.snapshot;
    } catch (error) {
      if (this.session === session && !this.disposed) {
        this.state = { ...this.state, status: error instanceof ContentConflict ? 'conflict' : 'error', message: (error as Error).message };
        this.publish();
      }
      throw error;
    } finally { this.busy = false; }
  }

  reset(): void {
    ++this.generation;
    this.session = undefined;
    this.state = emptyContentForm();
    this.publish();
  }
  observe(document: vscode.TextDocument, reason: 'change' | 'save'): void {
    const session = this.session;
    if (this.disposed || this.busy || !session || document.uri.toString() !== session.uri) return;
    const changed = document.version !== session.version || fingerprint(document.getText()) !== session.hash;
    this.state = { ...this.state, dirty: document.isDirty };
    if (changed) {
      this.state = { ...this.state, status: 'conflict', message: 'The source document changed. Your form draft is kept; reload fields to review the current buffer.' };
    } else if (reason === 'save') {
      this.state = { ...this.state, status: this.state.status === 'applied' ? 'applied' : 'ready', message: 'Source saved in VS Code. Form changes are applied only with Apply to editor.' };
    }
    this.publish();
  }

  async externalChange(filePath: string): Promise<void> {
    const session = this.session;
    if (this.disposed || this.busy || !session || path.resolve(filePath) !== session.filePath) return;
    try {
      const authorized = await this.options.resolveEntry(session.id);
      const source = await readContentFile(authorized);
      if (this.disposed || this.busy || this.session !== session) return;
      if (fingerprint(source) === session.hash) return;
      this.state = { ...this.state, status: 'conflict', message: 'The saved source changed externally. Your form draft is kept; reload fields to review the current buffer.' };
    } catch {
      if (this.disposed || this.session !== session) return;
      this.state = { ...this.state, status: 'conflict', message: 'The source file is no longer available or authorized. Your form draft is kept; refresh content before reloading.' };
    }
    this.publish();
  }
  dispose(): void { this.disposed = true; this.reset(); }
}
