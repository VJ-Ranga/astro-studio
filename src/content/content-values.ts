import type { ContentFields } from './content-types';

export function isContentFields(value: unknown): value is ContentFields {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const fields = value as Record<string, unknown>;
  const keys = Object.keys(fields);
  return keys.length > 0 && keys.length <= 3 && keys.every(key => key === 'draft'
    ? typeof fields[key] === 'boolean'
    : (key === 'title' || key === 'description') && typeof fields[key] === 'string' && fields[key].length <= 4_096);
}
