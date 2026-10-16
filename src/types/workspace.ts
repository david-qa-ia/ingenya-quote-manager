export type WorkspaceRole = 'owner' | 'admin' | 'collaborator';
export type WorkspaceMembershipStatus = 'active' | 'inactive';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive';
}

export interface WorkspaceMembership {
  workspace: Workspace;
  role: WorkspaceRole;
  status: WorkspaceMembershipStatus;
}

export interface WorkspaceSession {
  userId: string;
  memberships: WorkspaceMembership[];
  activeWorkspaceId: string | null;
}

export type WorkspaceAccessError = 'no-workspaces' | 'session-expired' | 'network' | 'denied';
