import type { Prospect } from '../types/prospect';
import { workspaceStorageKey } from './workspaceStorage';

const RECOVERY_KEY = 'ingenya.prospectResultRecovery.v1';

export interface ProspectResultRecovery {
  workspaceId: string;
  prospect: Prospect;
}

export function loadProspectResultRecovery(): ProspectResultRecovery | null {
  try {
    const raw = localStorage.getItem(workspaceStorageKey(RECOVERY_KEY));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('workspaceId' in parsed) ||
      !('prospect' in parsed) ||
      typeof parsed.workspaceId !== 'string'
    )
      return null;
    return parsed as ProspectResultRecovery;
  } catch {
    return null;
  }
}

export function saveProspectResultRecovery(recovery: ProspectResultRecovery): boolean {
  try {
    localStorage.setItem(workspaceStorageKey(RECOVERY_KEY), JSON.stringify(recovery));
    return true;
  } catch {
    return false;
  }
}

export function clearProspectResultRecovery(): void {
  try {
    localStorage.removeItem(workspaceStorageKey(RECOVERY_KEY));
  } catch {
    // The remote mutation remains authoritative even when the browser cannot clear its mirror hint.
  }
}
