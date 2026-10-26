import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath, runTests } from '@vscode/test-electron';
import { artifact, root, manifest } from './release-paths.mjs';

if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error('Installed-candidate verification targets Linux x64.');
if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) throw new Error('Use a graphical display or xvfb-run -a npm run test:installed.');
await readFile(artifact);
const editor = process.env.VSCODE_EXECUTABLE_PATH || await downloadAndUnzipVSCode('1.143.1');
const temporary = await mkdtemp(path.join(tmpdir(), 'astro-studio-installed-'));
const originalCwd = process.cwd();

async function userProfile(name) {
  const profile = path.join(temporary, name);
  await mkdir(path.join(profile, 'User'), { recursive: true });
  await writeFile(path.join(profile, 'User/settings.json'), JSON.stringify({
    'security.workspace.trust.enabled': true,
    'security.workspace.trust.startupPrompt': 'never',
    'workbench.startupEditor': 'none',
  }));
  return profile;
}

try {
  const extensions = path.join(temporary, 'extensions');
  const [cli, ...cliArgs] = resolveCliArgsFromVSCodeExecutablePath(editor, { reuseMachineInstall: true });
  execFileSync(cli, [...cliArgs, '--install-extension', artifact, '--extensions-dir', extensions, '--user-data-dir', await userProfile('installer')], { stdio: 'inherit', timeout: 120_000 });
  const installed = execFileSync(cli, [...cliArgs, '--list-extensions', '--show-versions', '--extensions-dir', extensions, '--user-data-dir', path.join(temporary, 'installer')], { encoding: 'utf8', timeout: 30_000 });
  assert.ok(installed.includes(`${manifest.publisher}.${manifest.name}@${manifest.version}`));

  const driver = path.join(temporary, 'driver');
  await mkdir(driver);
  await writeFile(path.join(driver, 'package.json'), JSON.stringify({ name: 'studio-test-driver', publisher: 'astro-studio-tests', version: '0.0.1', engines: { vscode: '^1.143.1' }, main: './noop.cjs' }));
  await writeFile(path.join(driver, 'noop.cjs'), 'exports.activate = () => {};\n');
  await cp(path.join(root, 'dist/tests/integration/index.cjs'), path.join(driver, 'tests.cjs'));
  await cp(path.join(root, 'dist/tests/integration/restricted.cjs'), path.join(driver, 'restricted.cjs'));

  const sourceFixture = path.join(root, 'tests/fixtures/preview site');
  const fixture = path.join(temporary, 'preview site');
  await cp(sourceFixture, fixture, {
    recursive: true, verbatimSymlinks: true,
    filter: source => !['.astro', 'dist', '.git'].includes(path.relative(sourceFixture, source).split(path.sep)[0]),
  });
  // The installed extension, standalone driver, target dependencies, and cwd are all isolated.
  process.chdir(temporary);
  await runTests({
    vscodeExecutablePath: editor,
    extensionDevelopmentPath: driver,
    extensionTestsPath: path.join(driver, 'tests.cjs'),
    launchArgs: [fixture, '--skip-welcome', '--skip-release-notes', '--disable-updates', '--user-data-dir', await userProfile('trusted'), '--extensions-dir', extensions],
  });

  // runTests intentionally disables trust. Launch the editor directly for the real restricted case.
  const restrictedArgs = [fixture, '--extensionDevelopmentPath=' + driver, '--extensionTestsPath=' + path.join(driver, 'restricted.cjs'), '--skip-welcome', '--skip-release-notes', '--disable-updates', '--user-data-dir', await userProfile('restricted'), '--extensions-dir', extensions];
  await new Promise((resolve, reject) => {
    const child = spawn(editor, restrictedArgs, { cwd: temporary, stdio: 'inherit', detached: true });
    const timer = setTimeout(() => {
      if (child.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }
      reject(new Error('Restricted-mode verification timed out.'));
    }, 120_000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve(); else reject(new Error(`Restricted-mode verification exited with ${code}.`));
    });
  });
  console.log(`PASS: exact VSIX ${path.basename(artifact)} installed in a clean profile; isolated full workflow and actual Restricted Mode verified`);
} finally {
  process.chdir(originalCwd);
  await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
