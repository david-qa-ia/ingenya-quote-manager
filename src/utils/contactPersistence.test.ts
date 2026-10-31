import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '../types/client';
import { loadClients } from './clientStorage';
import { persistContact, syncRemoteContacts } from './contactPersistence';
import { mapRemoteContact, type SupabaseContactRow } from './supabaseRepository';

const WORKSPACE = '2c90217f-f297-4a5f-a91e-20e4962a8df2';
const local = new Map<string, string>();
const session = new Map<string, string>();

const client: Client = {
  id: '9a4e167e-8f7b-4a6d-b87c-6a671d9b7612',
  name: 'QA-P09 Contacto',
  phone: '3415550109',
  email: 'qa-p09@example.test',
  preferredChannel: 'whatsapp',
  contactConsent: true,
  createdAt: '2026-10-30T12:00:00.000Z',
  updatedAt: '2026-10-30T12:00:00.000Z',
};
const row: SupabaseContactRow = {
  id: client.id,
  workspace_id: WORKSPACE,
  name: client.name,
  company: null,
  phone: client.phone,
  email: client.email,
  preferred_channel: 'whatsapp',
  contact_consent: true,
  do_not_contact: null,
  version: 3,
  archived_at: null,
  created_at: client.createdAt,
  updated_at: '2026-10-30T13:00:00.000Z',
};
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

beforeEach(() => {
  local.clear();
  session.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => local.get(key) ?? null,
    setItem: (key: string, value: string) => local.set(key, value),
    removeItem: (key: string) => local.delete(key),
  });
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => session.get(key) ?? null,
    setItem: (key: string, value: string) => session.set(key, value),
    removeItem: (key: string) => session.delete(key),
  });
  session.set('ingenya.activeWorkspace.v1', WORKSPACE);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function withSupabase(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
  session.set(
    'ingenya.auth.session.v1',
    JSON.stringify({
      accessToken: 'token',
      expiresAt: Date.now() + 60_000,
      userId: 'u',
      email: '',
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
}

describe('contact persistence (SCRUM-113)', () => {
  it('maps a Supabase contact into a valid local client with its version', () => {
    expect(mapRemoteContact(row)).toEqual({
      ...client,
      updatedAt: row.updated_at,
      version: 3,
    });
  });

  it('saves locally when Supabase is not configured', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const result = await persistContact(client, true);
    expect(result.ok).toBe(true);
    expect(loadClients().items.map((item) => item.id)).toEqual([client.id]);
  });

  it('writes Supabase first and keeps the returned version locally', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ code: 'OK', version: 1 }));
    withSupabase(fetchMock);
    const result = await persistContact(client, true);
    expect(result).toMatchObject({ ok: true, client: { version: 1 } });
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ p_contact_id: client.id, p_expected_version: null });
    expect(loadClients().items[0].version).toBe(1);
  });

  it('does not save locally when Supabase reports a duplicate or is unreachable', async () => {
    withSupabase(
      vi
        .fn()
        .mockResolvedValueOnce(json({ code: 'DUPLICATE', contactId: 'other', name: 'Martín' }))
        .mockRejectedValueOnce(new TypeError('Failed to fetch')),
    );
    const duplicate = await persistContact(client, true);
    expect(duplicate).toEqual({
      ok: false,
      error: 'Ya existe un contacto con ese email o teléfono: Martín. Buscalo y usá ese contacto.',
    });
    const offline = await persistContact(client, true);
    expect(offline.ok).toBe(false);
    expect(loadClients().items).toHaveLength(0);
  });

  it('sends the known version when editing and reports conflicts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ code: 'CONFLICT', version: 5 }));
    withSupabase(fetchMock);
    const result = await persistContact({ ...client, version: 3 }, false);
    expect(result.ok).toBe(false);
    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.p_expected_version).toBe(3);
  });

  it('copies remote contacts into the browser copy', async () => {
    withSupabase(vi.fn().mockResolvedValue(json([row])));
    await expect(syncRemoteContacts(WORKSPACE)).resolves.toEqual({ loaded: 1, failed: 0 });
    expect(loadClients().items[0]).toMatchObject({ id: client.id, version: 3 });
  });
});
