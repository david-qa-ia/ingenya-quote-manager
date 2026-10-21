export const ACTIVE_WORKSPACE_STORAGE_KEY = 'ingenya.activeWorkspace.v1';

export function getActiveWorkspaceId(): string | null {
  try {
    return sessionStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setActiveWorkspaceId(workspaceId: string): void {
  sessionStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, workspaceId);
}

export function workspaceStorageKey(key: string): string {
  const workspaceId = getActiveWorkspaceId();
  return workspaceId ? `${workspaceId}::${key}` : key;
}

export function workspaceStorageKeyFor(key: string, workspaceId?: string): string {
  return workspaceId ? `${workspaceId}::${key}` : key;
}

export function clearWorkspaceScopedSession(): void {
  try {
    localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
    sessionStorage.clear();
  } catch {
    // Storage can be unavailable in private browsing; the server remains authoritative.
  }
}
