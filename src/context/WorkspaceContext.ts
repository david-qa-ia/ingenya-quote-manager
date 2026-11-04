import { createContext } from 'react';
import type {
  WorkspaceAccessError,
  WorkspaceMembership,
  WorkspaceSession,
} from '../types/workspace';

export type LogoutResult = 'signed-out' | 'pending-changes';

export interface WorkspaceContextValue {
  session: WorkspaceSession | null;
  activeMembership: WorkspaceMembership | null;
  isLoading: boolean;
  isSwitching: boolean;
  accessError: WorkspaceAccessError | null;
  changeWorkspace: (workspaceId: string) => Promise<void>;
  retry: () => void;
  /**
   * SCRUM-124: with Supabase, also revokes the session and clears this browser. Returns
   * 'pending-changes' (and does nothing) when some change is not saved in Supabase yet, unless
   * `discardPending` is set.
   */
  logout: (options?: { discardPending?: boolean }) => Promise<LogoutResult>;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
