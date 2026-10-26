import type { ProjectDiscovery } from '../workspace/project-types';
import type { PreviewState } from '../preview/preview-types';
import type { ContentFormSubmission, ContentState } from '../content/content-types';
import { isContentFields } from '../content/content-values';

export type StudioState = {
  trusted: boolean;
  status: 'no-folder' | 'selection-required' | 'loading' | 'discovered';
  project: ProjectDiscovery | null;
  preview: PreviewState;
  content: ContentState;
};
export type WebviewRequest = {
  version: 1;
  type: 'ready' | 'refreshProject' | 'selectProject' | 'startPreview' | 'stopPreview' | 'openPreview' | 'showPreviewLogs' | 'refreshContent' | 'openSourceControl';
} | { version: 1; type: 'openContent' | 'editContent' | 'reviewContentDiff'; id: string }
  | ({ version: 1; type: 'applyContent' } & ContentFormSubmission);
export type SendRequest = (message: WebviewRequest) => void;
export type HostEvent = { version: 1; type: 'state'; state: StudioState };

export function parseWebviewRequest(value: unknown): WebviewRequest | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  const message = value as Record<string, unknown>;
  if (!Object.hasOwn(message, 'version') || !Object.hasOwn(message, 'type')) return undefined;
  if (message.version !== 1 || typeof message.type !== 'string') return undefined;
  if (message.type === 'applyContent') {
    const required = ['version', 'type', 'id', 'token', 'documentVersion', 'fields'];
    if (Object.keys(message).length !== required.length || !required.every(key => Object.hasOwn(message, key))) return undefined;
    if (typeof message.id !== 'string' || !/^[a-f0-9]{24}$/.test(message.id)
      || typeof message.token !== 'string' || !/^[a-f0-9]{32}$/.test(message.token)
      || typeof message.documentVersion !== 'number' || !Number.isSafeInteger(message.documentVersion) || message.documentVersion < 1
      || !isContentFields(message.fields)) return undefined;
    return { version: 1, type: 'applyContent', id: message.id, token: message.token, documentVersion: message.documentVersion, fields: { ...message.fields } };
  }
  if (message.type === 'openContent' || message.type === 'editContent' || message.type === 'reviewContentDiff') {
    return Object.keys(message).length === 3 && Object.hasOwn(message, 'id') && typeof message.id === 'string' && /^[a-f0-9]{24}$/.test(message.id)
      ? { version: 1, type: message.type, id: message.id } : undefined;
  }
  if (Object.keys(message).length !== 2) return undefined;
  switch (message.type) {
    case 'ready': case 'refreshProject': case 'selectProject': case 'startPreview': case 'stopPreview': case 'openPreview': case 'showPreviewLogs': case 'refreshContent': case 'openSourceControl':
      return { version: 1, type: message.type };
    default: return undefined;
  }
}
