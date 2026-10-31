import type { Client } from '../types/client';
import { isAuthConfigured } from './authService';
import { loadClients, saveClient } from './clientStorage';
import { loadRemoteContacts, mapRemoteContact, saveRemoteContact } from './supabaseRepository';
import { getActiveWorkspaceId, isWorkspaceUuid } from './workspaceStorage';

export type ContactPersistResult = { ok: true; client: Client } | { ok: false; error: string };

/**
 * Saves a client (SCRUM-113). With Supabase configured, Supabase is written first and the
 * browser copy only after it confirms; without a connection the change is not saved, so the
 * local copy never diverges from Supabase. Without Supabase (local-only mode) it saves locally.
 */
export async function persistContact(
  client: Client,
  isNew: boolean,
): Promise<ContactPersistResult> {
  let next = client;
  if (isAuthConfigured()) {
    const workspaceId = getActiveWorkspaceId();
    if (!isWorkspaceUuid(workspaceId))
      return {
        ok: false,
        error:
          'No se pudo identificar el espacio de trabajo en Supabase. Volvé a iniciar sesión o seleccioná otro espacio.',
      };
    try {
      const remote = await saveRemoteContact({ workspaceId, client, isNew });
      if (!remote.ok) return { ok: false, error: remote.message };
      next = {
        ...client,
        version: remote.version,
        ...(remote.updatedAt ? { updatedAt: remote.updatedAt } : {}),
      };
    } catch {
      return {
        ok: false,
        error:
          'No se pudo guardar el contacto porque no hay conexión con Supabase. Revisá la conexión y volvé a intentar; lo que cargaste sigue en el formulario.',
      };
    }
  }
  if (!saveClient(next))
    return {
      ok: false,
      error: 'No se pudo guardar el contacto. Los datos existentes se conservaron.',
    };
  return { ok: true, client: next };
}

/**
 * Loads the workspace contacts from Supabase into the browser copy (SCRUM-113). Remote contacts
 * replace their local copy; local-only records stay until later phases move them.
 */
export async function syncRemoteContacts(
  workspaceId: string,
): Promise<{ loaded: number; failed: number }> {
  const rows = await loadRemoteContacts(workspaceId);
  let failed = 0;
  for (const row of rows) if (!saveClient(mapRemoteContact(row))) failed += 1;
  return { loaded: rows.length - failed, failed };
}

export function findLocalClient(id: string): Client | undefined {
  return loadClients().items.find((item) => item.id === id);
}
