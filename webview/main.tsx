import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { HostEvent, StudioState, WebviewRequest } from '../src/panel/messages';
import { StudioView } from './studio-view';
import './styles.css';
import { stoppedPreview } from '../src/preview/preview-types';
import { emptyContent } from '../src/content/content-types';

declare function acquireVsCodeApi(): { postMessage(message: WebviewRequest): void };
const vscode = acquireVsCodeApi();
const request = (message: WebviewRequest) => vscode.postMessage(message);

function App() {
  const [state, setState] = useState<StudioState>({ status: 'loading', trusted: false, project: null, preview: stoppedPreview(), content: emptyContent() });
  useEffect(() => {
    const receive = (event: MessageEvent<HostEvent>) => {
      if (event.data?.version === 1 && event.data.type === 'state' && event.data.state) setState(event.data.state);
    };
    window.addEventListener('message', receive);
    request({ version: 1, type: 'ready' });
    return () => window.removeEventListener('message', receive);
  }, []);
  return <StudioView state={state} request={request} />;
}

createRoot(document.getElementById('root')!).render(<App />);
