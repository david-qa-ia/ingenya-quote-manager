import type { Prospect, ProspectInput } from '../types/prospect';
import { PROSPECTS_STORAGE_KEY, isProspect } from './prospectStorage';
import type { FirstContactChannel, ProspectImportRow } from './prospectImport';
import { hasUsableContact } from './prospectImport';
import { readCollection } from './localCollectionStorage';
import { workspaceStorageKey, workspaceStorageKeyFor } from './workspaceStorage';

export const PROSPECT_IMPORT_RECOVERY_STORAGE_KEY = 'ingenya.prospectImportRecovery.v1';

export interface FirstContactImportConfig {
  schedule: boolean;
  channel: FirstContactChannel;
  dueAt: string;
  responsible: string;
  note: string;
}
export interface PreparedProspectImport {
  importKey: string;
  prospects: Prospect[];
  scheduledCount: number;
}
export interface ProspectImportRecovery {
  importKey: string;
  workspaceId?: string;
  fileName: string;
  csv: string;
  config: FirstContactImportConfig;
  prepared: PreparedProspectImport;
  phase: 'pending' | 'remoteConfirmed';
}

function firstActionLabel(channel: FirstContactChannel): string {
  return channel === 'phone'
    ? 'Primer contacto por llamada'
    : `Primer contacto por ${channel === 'whatsapp' ? 'WhatsApp' : 'email'}`;
}

export function prepareProspectImport(
  rows: readonly ProspectImportRow[],
  config: FirstContactImportConfig,
  importKey: string = crypto.randomUUID(),
  now = new Date().toISOString(),
): PreparedProspectImport {
  const prospects = rows
    .filter((row) => !row.reason && !row.duplicate)
    .map((row) => {
      const compatible = config.schedule && hasUsableContact(row.input, config.channel);
      const prospectId = crypto.randomUUID();
      const input: ProspectInput = {
        ...row.input,
        preferredChannel: compatible ? config.channel : '',
        nextAction: compatible ? firstActionLabel(config.channel) : '',
        nextActionAt: compatible ? config.dueAt : '',
        responsible: compatible ? config.responsible.trim() : '',
      };
      return {
        ...input,
        id: prospectId,
        activities: [
          {
            id: crypto.randomUUID(),
            prospectId,
            occurredAt: now,
            createdAt: now,
            type: 'note' as const,
            description: compatible
              ? `${firstActionLabel(config.channel)} agendado durante la importación.`
              : 'Prospecto importado.',
            ...(compatible && config.note.trim() ? { note: config.note.trim() } : {}),
          },
        ],
        createdAt: now,
        updatedAt: now,
      };
    });
  return {
    importKey,
    prospects,
    scheduledCount: prospects.filter((prospect) => prospect.nextActionAt).length,
  };
}

export function savePreparedProspectImport(prepared: PreparedProspectImport): boolean {
  try {
    if (!prepared.prospects.every(isProspect)) return false;
    const records = readCollection(PROSPECTS_STORAGE_KEY);
    const ids = new Set(
      records.map((record) =>
        typeof record === 'object' && record ? (record as { id?: string }).id : undefined,
      ),
    );
    const existingById = new Map(
      records
        .filter((record): record is Prospect => isProspect(record))
        .map((record) => [record.id, record]),
    );
    if (prepared.prospects.some((prospect) => ids.has(prospect.id))) {
      return prepared.prospects.every(
        (prospect) => JSON.stringify(existingById.get(prospect.id)) === JSON.stringify(prospect),
      );
    }
    const key = workspaceStorageKey(PROSPECTS_STORAGE_KEY);
    const next = [...records, ...prepared.prospects];
    localStorage.setItem(key, JSON.stringify(next));
    const confirmed = readCollection(PROSPECTS_STORAGE_KEY);
    return prepared.prospects.every((prospect) =>
      confirmed.some((record) => isProspect(record) && record.id === prospect.id),
    );
  } catch {
    return false;
  }
}

export function saveProspectImportRecovery(recovery: ProspectImportRecovery): boolean {
  try {
    localStorage.setItem(
      workspaceStorageKeyFor(PROSPECT_IMPORT_RECOVERY_STORAGE_KEY, recovery.workspaceId),
      JSON.stringify(recovery),
    );
    return true;
  } catch {
    return false;
  }
}
export function loadProspectImportRecovery(): ProspectImportRecovery | null {
  try {
    const value = localStorage.getItem(workspaceStorageKey(PROSPECT_IMPORT_RECOVERY_STORAGE_KEY));
    if (!value) return null;
    const parsed = JSON.parse(value) as ProspectImportRecovery;
    return (parsed?.phase === 'pending' || parsed?.phase === 'remoteConfirmed') &&
      typeof parsed.importKey === 'string'
      ? parsed
      : null;
  } catch {
    return null;
  }
}
export function clearProspectImportRecovery(): void {
  try {
    localStorage.removeItem(workspaceStorageKey(PROSPECT_IMPORT_RECOVERY_STORAGE_KEY));
  } catch {
    // Keep the visible recovery state when storage is unavailable.
  }
}
