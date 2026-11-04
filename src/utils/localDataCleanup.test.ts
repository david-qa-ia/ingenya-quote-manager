import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearLocalAppData, isAppStorageKey } from './localDataCleanup';

function fakeStorage(initial: Record<string, string>) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    get length() {
      return map.size;
    },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('clearLocalAppData (SCRUM-124)', () => {
  it('recognizes global and per-workspace app keys only', () => {
    expect(isAppStorageKey('ingenya.savedQuotes.v1')).toBe(true);
    expect(isAppStorageKey('2c90217f-f297-4a5f-a91e-20e4962a8df2::ingenya.prospects.v1')).toBe(
      true,
    );
    expect(isAppStorageKey('workspace-alef-tau::ingenya.clients.v1')).toBe(true);
    expect(isAppStorageKey('theme')).toBe(false);
    expect(isAppStorageKey('other-app::settings')).toBe(false);
  });

  it('removes every workspace copy and the session, and keeps unrelated keys', () => {
    const local = fakeStorage({
      'ingenya.laborCatalog.v1': '[]',
      'aaa::ingenya.savedQuotes.v1': '[{"id":"PRES-1"}]',
      'bbb::ingenya.prospects.v1': '[]',
      'bbb::ingenya.documentVersions.v1': '{}',
      theme: 'dark',
    });
    const session = fakeStorage({
      'ingenya.auth.session.v1': '{}',
      'ingenya.activeWorkspace.v1': 'aaa',
    });
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', session);
    clearLocalAppData();
    expect([...local.map.keys()]).toEqual(['theme']);
    expect(session.map.size).toBe(0);
  });
});
