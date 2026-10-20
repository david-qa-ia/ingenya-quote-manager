import { createContext } from 'react';
import type {
  WorkspaceAccessError,
  WorkspaceMembership,
  WorkspaceSession,
} from '../types/workspace';

export interface WorkspaceContextValue {
  session: WorkspaceSession | null;
  activeMembership: WorkspaceMembership | null;
  isLoading: boolean;
  isSwitching: boolean;
  accessError: WorkspaceAccessError | null;
  changeWorkspace: (workspaceId: string) => Promise<void>;
  retry: () => void;
  logout: () => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
