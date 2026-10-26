import { emptyContentForm, type ContentState } from '../src/content/content-types';
import type { SendRequest } from '../src/panel/messages';
import { useState } from 'react';
import { ContentForm } from './content-form';

export function ContentView({ content, request }: { content: ContentState; request: SendRequest }) {
  const [selected, setSelected] = useState<string | null>(null);
  const entry = content.entries.find(item => item.id === selected) ?? content.entries[0];
  const form = content.form ?? emptyContentForm();
  const activeForm = !!entry && form.id === entry.id && form.status !== 'idle';
  return <section className="content-browser" aria-labelledby="content-heading">
    <div className="preview-title"><h2 id="content-heading">Local content</h2><span className="muted">{content.entries.length} entries / saved files</span></div>
    <p className="muted">Inspect Markdown under <code>src/content/</code>. Supported fields can be applied to the editor; source-only content stays in the source editor.</p>
    <button className="secondary" disabled={content.status === 'loading' || content.status === 'idle'} onClick={() => request({ version: 1, type: 'refreshContent' })}>Refresh content</button>
    <div aria-live="polite">
      {content.status === 'idle' && <p>Select an Astro project to browse local content.</p>}
      {content.status === 'loading' && <p>Reading saved content…</p>}
      {content.status === 'ready' && !content.entries.length && <p><strong>No local entries.</strong> Add Markdown files under <code>src/content/</code>, then refresh.</p>}
      {!!content.diagnostics.length && <ul className="content-notes">{content.diagnostics.map((note, index) => <li key={index}>{note}</li>)}</ul>}
    </div>
    <div className="content-layout" hidden={!entry}>
      <nav aria-label="Content entries"><ul className="content-list">{content.entries.map(item => <li key={item.id}>
        <button className="content-entry" aria-label={`Inspect ${item.path}`} aria-pressed={entry?.id === item.id} onClick={() => setSelected(item.id)}>
          <code>{item.path}</code><span className={`content-mode ${item.mode}`}>{item.mode === 'supported' ? 'Supported fields' : 'Source only'}</span>
        </button>
      </li>)}</ul></nav>
      <article className="content-detail" aria-label="Selected content">
        {entry && <>
          <h3><code>{entry.path}</code></h3>
          {!activeForm && <>
            <p className="muted">Saved-file inspection. Load supported fields to edit the current buffer.</p>
            {!!Object.keys(entry.fields).length && <dl>{Object.entries(entry.fields).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl>}
            {!!entry.diagnostics.length && <ul className="content-notes">{entry.diagnostics.map((note, index) => <li key={index}>{note}</li>)}</ul>}
          </>}
          <div className="actions">
            <button className="secondary" onClick={() => request({ version: 1, type: 'openContent', id: entry.id })}>Open source</button>
            <button className="secondary" onClick={() => request({ version: 1, type: 'reviewContentDiff', id: entry.id })}>Review diff</button>
            {!activeForm && entry.mode === 'supported' && <button onClick={() => request({ version: 1, type: 'editContent', id: entry.id })}>Edit fields</button>}
          </div>
        </>}
        <ContentForm form={form} hidden={!activeForm} request={request} />
      </article>
    </div>
  </section>;
}
