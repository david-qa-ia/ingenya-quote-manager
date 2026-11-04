/**
 * SCRUM-124: on sign-out with Supabase, nothing of any workspace stays in this browser. Every
 * key the app writes starts with `ingenya.` (global) or `<workspace id>::ingenya.` (per
 * workspace); both are removed, together with the whole session storage (auth session and
 * active workspace). Keys of other apps on the same origin are left alone.
 */
const appKey = /^(?:[^:]+::)?ingenya\./;

export function isAppStorageKey(key: string): boolean {
  return appKey.test(key);
}

export function clearLocalAppData(): void {
  try {
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && isAppStorageKey(key)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // Storage unavailable: there is nothing readable to clear.
  }
  try {
    sessionStorage.clear();
  } catch {
    // Same as above.
  }
}
