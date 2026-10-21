import { workspaceStorageKey } from './workspaceStorage';

export type FollowUpResultSaveResult =
  { ok: true } | { ok: false; recoveryRequired?: boolean; message?: string };

interface Snapshot {
  key: string;
  value: string | null;
}

const recoveryMessage =
  'La acción se guardó, pero no se pudo registrar parte del historial. Reintentá solo la recuperación.';

function restoreSnapshots(snapshots: readonly Snapshot[]): boolean {
  let restored = true;
  for (const snapshot of snapshots) {
    try {
      if (snapshot.value === null) localStorage.removeItem(snapshot.key);
      else localStorage.setItem(snapshot.key, snapshot.value);
      if (localStorage.getItem(snapshot.key) !== snapshot.value) restored = false;
    } catch {
      restored = false;
    }
  }
  return restored;
}

/**
 * Commits the local pieces of a registered result as one user-visible operation.
 * The browser store does not provide transactions, so it snapshots every affected
 * collection first and verifies its rollback whenever a later write fails.
 */
export function commitLocalFollowUpResult(
  storageKeys: readonly string[],
  writes: readonly (() => boolean)[],
): FollowUpResultSaveResult {
  let snapshots: Snapshot[];
  try {
    snapshots = [...new Set(storageKeys)].map((key) => {
      const scopedKey = workspaceStorageKey(key);
      return { key: scopedKey, value: localStorage.getItem(scopedKey) };
    });
  } catch {
    return { ok: false };
  }

  try {
    if (writes.every((write) => write())) return { ok: true };
  } catch {
    // The snapshots below also cover thrown writes.
  }

  if (restoreSnapshots(snapshots)) return { ok: false };
  return { ok: false, recoveryRequired: true, message: recoveryMessage };
}

export { recoveryMessage as followUpResultRecoveryMessage };
