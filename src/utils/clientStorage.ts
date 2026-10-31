import type { Client } from '../types/client';
import { isClient, normalizeClientInput } from './clientValidation';
import { loadCollection, saveCollectionItem } from './localCollectionStorage';

export const CLIENTS_STORAGE_KEY = 'ingenya.clients.v1';
export const loadClients = () => loadCollection(CLIENTS_STORAGE_KEY, isClient);

export function saveClient(client: Client): boolean {
  if (!isClient(client)) return false;
  return saveCollectionItem(
    CLIENTS_STORAGE_KEY,
    {
      ...normalizeClientInput(client),
      id: client.id,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
      ...(client.version !== undefined ? { version: client.version } : {}),
    },
    isClient,
  );
}
