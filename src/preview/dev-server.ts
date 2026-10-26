import { spawn } from 'node:child_process';
import type { ProjectDiscovery } from '../workspace/project-types';
import { stoppedPreview, type PreviewState } from './preview-types';
import { parsePreviewUrl } from './preview-url';
import { PreviewOutput } from './preview-output';
import { OwnedProcess } from './owned-process';

export interface DevServerOptions {
  onState?: (state: PreviewState) => void;
  onLogs?: (logs: string[]) => void;
  startupTimeoutMs?: number;
}

interface OwnedServer {
  process: OwnedProcess;
  stopping: boolean;
  failure: string | null;
  cleanup: Promise<void> | undefined;
  startupTimer: NodeJS.Timeout | undefined;
  finishStart: ((state: PreviewState) => void) | undefined;
}

export class DevServerController {
  private state: PreviewState = stoppedPreview();
  private owned: OwnedServer | undefined;
  private disposed = false;
  private disposal: Promise<void> | undefined;

  constructor(private readonly options: DevServerOptions = {}) {}

  get snapshot(): PreviewState { return { ...this.state, logs: [...this.state.logs] }; }

  private publish(patch: Partial<PreviewState>): void {
    this.state = { ...this.state, ...patch };
    if (!this.disposed) this.options.onState?.(this.snapshot);
  }

  private settle(owned: OwnedServer): void {
    const finish = owned.finishStart;
    owned.finishStart = undefined;
    finish?.(this.snapshot);
  }

  private fail(message: string): PreviewState {
    this.publish({ status: 'failed', url: null, message });
    return this.snapshot;
  }

  async start(project: ProjectDiscovery | null, trusted: boolean): Promise<PreviewState> {
    if (this.disposed) return this.fail('Preview controller is disposed. Reopen the extension to start preview.');
    if (this.owned) return this.snapshot;
    this.state = stoppedPreview();
    if (!trusted) return this.fail('Preview requires a trusted workspace. Review the project and manage Workspace Trust in VS Code.');
    if (project?.kind !== 'astro') return this.fail('Select a valid Astro project before starting preview.');
    if (!project.packageManager) return this.fail('Resolve the project package manager before starting preview.');
    if (!project.devScript) return this.fail('Configure a dev script in package.json before starting preview.');
    if (project.diagnostics.some(item => item.severity === 'error')) return this.fail('Resolve project discovery errors before starting preview.');
    if (process.platform === 'win32') return this.fail('Preview process ownership is currently supported on Linux desktop only.');

    this.publish({ status: 'starting', rootPath: project.rootPath, message: 'Waiting for the dev server Local URL…', logs: [] });
    if (!this.disposed) this.options.onLogs?.([]);
    let finishStart!: (state: PreviewState) => void;
    const ready = new Promise<PreviewState>(resolve => { finishStart = resolve; });
    let child;
    try {
      child = spawn(project.packageManager, ['run', 'dev'], {
        cwd: project.rootPath, shell: false, detached: true,
        stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, NO_COLOR: '1' },
      });
    } catch (error) {
      finishStart(this.fail(`Cannot launch ${project.packageManager}: ${(error as Error).message}`));
      return ready;
    }
    const owned: OwnedServer = {
      process: new OwnedProcess(child), stopping: false, failure: null,
      cleanup: undefined, startupTimer: undefined, finishStart,
    };
    this.owned = owned;
    const output = new PreviewOutput((line, complete) => {
      const logs = [...this.state.logs, line.slice(0, 2_048)].slice(-100);
      while (logs.join('\n').length > 16_384) logs.shift();
      this.publish({ logs });
      if (!this.disposed) this.options.onLogs?.([...logs]);
      if (owned.stopping || this.state.status !== 'starting' || !complete) return;
      const url = parsePreviewUrl(line);
      if (url) {
        clearTimeout(owned.startupTimer);
        this.publish({ status: 'running', url, message: null });
        this.settle(owned);
      }
    });
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => output.push('stdout', chunk));
    child.stderr?.on('data', (chunk: string) => output.push('stderr', chunk));
    const failed = (message: string) => {
      if (owned.stopping) return;
      owned.failure = message;
      void this.cleanup(owned);
    };
    child.once('error', error => failed(`Cannot start ${project.packageManager}. Check its installation and project dependencies. ${error.message}`));
    child.once('exit', (code, signal) => failed(`Preview exited with ${signal ? `signal ${signal}` : `code ${code}`}. Check preview logs and the project dev script.`));
    child.once('close', () => {
      output.flush('stdout');
      output.flush('stderr');
    });
    owned.startupTimer = setTimeout(() => failed('Timed out waiting for a valid Local preview URL. Check preview logs and the project dev script.'), this.options.startupTimeoutMs ?? 30_000);
    return ready;
  }

  private cleanup(owned: OwnedServer): Promise<void> {
    if (owned.cleanup) return owned.cleanup;
    owned.stopping = true;
    clearTimeout(owned.startupTimer);
    this.publish({ status: owned.failure ? 'failed' : 'stopping', url: null, message: owned.failure, cleanupPending: true });
    owned.cleanup = owned.process.stop().then(() => {
      if (this.owned !== owned) return;
      this.owned = undefined;
      this.publish({ status: owned.failure ? 'failed' : 'stopped', url: null, message: owned.failure, cleanupPending: false });
    }).catch(error => {
      owned.cleanup = undefined;
      this.fail(`${owned.failure ? owned.failure + ' ' : ''}Cleanup failed: ${(error as Error).message}`);
      // Ownership and cleanupPending remain set, so Start cannot replace this group.
    }).finally(() => this.settle(owned));
    return owned.cleanup;
  }

  async stop(): Promise<PreviewState> {
    const owned = this.owned;
    if (owned) {
      await this.cleanup(owned);
      if (this.owned) return this.snapshot;
    }
    this.publish({ status: 'stopped', url: null, message: null, cleanupPending: false });
    return this.snapshot;
  }

  dispose(): Promise<void> {
    if (this.disposal) return this.disposal;
    this.disposed = true;
    this.disposal = this.stop().then(state => {
      if (state.cleanupPending) throw new Error(state.message ?? 'Preview cleanup is incomplete.');
    });
    return this.disposal;
  }
}
