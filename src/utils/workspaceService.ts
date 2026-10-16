import type {
  WorkspaceAccessError,
  WorkspaceMembership,
  WorkspaceSession,
} from '../types/workspace';
import { getActiveWorkspaceId, setActiveWorkspaceId } from './workspaceStorage';

const demoUserId = 'david-identity';
const demoMemberships: WorkspaceMembership[] = [
  {
    workspace: { id: 'workspace-ingenya', name: 'Ingenya', slug: 'ingenya', status: 'active' },
    role: 'owner',
    status: 'active',
  },
  {
    workspace: { id: 'workspace-alef-tau', name: 'Alef-Tau', slug: 'alef-tau', status: 'active' },
    role: 'admin',
    status: 'active',
  },
  {
    workspace: {
      id: 'workspace-family-business',
      name: 'Negocio familiar',
      slug: 'negocio-familiar',
      status: 'active',
    },
    role: 'admin',
    status: 'active',
  },
];

function validateMembership(
  memberships: WorkspaceMembership[],
  workspaceId: string,
): WorkspaceMembership {
  const membership = memberships.find(
    (item) =>
      item.workspace.id === workspaceId &&
      item.status === 'active' &&
      item.workspace.status === 'active',
  );
  if (!membership) throw new Error('workspace-denied');
  return membership;
}

export function getDemoSession(): WorkspaceSession {
  const requestedError = new URLSearchParams(window.location.search).get('workspace-error');
  if (requestedError === 'session') throw new Error('session-expired');
  if (requestedError === 'network') throw new Error('network');
  if (requestedError === 'denied') throw new Error('workspace-denied');
  if (requestedError === 'empty')
    return { userId: demoUserId, memberships: [], activeWorkspaceId: null };
  const activeWorkspaceId = getActiveWorkspaceId() ?? demoMemberships[0].workspace.id;
  validateMembership(demoMemberships, activeWorkspaceId);
  setActiveWorkspaceId(activeWorkspaceId);
  return { userId: demoUserId, memberships: demoMemberships, activeWorkspaceId };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { credentials: 'include', ...options });
  if (response.status === 401) throw new Error('session-expired');
  if (response.status === 403) throw new Error('workspace-denied');
  if (!response.ok) throw new Error('network');
  return (await response.json()) as T;
}

export async function loadWorkspaceSession(): Promise<WorkspaceSession> {
  if (import.meta.env.VITE_WORKSPACE_API_URL) {
    return request<WorkspaceSession>('/workspaces');
  }
  return getDemoSession();
}

export async function switchWorkspace(
  session: WorkspaceSession,
  workspaceId: string,
): Promise<WorkspaceSession> {
  validateMembership(session.memberships, workspaceId);
  if (import.meta.env.VITE_WORKSPACE_API_URL) {
    const nextSession = await request<WorkspaceSession>('/workspaces/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId }),
    });
    if (nextSession.activeWorkspaceId) setActiveWorkspaceId(nextSession.activeWorkspaceId);
    return nextSession;
  }
  setActiveWorkspaceId(workspaceId);
  return { ...session, activeWorkspaceId: workspaceId };
}

export function toWorkspaceAccessError(error: unknown): WorkspaceAccessError {
  if (error instanceof Error && error.message === 'session-expired') return 'session-expired';
  if (error instanceof Error && error.message === 'workspace-denied') return 'denied';
  if (error instanceof Error && error.message === 'network') return 'network';
  return 'no-workspaces';
}
