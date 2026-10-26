import { stripVTControlCharacters } from 'node:util';

/** Assemble bounded lines independently for stdout and stderr. */
export class PreviewOutput {
  private readonly buffers = {
    stdout: { text: '', truncated: false },
    stderr: { text: '', truncated: false },
  };

  constructor(private readonly onLine: (line: string, complete: boolean) => void) {}

  push(stream: 'stdout' | 'stderr', chunk: string): void {
    const buffer = this.buffers[stream];
    const parts = chunk.split(/\r\n|\n|\r/);
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index]!;
      const room = 4_096 - buffer.text.length;
      buffer.text += part.slice(0, room);
      buffer.truncated ||= part.length > room;
      if (index < parts.length - 1) this.flush(stream);
    }
  }

  flush(stream: 'stdout' | 'stderr'): void {
    const buffer = this.buffers[stream];
    const line = stripVTControlCharacters(buffer.text);
    if (line.trim()) this.onLine(line + (buffer.truncated ? ' [truncated]' : ''), !buffer.truncated);
    buffer.text = '';
    buffer.truncated = false;
  }
}
