export const ACTIVE_WORKSPACE_STORAGE_KEY = 'ingenya.activeWorkspace.v1';

export function isWorkspaceUuid(value: string | null | undefined): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

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
