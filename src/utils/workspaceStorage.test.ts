import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACTIVE_WORKSPACE_STORAGE_KEY,
  getActiveWorkspaceId,
  setActiveWorkspaceId,
  workspaceStorageKey,
} from './workspaceStorage';

describe('workspace storage namespace', () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('sessionStorage', storage);
  });

  it('namespaces commercial collections by the active workspace', () => {
    setActiveWorkspaceId('workspace-ingenya');
    expect(getActiveWorkspaceId()).toBe('workspace-ingenya');
    expect(workspaceStorageKey('ingenya.clients.v1')).toBe('workspace-ingenya::ingenya.clients.v1');
    expect(values.has(ACTIVE_WORKSPACE_STORAGE_KEY)).toBe(true);
  });

  it('changes the namespace without overwriting another workspace', () => {
    setActiveWorkspaceId('workspace-ingenya');
    values.set(workspaceStorageKey('ingenya.savedQuotes.v1'), 'ingenya-data');
    setActiveWorkspaceId('workspace-alef-tau');
    values.set(workspaceStorageKey('ingenya.savedQuotes.v1'), 'alef-data');
    expect(values.get('workspace-ingenya::ingenya.savedQuotes.v1')).toBe('ingenya-data');
    expect(values.get('workspace-alef-tau::ingenya.savedQuotes.v1')).toBe('alef-data');
  });
});
