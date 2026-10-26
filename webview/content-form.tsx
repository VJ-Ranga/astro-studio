import type { ContentFormState } from '../src/content/content-types';
import type { SendRequest } from '../src/panel/messages';
import { useEffect, useState } from 'react';
import type { ContentFields } from '../src/content/content-types';

export function ContentForm({ form, hidden = false, request }: { form: ContentFormState; hidden?: boolean; request: SendRequest }) {
  const [fields, setFields] = useState<ContentFields>({ ...form.fields });
  // Only a fresh host session replaces the draft; error/status updates retain it.
  useEffect(() => { setFields({ ...form.fields }); }, [form.token]);
  if (form.status === 'idle') return null;
  const busy = form.status === 'loading' || form.status === 'applying';
  const changed = (Object.keys(fields) as (keyof ContentFields)[]).some(key => fields[key] !== form.fields[key]);
  const canApply = form.mode === 'supported' && form.token && form.documentVersion !== null && !busy && form.status !== 'conflict' && changed;
  return <div className="content-form" hidden={hidden}>
    {form.status === 'loading' && <p role="status">Loading the current editor buffer…</p>}
    {form.message && <p role={form.status === 'conflict' || form.status === 'error' ? 'alert' : 'status'}>{form.message}</p>}
    {!!form.diagnostics.length && <ul className="content-notes">{form.diagnostics.map((note, index) => <li key={index}>{note}</li>)}</ul>}
    {form.mode === 'supported' && <form onSubmit={event => {
      event.preventDefault();
      if (canApply && form.id && form.token && form.documentVersion !== null) {
        request({ version: 1, type: 'applyContent', id: form.id, token: form.token, documentVersion: form.documentVersion, fields: { ...fields } });
      }
    }}>
      {typeof fields.title === 'string' && <div className="form-field"><label htmlFor="content-title">Title</label><textarea id="content-title" rows={1} maxLength={4096} disabled={busy} value={fields.title} onChange={event => setFields(current => ({ ...current, title: event.target.value }))} /></div>}
      {typeof fields.description === 'string' && <div className="form-field"><label htmlFor="content-description">Description</label><textarea id="content-description" rows={3} maxLength={4096} disabled={busy} value={fields.description} onChange={event => setFields(current => ({ ...current, description: event.target.value }))} /></div>}
      {typeof fields.draft === 'boolean' && <label className="content-checkbox" htmlFor="content-draft"><input id="content-draft" type="checkbox" disabled={busy} checked={fields.draft} onChange={event => setFields(current => ({ ...current, draft: event.target.checked }))} />Draft</label>}
      <p className="muted">Apply changes as one undoable editor step. Nothing is saved automatically. Select the opened source editor and use Save in VS Code to update the site.</p>
      {form.dirty && <p className="muted">This form snapshot includes unsaved editor changes.</p>}
      <button type="submit" disabled={!canApply}>{form.status === 'applying' ? 'Applying…' : 'Apply to editor'}</button>
    </form>}
    {form.id && <button className="secondary reload-fields" disabled={busy} onClick={() => request({ version: 1, type: 'editContent', id: form.id! })}>Reload fields (discard form changes)</button>}
  </div>;
}
