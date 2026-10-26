import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTests } from '@vscode/test-electron';
import { createGitFixture } from './test-fixtures.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'astro-studio-test-'));

try {
  if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    throw new Error('Extension tests require a graphical display. Run with xvfb-run -a npm run test:integration.');
  }

  for (const [label, workspace] of [
    ['no-folder', undefined],
    ['astro-fixture', path.join(root, 'tests/fixtures/astro project')],
    ['live-preview', path.join(root, 'tests/fixtures/preview site')],
    ['native-git', await createGitFixture(profile)],
  ]) {
    const userData = path.join(profile, label, 'user-data');
    await mkdir(path.join(userData, 'User'), { recursive: true });
    await writeFile(path.join(userData, 'User/settings.json'), JSON.stringify({
      'security.workspace.trust.startupPrompt': 'never',
      'workbench.startupEditor': 'none',
    }));
    await runTests({
      version: '1.143.1',
      ...(process.env.VSCODE_EXECUTABLE_PATH
        ? { vscodeExecutablePath: process.env.VSCODE_EXECUTABLE_PATH }
        : {}),
      extensionDevelopmentPath: root,
      extensionTestsPath: path.join(root, 'dist/tests/integration/index.cjs'),
      launchArgs: [
        ...(workspace ? [workspace] : []),
        '--disable-extensions',
        '--skip-welcome',
        '--skip-release-notes',
        '--disable-updates',
        '--user-data-dir', userData,
        '--extensions-dir', path.join(profile, label, 'extensions'),
      ],
    });
  }
} finally {
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
