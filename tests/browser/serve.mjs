import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-smoke'; style-src 'self'; base-uri 'none'; form-action 'none'">
<link rel="stylesheet" href="/main.css"><title>Astro Studio panel test</title></head>
<body><div id="root"></div><script nonce="smoke">
window.requests = [];
window.acquireVsCodeApi = () => ({postMessage: message => window.requests.push(message)});
</script><script nonce="smoke" src="/main.js"></script></body></html>`;

const assets = {
  '/main.js': ['application/javascript', new URL('../../dist/webview/main.js', import.meta.url)],
  '/main.css': ['text/css', new URL('../../dist/webview/main.css', import.meta.url)],
};
const server = createServer(async (request, response) => {
  try {
    if (request.url === '/') {
      response.writeHead(200, { 'content-type': 'text/html' }).end(html);
      return;
    }
    const asset = assets[request.url];
    if (!asset) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'content-type': asset[0] }).end(await readFile(asset[1]));
  } catch {
    response.writeHead(500).end('Run npm run build before starting the panel harness.');
  }
});
server.listen(4372, '127.0.0.1', () => console.log('Panel test harness: http://127.0.0.1:4372'));
