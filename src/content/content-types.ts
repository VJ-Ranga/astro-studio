export interface ContentFields {
  title?: string;
  description?: string;
  draft?: boolean;
}
export interface ContentAnalysis {
  mode: 'supported' | 'source-only';
  fields: ContentFields;
  ranges: Partial<Record<keyof ContentFields, { start: number; end: number }>>;
  diagnostics: string[];
}
export interface ContentEntry extends ContentAnalysis {
  id: string;
  path: string;
}
export interface ContentState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  entries: ContentEntry[];
  diagnostics: string[];
  form?: ContentFormState;
}
export interface ContentFormSubmission {
  id: string;
  token: string;
  documentVersion: number;
  fields: ContentFields;
}
export interface ContentFormState {
  status: 'idle' | 'loading' | 'ready' | 'applying' | 'applied' | 'conflict' | 'error';
  id: string | null;
  token: string | null;
  documentVersion: number | null;
  fields: ContentFields;
  mode: 'supported' | 'source-only';
  diagnostics: string[];
  dirty: boolean;
  message: string | null;
}
export const emptyContentForm = (): ContentFormState => ({
  status: 'idle', id: null, token: null, documentVersion: null, fields: {},
  mode: 'source-only', diagnostics: [], dirty: false, message: null,
});
export const emptyContent = (): ContentState => ({ status: 'idle', entries: [], diagnostics: [] });
