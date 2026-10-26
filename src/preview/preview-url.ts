import { stripVTControlCharacters } from 'node:util';

export function parsePreviewUrl(line: string): string | undefined {
  const match = /^\s*(?:[┃│|]\s*)?Local\s*:?\s+(https?:\/\/\S+)\s*$/i.exec(stripVTControlCharacters(line));
  const value = match?.[1];
  if (!value || value.includes('\\')) return undefined;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return undefined;
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return undefined;
    if (url.username || url.password || url.search || url.hash || url.port === '0') return undefined;
    return url.href;
  } catch { return undefined; }
}
