import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const host = vi.hoisted(() => ({ changeDocument: undefined as any, saveDocument: undefined as any, watchers: [] as any[] }));
vi.mock('vscode', () => ({
  RelativePattern: class { constructor(public base: string, public pattern: string) {} },
  workspace: {
    onDidChangeTextDocument: (listener: unknown) => { host.changeDocument = listener; return { dispose: vi.fn() }; },
    onDidSaveTextDocument: (listener: unknown) => { host.saveDocument = listener; return { dispose: vi.fn() }; },
    createFileSystemWatcher: () => {
      const watcher = {
        change: undefined as any, create: undefined as any, remove: undefined as any,
        onDidChange(listener: unknown) { this.change = listener; return { dispose: vi.fn() }; },
        onDidCreate(listener: unknown) { this.create = listener; return { dispose: vi.fn() }; },
        onDidDelete(listener: unknown) { this.remove = listener; return { dispose: vi.fn() }; },
        dispose: vi.fn(),
      };
      host.watchers.push(watcher);
      return watcher;
    },
  },
}));
import { ContentObserver } from '../../src/content/content-observer';
beforeEach(() => { vi.useFakeTimers(); host.watchers.length = 0; });
afterEach(() => { vi.useRealTimers(); });
it('observes only selected content and debounces saved-file refreshes', async () => {
  const refresh = vi.fn().mockResolvedValue(undefined);
  const document = vi.fn();
  const file = vi.fn().mockResolvedValue(undefined);
  const observer = new ContentObserver({ refresh, document, file });
  observer.setRoot('/site');
  const uri = { scheme: 'file', fsPath: '/site/src/content/post.md' };
  host.changeDocument({ document: { uri } });
  host.saveDocument({ uri });
  host.watchers[0].change(uri);
  host.watchers[0].create(uri);
  host.saveDocument({ uri: { scheme: 'file', fsPath: '/other/post.md' } });
  await vi.advanceTimersByTimeAsync(200);
  expect(document).toHaveBeenCalledTimes(2);
  expect(refresh).toHaveBeenCalledOnce();
  expect(file).toHaveBeenCalledWith(uri.fsPath);
  expect(file).toHaveBeenCalledOnce();
  observer.dispose();
});
it('disposes old-root watchers and cancels queued refreshes on shutdown', async () => {
  const refresh = vi.fn().mockResolvedValue(undefined);
  const observer = new ContentObserver({ refresh, document: vi.fn(), file: vi.fn() });
  observer.setRoot('/one');
  const first = host.watchers[0];
  first.change({ scheme: 'file', fsPath: '/one/src/content/post.md' });
  observer.setRoot('/two');
  expect(first.dispose).toHaveBeenCalledOnce();
  observer.dispose();
  await vi.advanceTimersByTimeAsync(200);
  expect(refresh).not.toHaveBeenCalled();
  expect(host.watchers[1].dispose).toHaveBeenCalledOnce();
});
