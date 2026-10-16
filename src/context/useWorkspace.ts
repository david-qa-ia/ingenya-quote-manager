import { useContext } from 'react';
import { WorkspaceContext, type WorkspaceContextValue } from './WorkspaceContext';

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return value;
}
