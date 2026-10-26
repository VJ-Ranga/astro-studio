import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionContext } from 'vscode';
import type { StudioState } from '../../src/panel/messages';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const host = vi.hoisted(() => ({
  commands: new Map<string, () => unknown>(),
  output: { appendLine: vi.fn(), replace: vi.fn(), show: vi.fn(), dispose: vi.fn() },
  showInformationMessage: vi.fn(),
  folders: undefined as undefined | { uri: { scheme: string; fsPath: string } }[],
  workspaceChange: undefined as undefined | (() => void),
  trustChange: undefined as undefined | (() => void),
  trusted: false,
  panels: [] as any[],
  discover: vi.fn(), select: vi.fn(),
  launch: vi.fn(), stop: vi.fn(), browser: vi.fn(), disposePreview: vi.fn(),
  previewState: { status: 'stopped', rootPath: null, url: null, message: null, logs: [] } as import('../../src/preview/preview-types').PreviewState,
  previewOptions: undefined as undefined | import('../../src/preview/dev-server').DevServerOptions,
  openDocument: vi.fn(), showDocument: vi.fn(),
}));

vi.mock('../../src/workspace/discover-project', () => ({ discoverProject: host.discover }));
vi.mock('../../src/workspace/select-project', () => ({ selectProject: host.select }));
vi.mock('../../src/preview/open-preview', () => ({ openPreview: host.browser }));
vi.mock('../../src/preview/dev-server', () => ({
  DevServerController: class {
    constructor(options: import('../../src/preview/dev-server').DevServerOptions) { host.previewOptions = options; }
    get snapshot() { return host.previewState; }
    start = host.launch;
    stop = host.stop;
    dispose = host.disposePreview;
  },
}));
vi.mock('vscode', () => ({
  commands: {
    registerCommand: (id: string, handler: () => unknown) => {
      if (host.commands.has(id)) throw new Error(`Duplicate command: ${id}`);
      host.commands.set(id, handler);
      return { dispose: () => host.commands.delete(id) };
    },
  },
  workspace: {
    get workspaceFolders() { return host.folders; },
    get isTrusted() { return host.trusted; },
    openTextDocument: host.openDocument,
    onDidChangeTextDocument: () => ({ dispose: vi.fn() }),
    onDidSaveTextDocument: () => ({ dispose: vi.fn() }),
    createFileSystemWatcher: () => ({ onDidChange: () => ({ dispose: vi.fn() }), onDidCreate: () => ({ dispose: vi.fn() }), onDidDelete: () => ({ dispose: vi.fn() }), dispose: vi.fn() }),
    onDidChangeWorkspaceFolders: (listener: () => void) => {
      host.workspaceChange = listener;
      return { dispose: vi.fn() };
    },
    onDidGrantWorkspaceTrust: (listener: () => void) => {
      host.trustChange = listener;
      return { dispose: vi.fn() };
    },
  },
  ViewColumn: { One: 1, Beside: 2 },
  Range: class { constructor(public start: number, public end: number) {} },
  RelativePattern: class { constructor(public base: string, public pattern: string) {} },
  Uri: {
    joinPath: (_base: unknown, ...segments: string[]) => ({ toString: () => `https://local/${segments.join('/')}` }),
    file: (fsPath: string) => ({ fsPath }),
  },
  window: {
    createOutputChannel: () => host.output,
    showInformationMessage: host.showInformationMessage,
    showTextDocument: host.showDocument,
    createWebviewPanel: (_type: string, _title: string, _column: number, options: unknown) => {
      let close: () => void;
      const panel = {
        options,
        webview: {
          html: '', cspSource: 'https://local',
          asWebviewUri: (uri: unknown) => uri,
          postMessage: vi.fn().mockResolvedValue(true),
          onDidReceiveMessage: (listener: (message: unknown) => unknown) => {
            panel.receive = listener;
            return { dispose: vi.fn() };
          },
        },
        reveal: vi.fn(),
        receive: (_message: unknown): unknown => undefined,
        onDidDispose: (listener: () => void) => { close = listener; return { dispose: vi.fn() }; },
        dispose: vi.fn(() => close?.()),
      };
      host.panels.push(panel);
      return panel;
    },
  },
}));

import { activate, deactivate } from '../../src/extension';
const folder = (fsPath: string) => ({ uri: { scheme: 'file', fsPath } });
function context(): ExtensionContext {
  return { subscriptions: [], extensionUri: {} } as unknown as ExtensionContext;
}
const open = () => host.commands.get('astroStudio.open')!() as Promise<StudioState>;
const lastState = (): StudioState => host.panels.at(-1).webview.postMessage.mock.calls.at(-1)[0].state;

describe('project panel lifecycle', () => {
  beforeEach(async () => {
    await deactivate();
    host.commands.clear();
    host.panels.length = 0;
    host.folders = undefined;
    host.trusted = false;
    vi.clearAllMocks();
    host.select.mockReset();
    host.discover.mockReset().mockImplementation(async rootPath => ({ kind: 'not-astro', rootPath, diagnostics: [] }));
    host.previewState = { status: 'stopped', rootPath: null, url: null, message: null, logs: [] };
    host.launch.mockReset().mockImplementation(async () => {
      host.previewState = { status: 'running', rootPath: '/site', url: 'http://127.0.0.1:4322/', message: null, logs: [] };
      host.previewOptions?.onState?.(host.previewState);
      return host.previewState;
    });
    host.stop.mockReset().mockImplementation(async () => {
      host.previewState = { status: 'stopped', rootPath: null, url: null, message: null, logs: [] };
      host.previewOptions?.onState?.(host.previewState);
      return host.previewState;
    });
    host.disposePreview.mockReset().mockResolvedValue(undefined);
  });

  it('opens a reusable no-folder panel with a restrictive local-asset shell', async () => {
    activate(context());
    expect((await open()).status).toBe('no-folder');
    await open();
    expect(host.panels).toHaveLength(1);
    const panel = host.panels[0];
    expect(panel.reveal).toHaveBeenCalled();
    expect(panel.webview.html).toContain("default-src 'none'");
    expect(panel.webview.html).toContain("script-src 'nonce-");
    expect(panel.webview.html).not.toContain('unsafe-inline');
    expect(panel.options).toMatchObject({ retainContextWhenHidden: true });
    await panel.receive({ version: 1, type: 'ready' });
    expect(lastState()).toMatchObject({ status: 'no-folder', trusted: false, project: null });
  });

  it('discovers only a host-selected root and rejects extra request payloads', async () => {
    host.folders = [folder('/site')];
    host.select.mockResolvedValue('/site');
    activate(context());
    expect((await open()).project?.rootPath).toBe('/site');
    expect(host.discover).toHaveBeenCalledWith('/site');
    await host.panels[0].receive({ version: 1, type: 'refreshProject', rootPath: '/etc' });
    expect(host.discover).toHaveBeenCalledTimes(1);
    await host.panels[0].receive({ version: 1, type: 'refreshProject' });
    expect(host.discover).toHaveBeenCalledTimes(2);
  });

  it('preserves the selected root when a new selection is cancelled', async () => {
    host.folders = [folder('/one'), folder('/two')];
    host.select.mockResolvedValueOnce('/two').mockResolvedValue(undefined);
    activate(context());
    await open();
    await host.panels[0].receive({ version: 1, type: 'selectProject' });
    expect(lastState().project?.rootPath).toBe('/two');
  });

  it('shows selection-required after cancelling the initial multi-root choice', async () => {
    host.folders = [folder('/one'), folder('/two')];
    activate(context());
    expect((await open()).status).toBe('selection-required');
    expect(host.discover).not.toHaveBeenCalled();
  });

  it('invalidates a pending read when the selected folder is removed', async () => {
    host.folders = [folder('/old')];
    host.select.mockResolvedValue('/old');
    let resolve!: (value: unknown) => void;
    host.discover.mockReturnValue(new Promise(done => { resolve = done; }));
    activate(context());
    const opening = open();
    await vi.waitFor(() => expect(host.discover).toHaveBeenCalled());
    host.folders = undefined;
    host.workspaceChange?.();
    resolve({ kind: 'not-astro', rootPath: '/old', diagnostics: [] });
    await opening;
    expect(lastState()).toMatchObject({ status: 'no-folder', project: null });
  });

  it('does not allow a slower refresh to overwrite a newer result', async () => {
    host.folders = [folder('/site')];
    host.select.mockResolvedValue('/site');
    activate(context());
    await open();
    let resolve!: (value: unknown) => void;
    host.discover.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const slow = host.panels[0].receive({ version: 1, type: 'refreshProject' });
    await vi.waitFor(() => expect(host.discover).toHaveBeenCalledTimes(2));
    await host.panels[0].receive({ version: 1, type: 'refreshProject' });
    resolve({ kind: 'invalid', rootPath: '/old-result', diagnostics: [] });
    await slow;
    expect(lastState().project?.rootPath).toBe('/site');
  });

  it('closes, reopens, and disposes panel resources idempotently', async () => {
    const activation = context();
    activate(activation);
    await open();
    host.panels[0].dispose();
    await open();
    expect(host.panels).toHaveLength(2);
    activation.subscriptions[0]!.dispose();
    await deactivate();
    expect(host.commands.size).toBe(0);
    expect(host.output.dispose).toHaveBeenCalledTimes(1);
    expect(host.disposePreview).toHaveBeenCalledTimes(1);
    expect(host.panels[1].dispose).toHaveBeenCalledTimes(1);
  });

  it('blocks preview startup from an untrusted workspace at the host boundary', async () => {
    activate(context());
    await host.commands.get('astroStudio.startPreview')!();
    expect(host.launch).not.toHaveBeenCalled();
    expect(host.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('trusted workspace'));
  });

  it('launches a freshly discovered trusted project and opens only its actual URL', async () => {
    host.trusted = true;
    host.folders = [folder('/site')];
    host.select.mockResolvedValue('/site');
    host.discover.mockResolvedValue({ kind: 'astro', rootPath: '/site', diagnostics: [], name: 'site', astroVersion: '*', packageManager: 'npm', packageManagerSource: 'declaration', devScript: 'astro dev' });
    activate(context());
    await open();
    await host.commands.get('astroStudio.startPreview')!();
    expect(host.discover).toHaveBeenCalledTimes(2);
    expect(host.launch).toHaveBeenCalledWith(expect.objectContaining({ rootPath: '/site', kind: 'astro' }), true);
    expect(host.browser).toHaveBeenCalledWith('http://127.0.0.1:4322/');
    await host.panels[0].receive({ version: 1, type: 'openPreview', url: 'https://evil.example' });
    expect(host.browser).toHaveBeenCalledTimes(1);
    await host.panels[0].receive({ version: 1, type: 'showPreviewLogs' });
    expect(host.output.show).toHaveBeenCalledWith(true);
  });

  it('cancels pending startup when Stop is requested during discovery', async () => {
    host.trusted = true;
    host.folders = [folder('/site')];
    host.select.mockResolvedValue('/site');
    activate(context());
    await open();
    let resolve!: (value: unknown) => void;
    host.discover.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const starting = host.commands.get('astroStudio.startPreview')!();
    await vi.waitFor(() => expect(host.discover).toHaveBeenCalledTimes(2));
    await host.commands.get('astroStudio.stopPreview')!();
    resolve({ kind: 'astro', rootPath: '/site', diagnostics: [] });
    await starting;
    expect(host.launch).not.toHaveBeenCalled();
  });

  it('rechecks trust after asynchronous discovery', async () => {
    host.trusted = true;
    host.folders = [folder('/site')];
    host.select.mockResolvedValue('/site');
    host.discover.mockImplementation(async rootPath => {
      host.trusted = false;
      return { kind: 'not-astro', rootPath, diagnostics: [] };
    });
    activate(context());
    await host.commands.get('astroStudio.startPreview')!();
    expect(host.launch).not.toHaveBeenCalled();
  });

  it('awaits owned preview shutdown during extension deactivation', async () => {
    let resolve!: () => void;
    host.disposePreview.mockReturnValue(new Promise<void>(done => { resolve = done; }));
    activate(context());
    let complete = false;
    const closing = Promise.resolve(deactivate()).then(() => { complete = true; });
    let secondComplete = false;
    const secondClosing = Promise.resolve(deactivate()).then(() => { secondComplete = true; });
    await new Promise<void>(done => setImmediate(done));
    expect(complete).toBe(false);
    expect(secondComplete).toBe(false);
    resolve();
    await Promise.all([closing, secondClosing]);
    expect(complete).toBe(true);
    expect(host.disposePreview).toHaveBeenCalledTimes(1);
  });

  it('does not assign a selected root that disappears during old-preview cleanup', async () => {
    host.folders = [folder('/old'), folder('/new')];
    host.select.mockResolvedValueOnce('/old').mockResolvedValueOnce('/new');
    activate(context());
    await open();
    let resolve!: (value: unknown) => void;
    host.stop.mockReturnValueOnce(new Promise(done => { resolve = done; }));
    const choosing = host.panels[0].receive({ version: 1, type: 'selectProject' });
    await vi.waitFor(() => expect(host.stop).toHaveBeenCalledOnce());
    host.folders = [folder('/old')];
    resolve(host.previewState);
    await choosing;
    expect(host.discover).not.toHaveBeenCalledWith('/new');
    expect(lastState().project?.rootPath).toBe('/old');
  });

  it('does not switch roots while previous preview cleanup remains incomplete', async () => {
    host.folders = [folder('/old'), folder('/new')];
    host.select.mockResolvedValueOnce('/old').mockResolvedValueOnce('/new');
    activate(context());
    await open();
    host.previewState = { status: 'failed', rootPath: '/old', url: null, message: 'Cleanup failed', logs: [], cleanupPending: true };
    host.stop.mockResolvedValueOnce(host.previewState);
    await host.panels[0].receive({ version: 1, type: 'selectProject' });
    expect(lastState().project?.rootPath).toBe('/old');
    expect(host.discover).not.toHaveBeenCalledWith('/new');
  });

  it('stops the old preview before discovering a different selected root', async () => {
    host.folders = [folder('/old'), folder('/new')];
    host.select.mockResolvedValueOnce('/old').mockResolvedValueOnce('/new');
    activate(context());
    await open();
    await host.panels[0].receive({ version: 1, type: 'selectProject' });
    expect(host.stop).toHaveBeenCalledOnce();
    expect(lastState().project?.rootPath).toBe('/new');
  });

  it('routes authorized source/form actions to the native editor and rejects unknown IDs', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'studio source action '));
    try {
      await mkdir(path.join(root, 'src/content'), { recursive: true });
      await writeFile(path.join(root, 'src/content/post.md'), '---\ntitle: Current entry\n---\nOriginal body');
      host.folders = [folder(root)];
      host.select.mockResolvedValue(root);
      host.discover.mockResolvedValue({ kind: 'astro', rootPath: root, diagnostics: [], name: 'site', astroVersion: '*', packageManager: 'npm', devScript: 'astro dev' });
      host.openDocument.mockResolvedValue({ uri: 'current-document' });
      activate(context());
      const state = await open();
      expect(state.content.entries).toHaveLength(1);
      await host.panels[0].receive({ version: 1, type: 'openContent', id: state.content.entries[0]!.id });
      expect(host.openDocument).toHaveBeenCalledWith({ fsPath: path.join(root, 'src/content/post.md') });
      expect(host.showDocument).toHaveBeenCalledWith({ uri: 'current-document' }, { preview: true });
      await host.panels[0].receive({ version: 1, type: 'openContent', id: '0'.repeat(24) });
      expect(host.openDocument).toHaveBeenCalledOnce();
      expect(host.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('current scan'));
      let text = '---\ntitle: Current entry\n---\nOriginal body';
      let version = 1;
      const save = vi.fn();
      const document = {
        uri: { fsPath: path.join(root, 'src/content/post.md'), toString: () => `file://${root}/src/content/post.md` },
        getText: () => text, get version() { return version; }, get isDirty() { return version > 1; },
        positionAt: (offset: number) => offset, save,
      };
      const edit = vi.fn(async (build: (builder: unknown) => void) => {
        build({ replace: (range: { start: number; end: number }, value: string) => {
          text = text.slice(0, range.start) + value + text.slice(range.end);
        } });
        version++;
        return true;
      });
      host.openDocument.mockResolvedValue(document);
      host.showDocument.mockResolvedValue({ document, edit });
      const id = state.content.entries[0]!.id;
      await host.panels[0].receive({ version: 1, type: 'editContent', id });
      const form = lastState().content.form!;
      expect(form.fields.title).toBe('Current entry');
      await host.panels[0].receive({ version: 1, type: 'applyContent', id, token: form.token, documentVersion: form.documentVersion, fields: { title: 'Applied title' } });
      expect(lastState().content.form?.status).toBe('applied');
      expect(text).toContain('title: "Applied title"');
      expect(edit).toHaveBeenCalledOnce();
      expect(save).not.toHaveBeenCalled();
      await host.panels[0].receive({ version: 1, type: 'applyContent', id, token: form.token, documentVersion: form.documentVersion, fields: { title: 'Forged' }, path: '/etc/passwd' });
      expect(edit).toHaveBeenCalledOnce();
    } finally {
      await deactivate();
      await rm(root, { recursive: true, force: true });
    }
  });
});
