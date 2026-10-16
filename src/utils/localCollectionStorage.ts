import { workspaceStorageKey } from './workspaceStorage';

export interface CollectionLoad<T> {
  items: T[];
  issue: 'invalid-root' | 'invalid-entries' | 'unavailable' | null;
}

export function readCollection(key: string): unknown[] {
  const stored = localStorage.getItem(workspaceStorageKey(key));
  if (stored === null) return [];
  const parsed: unknown = JSON.parse(stored);
  if (!Array.isArray(parsed)) throw new Error('Invalid collection root');
  return parsed;
}

export function loadCollection<T extends { id: string }>(
  key: string,
  validate: (value: unknown) => value is T,
): CollectionLoad<T> {
  let stored: string | null;
  try {
    stored = localStorage.getItem(workspaceStorageKey(key));
  } catch {
    return { items: [], issue: 'unavailable' };
  }
  if (stored === null) return { items: [], issue: null };
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return { items: [], issue: 'invalid-root' };
    const ids = new Set<string>();
    const items = parsed.filter((value): value is T => {
      if (!validate(value) || ids.has(value.id)) return false;
      ids.add(value.id);
      return true;
    });
    return { items, issue: items.length === parsed.length ? null : 'invalid-entries' };
  } catch {
    return { items: [], issue: 'invalid-root' };
  }
}

export function hasRecordId(value: unknown, id: string): boolean {
  return typeof value === 'object' && value !== null && 'id' in value && value.id === id;
}

export function saveCollectionItem<T extends { id: string }>(
  key: string,
  item: T,
  validate: (value: unknown) => value is T,
): boolean {
  try {
    if (!validate(item)) return false;
    const records = readCollection(key);
    const matches = records.filter((value) => hasRecordId(value, item.id));
    if (matches.length > 1 || (matches.length === 1 && !validate(matches[0]))) return false;
    const index = records.findIndex((value) => hasRecordId(value, item.id));
    if (index < 0) records.push(item);
    else records[index] = item;
    // Preserve unrelated invalid records for recovery; never replace an unreadable root.
    localStorage.setItem(workspaceStorageKey(key), JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}
