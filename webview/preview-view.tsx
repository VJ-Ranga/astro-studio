import type { SendRequest, StudioState } from '../src/panel/messages';

export function PreviewView({ state, request }: { state: StudioState; request: SendRequest }) {
  const preview = state.preview;
  const project = state.project;
  const active = preview.status === 'starting' || preview.status === 'running' || preview.status === 'stopping';
  const canStart = state.trusted && state.status === 'discovered' && project?.kind === 'astro'
    && project.packageManager && project.devScript && !project.diagnostics.some(item => item.severity === 'error') && !active && !preview.cleanupPending;
  const canStop = preview.status === 'starting' || preview.status === 'running' || (preview.status === 'failed' && preview.cleanupPending);
  const label = { stopped: 'Stopped', starting: 'Starting…', running: 'Running', stopping: 'Stopping…', failed: 'Failed' }[preview.status];

  return <section className="preview" aria-labelledby="preview-heading">
    <div className="preview-title"><h2 id="preview-heading">Site preview</h2><span className={`preview-status ${preview.status}`} role="status">{label}</span></div>
    <p>Start preview runs the selected project's dev script. Discovery alone never executes project code.</p>
    {!state.trusted && <p className="muted">Preview requires a trusted workspace.</p>}
    {preview.message && <p className={preview.status === 'failed' ? 'preview-error' : 'muted'} role={preview.status === 'failed' ? 'alert' : undefined}>{preview.message}</p>}
    {preview.url && <p className="preview-url"><code>{preview.url}</code></p>}
    <div className="actions">
      <button disabled={!canStart} onClick={() => request({ version: 1, type: 'startPreview' })}>Start preview</button>
      <button className="secondary" disabled={!canStop} onClick={() => request({ version: 1, type: 'stopPreview' })}>Stop preview</button>
      {preview.status === 'running' && <button className="secondary" onClick={() => request({ version: 1, type: 'openPreview' })}>Open preview</button>}
      <button className="secondary" onClick={() => request({ version: 1, type: 'showPreviewLogs' })}>Show preview logs</button>
    </div>
    {!!preview.logs.length && <details className="preview-logs"><summary>Recent output <span className="muted">/ bounded log tail</span></summary><pre tabIndex={0}>{preview.logs.join('\n')}</pre></details>}
  </section>;
}
