import { beforeEach, expect, it, vi } from 'vitest';
const host = vi.hoisted(() => ({ command: vi.fn(), message: vi.fn(), repositories: [] as any[], open: vi.fn() }));
vi.mock('vscode', () => ({
  extensions: { getExtension: () => ({ activate: async () => ({ enabled: true, getAPI: () => ({ repositories: host.repositories, openRepository: host.open }) }) }) },
  commands: { executeCommand: host.command },
  window: { showInformationMessage: host.message },
  Uri: { file: (fsPath: string) => ({ fsPath }) },
}));
import { openSourceControl, reviewContentDiff } from '../../src/git/native-source-control';
beforeEach(() => { vi.clearAllMocks(); host.repositories = []; host.open.mockReset().mockResolvedValue(null); });
it('hands current project changes to native Source Control and diff commands', async () => {
  host.repositories = [{ rootUri: { scheme: 'file', fsPath: '/site' } }];
  expect(await openSourceControl('/site')).toBe(true);
  expect(host.command).toHaveBeenCalledWith('workbench.view.scm');
  expect(await reviewContentDiff('/site', '/site/src/content/post.md')).toBe(true);
  expect(host.command).toHaveBeenCalledWith('git.openChange', { fsPath: '/site/src/content/post.md' });
});
it('explains a missing repository without initializing or committing', async () => {
  expect(await openSourceControl('/site')).toBe(false);
  expect(host.message).toHaveBeenCalledWith(expect.stringContaining('No Git repository'));
  expect(host.command).not.toHaveBeenCalledWith('git.init');
});
it('does not review a file outside the selected project', async () => {
  await expect(reviewContentDiff('/site', '/other/private.md')).rejects.toThrow('outside');
  expect(host.command).not.toHaveBeenCalled();
});
