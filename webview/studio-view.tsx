import type { SendRequest, StudioState } from '../src/panel/messages';
import { PreviewView } from './preview-view';
import { ContentView } from './content-view';

export function StudioView({ state, request }: { state: StudioState; request: SendRequest }) {
  const project = state.project;
  const astro = project?.kind === 'astro' ? project : null;
  const heading = state.status === 'loading' ? 'Reading project metadata'
    : state.status === 'no-folder' ? 'Open a local Astro folder'
    : state.status === 'selection-required' ? 'Select a project root'
    : astro ? astro.name
    : project?.kind === 'not-astro' ? 'This folder does not declare Astro'
    : 'Project metadata needs attention';
  const summary = state.status === 'loading' ? 'Inspecting package.json and root lockfiles.'
    : state.status === 'no-folder' ? 'Use File > Open Folder or add a local folder to this workspace, then select it here.'
    : state.status === 'selection-required' ? 'Choose the local workspace folder to inspect. No project is selected automatically in a multi-root workspace.'
    : 'Discovery reads project metadata only. Use Start preview when you are ready to run the project.';

  return <main className="studio">
    <header className="masthead">
      <span className="brand">Astro Studio</span>
      <span className="edition">LOCAL WORKSPACE</span>
    </header>
    <div className="section-heading"><h1>Project overview</h1><span className="trust">{state.trusted ? 'Trusted workspace' : 'Restricted mode'}</span></div>
    <section className={`project-summary ${project?.kind === 'invalid' ? 'has-error' : ''}`} aria-live="polite" aria-busy={state.status === 'loading'}>
      <p className="eyebrow">{astro ? 'Astro project detected' : 'Project discovery'}</p>
      <h2>{heading}</h2>
      <p className="summary-copy">{summary}</p>
      {project && <p className="root-path"><span>Selected root</span><code>{project.rootPath}</code></p>}
      <div className="actions">
        <button onClick={() => request({ version: 1, type: 'selectProject' })}>Select project</button>
        <button className="secondary" onClick={() => request({ version: 1, type: 'refreshProject' })} disabled={state.status === 'loading'}>Refresh project</button>
        <button className="secondary" onClick={() => request({ version: 1, type: 'openSourceControl' })} disabled={!project}>Source Control</button>
      </div>
    </section>
    {astro && <section aria-labelledby="metadata-heading" className="metadata">
      <h2 id="metadata-heading">Project metadata</h2>
      <dl>
        <div><dt>Astro declaration</dt><dd><code>{astro.astroVersion}</code></dd></div>
        <div><dt>Package manager</dt><dd>{astro.packageManager ?? 'Unresolved'} <span className="muted">/ {astro.packageManagerSource}</span></dd></div>
        <div><dt>Development script</dt><dd><code>{astro.devScript ?? 'Not configured'}</code></dd></div>
      </dl>
    </section>}
    {!!project?.diagnostics.length && <section aria-labelledby="diagnostics-heading" className="diagnostics">
      <h2 id="diagnostics-heading">Discovery notes</h2>
      <ul>{project.diagnostics.map((diagnostic, index) => <li key={index} className={`diagnostic ${diagnostic.severity}`}>
        <span className="diagnostic-label">{diagnostic.severity}</span><p>{diagnostic.message}</p>
      </li>)}</ul>
    </section>}
    <PreviewView state={state} request={request} />
    <ContentView content={state.content} request={request} />
    <footer>Local files remain the source of truth.</footer>
  </main>;
}
