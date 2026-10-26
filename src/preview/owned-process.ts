import type { ChildProcess } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

/** Own the detached process group until no live worker or inherited pipe remains. */
export class OwnedProcess {
  private closed = false;
  private stopping: Promise<void> | undefined;

  constructor(private readonly child: ChildProcess) {
    child.once('close', () => { this.closed = true; });
  }

  private signal(signal: NodeJS.Signals): void {
    if (!this.child.pid) return;
    try { process.kill(-this.child.pid, signal); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  }

  private async hasLiveMembers(): Promise<boolean> {
    const group = this.child.pid;
    if (!group) return false;
    try { process.kill(-group, 0); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
      throw error;
    }
    if (process.platform !== 'linux') return true;
    // kill(0) also sees zombies. They hold no sockets or executable work.
    const entries = (await readdir('/proc')).filter(name => /^\d+$/.test(name));
    const members = await Promise.all(entries.map(async pid => {
      try {
        const stat = await readFile(`/proc/${pid}/stat`, 'utf8');
        const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
        return Number(fields[2]) === group && fields[0] !== 'Z' && fields[0] !== 'X';
      } catch (error) {
        if (['ENOENT', 'ESRCH'].includes((error as NodeJS.ErrnoException).code ?? '')) return false;
        throw error;
      }
    }));
    return members.some(Boolean);
  }

  private async terminate(): Promise<void> {
    this.signal('SIGTERM');
    const forceAt = Date.now() + 1_500;
    const deadline = forceAt + 2_000;
    let forced = false;
    for (;;) {
      const live = await this.hasLiveMembers();
      if (!live && this.closed) return;
      if (!forced && Date.now() >= forceAt) {
        if (live) this.signal('SIGKILL');
        forced = true;
      }
      if (Date.now() >= deadline) throw new Error('Cannot confirm owned process-group cleanup. Retry Stop preview; a replacement server will not be started.');
      await delay(25);
    }
  }

  stop(): Promise<void> {
    this.stopping ??= this.terminate().catch(error => {
      this.stopping = undefined;
      throw error;
    });
    return this.stopping;
  }
}
