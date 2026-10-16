import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { WorkspaceAccessError, WorkspaceSession } from '../types/workspace';
import {
  getDemoSession,
  loadWorkspaceSession,
  switchWorkspace,
  toWorkspaceAccessError,
} from '../utils/workspaceService';
import { WorkspaceContext } from './WorkspaceContext';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<WorkspaceSession | null>(() => {
    if (import.meta.env.VITE_WORKSPACE_API_URL) return null;
    try {
      return getDemoSession();
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(Boolean(import.meta.env.VITE_WORKSPACE_API_URL));
  const [isSwitching, setIsSwitching] = useState(false);
  const [accessError, setAccessError] = useState<WorkspaceAccessError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadWorkspaceSession()
      .then((nextSession) => {
        if (cancelled) return;
        setSession(nextSession);
        setAccessError(nextSession.memberships.length ? null : 'no-workspaces');
      })
      .catch((error: unknown) => {
        if (!cancelled) setAccessError(toWorkspaceAccessError(error));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const changeWorkspace = useCallback(
    async (workspaceId: string) => {
      if (!session || isSwitching || workspaceId === session.activeWorkspaceId) return;
      setIsSwitching(true);
      setAccessError(null);
      try {
        const nextSession = await switchWorkspace(session, workspaceId);
        setSession(nextSession);
      } catch (error) {
        setAccessError(toWorkspaceAccessError(error));
        throw error;
      } finally {
        setIsSwitching(false);
      }
    },
    [isSwitching, session],
  );

  const activeMembership = useMemo(
    () =>
      session?.memberships.find((item) => item.workspace.id === session.activeWorkspaceId) ?? null,
    [session],
  );
  const value = useMemo(
    () => ({
      session,
      activeMembership,
      isLoading,
      isSwitching,
      accessError,
      changeWorkspace,
      retry: () => {
        setIsLoading(true);
        setReloadToken((value) => value + 1);
      },
    }),
    [accessError, activeMembership, changeWorkspace, isLoading, isSwitching, session],
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
