import { isAuthConfigured } from './authService';
import {
  loadResponsibles,
  loadResponsiblesVersion,
  saveResponsibles,
  saveResponsiblesVersion,
  seedResponsiblesFromNames,
  type Responsible,
} from './responsibleStorage';
import { loadRemoteResponsibles, saveRemoteResponsibles } from './supabaseRepository';
import { isWorkspaceUuid } from './workspaceStorage';

const isRemote = (workspaceId?: string): workspaceId is string =>
  isAuthConfigured() && isWorkspaceUuid(workspaceId);

/**
 * SCRUM-117: brings the shared list to this device. The first time a workspace has no list,
 * names already typed in older records become the initial list (and are saved remotely).
 */
export async function syncResponsibles(
  workspaceId: string | undefined,
  existingNames: readonly string[],
): Promise<void> {
  if (!isRemote(workspaceId)) {
    if (!loadResponsibles().length) {
      const seeded = seedResponsiblesFromNames(existingNames);
      if (seeded.length) saveResponsibles(seeded);
    }
    return;
  }
  const remote = await loadRemoteResponsibles(workspaceId);
  if (remote.list.some((item) => item.active)) {
    saveResponsibles(remote.list);
    saveResponsiblesVersion(remote.version);
    return;
  }
  const local = loadResponsibles().filter((item) => item.active);
  const initial = local.length ? local : seedResponsiblesFromNames(existingNames);
  if (!initial.length) return;
  const saved = await saveRemoteResponsibles(workspaceId, initial, remote.version);
  if (saved.ok) {
    saveResponsibles(initial);
    saveResponsiblesVersion(saved.version);
  }
}

export type PersistResponsiblesResult = { ok: true } | { ok: false; message: string };

/** Saves the list edited in Configuración: Supabase first when configured, then this device. */
export async function persistResponsibles(
  workspaceId: string | undefined,
  list: readonly Responsible[],
): Promise<PersistResponsiblesResult> {
  if (!isRemote(workspaceId)) {
    return saveResponsibles(list)
      ? { ok: true }
      : { ok: false, message: 'No se pudo guardar la lista en este navegador.' };
  }
  try {
    const saved = await saveRemoteResponsibles(workspaceId, list, loadResponsiblesVersion());
    if (!saved.ok) {
      if (saved.reason === 'conflict') {
        const remote = await loadRemoteResponsibles(workspaceId);
        saveResponsibles(remote.list);
        saveResponsiblesVersion(remote.version);
      }
      return { ok: false, message: saved.message };
    }
    saveResponsibles(list);
    saveResponsiblesVersion(saved.version);
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: 'No se pudo conectar con Supabase. La lista no se modificó; intentá de nuevo.',
    };
  }
}
