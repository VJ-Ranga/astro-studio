import { beforeEach, expect, it, vi } from 'vitest';
import { ContentDocuments } from '../../src/content/content-documents';
import type { ContentFields, ContentFormSubmission } from '../../src/content/content-types';

const host = vi.hoisted(() => ({
  text: '', version: 1, dirty: false, saves: vi.fn(), edit: vi.fn(),
  show: vi.fn(), open: vi.fn(), rejectEdit: false,
}));
vi.mock('vscode', () => ({
  Uri: { file: (fsPath: string) => ({ fsPath, toString: () => `file://${fsPath}` }) },
  Range: class { constructor(public start: number, public end: number) {} },
  ViewColumn: { Beside: 2 },
  workspace: { openTextDocument: host.open },
  window: { showTextDocument: host.show },
}));

const source = '---\r\ntitle: "Old title" # preserve comment\r\ndraft: false\r\nunknown: [one, two]\r\n---\r\nOriginal body\r\n';
const id = 'a'.repeat(24);
const document = {
  uri: { fsPath: '/site/post.md', toString: () => 'file:///site/post.md' },
  get version() { return host.version; },
  get isDirty() { return host.dirty; },
  getText: () => host.text,
  positionAt: (offset: number) => offset,
  save: host.saves,
};
beforeEach(() => {
  vi.clearAllMocks();
  host.text = source;
  host.version = 1;
  host.dirty = false;
  host.rejectEdit = false;
  host.open.mockReset().mockResolvedValue(document);
  host.edit.mockReset().mockImplementation(async (build: (builder: unknown) => void) => {
    const edits: { start: number; end: number; text: string }[] = [];
    build({ replace: (range: { start: number; end: number }, text: string) => edits.push({ ...range, text }) });
    if (host.rejectEdit) return false;
    for (const edit of edits.sort((a, b) => b.start - a.start)) host.text = host.text.slice(0, edit.start) + edit.text + host.text.slice(edit.end);
    host.version++;
    host.dirty = true;
    return true;
  });
  host.show.mockReset().mockResolvedValue({ document, edit: host.edit });
});
const create = () => new ContentDocuments({ resolveEntry: async () => '/site/post.md' });
const submission = (forms: ContentDocuments, fields: ContentFields): ContentFormSubmission => ({
  id, token: forms.snapshot.token!, documentVersion: forms.snapshot.documentVersion!, fields,
});

it('loads the current dirty buffer and applies one undoable edit without saving', async () => {
  host.text = source.replace('Old title', 'Unsaved title');
  host.version = 3;
  host.dirty = true;
  const forms = create();
  const loaded = await forms.load(id);
  expect(loaded.fields.title).toBe('Unsaved title');
  expect(loaded.documentVersion).toBe(3);
  expect(loaded.token).toMatch(/^[a-f0-9]{32}$/);
  const result = await forms.apply(submission(forms, { title: 'New title', draft: true }));
  expect(result.status).toBe('applied');
  expect(result.dirty).toBe(true);
  expect(host.text).toBe(source.replace('Old title', 'New title').replace('draft: false', 'draft: true'));
  expect(host.edit).toHaveBeenCalledExactlyOnceWith(expect.any(Function), { undoStopBefore: true, undoStopAfter: true });
  expect(host.saves).not.toHaveBeenCalled();
});

it('rejects a stale document version and keeps source unchanged', async () => {
  const forms = create();
  await forms.load(id);
  const request = submission(forms, { title: 'Form title' });
  host.text += 'Concurrent editor change\r\n';
  host.version++;
  const current = host.text;
  await expect(forms.apply(request)).rejects.toThrow('changed');
  expect(forms.snapshot.status).toBe('conflict');
  expect(host.text).toBe(current);
  expect(host.edit).not.toHaveBeenCalled();
});
it('also rejects a changed fingerprint when a document version is reused', async () => {
  const forms = create();
  await forms.load(id);
  host.text += 'Changed without the old version advancing\r\n';
  await expect(forms.apply(submission(forms, { title: 'New' }))).rejects.toThrow('changed');
  expect(host.edit).not.toHaveBeenCalled();
});

it('checks the version again after showing the editor', async () => {
  const forms = create();
  await forms.load(id);
  host.show.mockImplementationOnce(async () => {
    host.version++;
    host.text += 'Changed while editor opened\r\n';
    return { document, edit: host.edit };
  });
  await expect(forms.apply(submission(forms, { title: 'New' }))).rejects.toThrow('changed');
  expect(host.edit).not.toHaveBeenCalled();
});

it('treats native edit rejection as a conflict without retrying', async () => {
  const forms = create();
  await forms.load(id);
  host.rejectEdit = true;
  await expect(forms.apply(submission(forms, { title: 'New' }))).rejects.toThrow('changed');
  expect(host.edit).toHaveBeenCalledTimes(1);
  expect(host.text).toBe(source);
  expect(forms.snapshot.status).toBe('conflict');
});

it('rejects expired sessions and unsupported or missing fields', async () => {
  const forms = create();
  await forms.load(id);
  const expired = submission(forms, { title: 'New' });
  forms.reset();
  await expect(forms.apply(expired)).rejects.toThrow('expired');
  await forms.load(id);
  await expect(forms.apply(submission(forms, { description: 'Missing field' }))).rejects.toThrow('existing');
  expect(host.edit).not.toHaveBeenCalled();
});

it('keeps unsupported current buffers source-only', async () => {
  host.text = '---\r\ntitle: |\r\n  Multiline\r\n---\r\n';
  const forms = create();
  expect((await forms.load(id)).mode).toBe('source-only');
  await expect(forms.apply({ id, token: '0'.repeat(32), documentVersion: 1, fields: { title: 'New' } })).rejects.toThrow();
  expect(host.edit).not.toHaveBeenCalled();
});

it('revalidates current entry authorization before applying', async () => {
  const resolveEntry = vi.fn().mockResolvedValue('/site/post.md');
  const forms = new ContentDocuments({ resolveEntry });
  await forms.load(id);
  resolveEntry.mockRejectedValue(new Error('Entry is no longer authorized'));
  await expect(forms.apply(submission(forms, { title: 'New' }))).rejects.toThrow('authorized');
  expect(host.edit).not.toHaveBeenCalled();
});

it('rejects duplicate apply requests while the first editor edit is pending', async () => {
  const forms = create();
  await forms.load(id);
  const request = submission(forms, { title: 'New' });
  const apply = host.edit.getMockImplementation()!;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  host.edit.mockImplementationOnce(async (...args) => { await pending; return apply(...args); });
  const first = forms.apply(request);
  await vi.waitFor(() => expect(host.edit).toHaveBeenCalledOnce());
  await expect(forms.apply(request)).rejects.toThrow('already in progress');
  release();
  expect((await first).status).toBe('applied');
  expect(host.edit).toHaveBeenCalledOnce();
});
it('reports source changes proactively without replacing the active form token or values', async () => {
  const forms = create();
  const loaded = await forms.load(id);
  host.text = source.replace('Old title', 'External title');
  host.version++;
  host.dirty = true;
  forms.observe(document as unknown as import('vscode').TextDocument, 'change');
  expect(forms.snapshot.status).toBe('conflict');
  expect(forms.snapshot.token).toBe(loaded.token);
  expect(forms.snapshot.fields.title).toBe('Old title');
  expect(forms.snapshot.dirty).toBe(true);
  expect(host.edit).not.toHaveBeenCalled();
});
it('updates saved state without replacing the form token or draft baseline', async () => {
  host.dirty = true;
  const forms = create();
  const loaded = await forms.load(id);
  host.dirty = false;
  forms.observe(document as unknown as import('vscode').TextDocument, 'save');
  expect(forms.snapshot.dirty).toBe(false);
  expect(forms.snapshot.token).toBe(loaded.token);
  expect(forms.snapshot.message).toContain('saved');
});
it('blocks an observed filesystem conflict even if the dirty editor buffer has not reloaded yet', async () => {
  const forms = create();
  await forms.load(id);
  const request = submission(forms, { title: 'Must wait for review' });
  await forms.externalChange('/site/post.md');
  expect(forms.snapshot.status).toBe('conflict');
  await expect(forms.apply(request)).rejects.toThrow('changed');
  expect(host.edit).not.toHaveBeenCalled();
});
