import { beforeEach, expect, it, vi } from 'vitest';
const host = vi.hoisted(() => ({ command: vi.fn(), external: vi.fn() }));
vi.mock('vscode', () => ({
  commands: { executeCommand: host.command },
  env: { openExternal: host.external },
  Uri: { parse: (url: string) => url },
}));
import { openPreview } from '../../src/preview/open-preview';
beforeEach(() => { host.command.mockReset(); host.external.mockReset(); });
it('opens the actual validated URL in native Simple Browser', async () => {
  await openPreview('http://127.0.0.1:4322/base/');
  expect(host.command).toHaveBeenCalledWith('simpleBrowser.show', 'http://127.0.0.1:4322/base/');
  expect(host.external).not.toHaveBeenCalled();
});
it('falls back to the system browser when Simple Browser is unavailable', async () => {
  host.command.mockRejectedValue(new Error('command not found'));
  host.external.mockResolvedValue(true);
  await openPreview('http://localhost:4321/');
  expect(host.external).toHaveBeenCalledWith('http://localhost:4321/');
});
it('refuses nonlocal URLs without executing browser commands', async () => {
  await expect(openPreview('https://evil.example/')).rejects.toThrow('local');
  expect(host.command).not.toHaveBeenCalled();
});
