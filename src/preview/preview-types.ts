export interface PreviewState {
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'failed';
  cleanupPending?: boolean;
  rootPath: string | null;
  url: string | null;
  message: string | null;
  logs: string[];
}

export const stoppedPreview = (): PreviewState => ({
  status: 'stopped', rootPath: null, url: null, message: null, logs: [],
});
