import { beforeEach, expect, it, vi } from 'vitest';
const host = vi.hoisted(() => ({ folders: undefined as unknown, pick: vi.fn() }));
vi.mock('vscode', () => ({
  workspace: { get workspaceFolders() { return host.folders; } },
  window: { showQuickPick: host.pick },
}));
import { selectProject } from '../../src/workspace/select-project';

const folder = (name: string, scheme = 'file') => ({ name, uri: { scheme, fsPath: `/work/${name}` } });
beforeEach(() => { host.folders = undefined; host.pick.mockReset(); });
it('returns no selection with no open workspace', async () => {
  expect(await selectProject()).toBeUndefined();
  expect(host.pick).not.toHaveBeenCalled();
});
it('selects the sole local root without a picker', async () => {
  host.folders = [folder('site')];
  expect(await selectProject()).toBe('/work/site');
});
it('requires an explicit choice for multiple roots', async () => {
  host.folders = [folder('one'), folder('two')];
  host.pick.mockImplementation(async items => items[1]);
  expect(await selectProject()).toBe('/work/two');
  expect(host.pick).toHaveBeenCalledOnce();
});
it('returns no root when a multi-root choice is cancelled', async () => {
  host.folders = [folder('one'), folder('two')];
  expect(await selectProject()).toBeUndefined();
});
it('never treats a virtual URI as a local path', async () => {
  host.folders = [folder('remote', 'vscode-vfs')];
  expect(await selectProject()).toBeUndefined();
});
it('still requires a choice when a multi-root workspace has only one local root', async () => {
  host.folders = [folder('site'), folder('remote', 'vscode-vfs')];
  host.pick.mockImplementation(async items => items[0]);
  expect(await selectProject()).toBe('/work/site');
  expect(host.pick).toHaveBeenCalledOnce();
});
