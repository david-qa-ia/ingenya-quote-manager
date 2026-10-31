import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from '../types/client';
import type { Opportunity } from '../types/opportunity';
import { saveActivity, loadActivities } from './activityStorage';
import { saveClient } from './clientStorage';
import { loadOpportunities, saveOpportunity } from './opportunityStorage';
import {
  flushRemoteCommercialChanges,
  REMOTE_SYNC_FAILED_EVENT,
  resetRemoteCommercialSync,
  startRemoteCommercialSync,
} from './remoteCommercialSync';

const WS = '2c90217f-f297-4a5f-a91e-20e4962a8df2';
const local = new Map<string, string>();
const session = new Map<string, string>();
const now = '2026-10-30T12:00:00.000Z';
const client: Client = {
  id: 'a0000000-0000-4000-8000-000000000001',
  name: 'QA-P11',
  phone: '3415550111',
  email: 'none',
  preferredChannel: '',
  contactConsent: false,
  createdAt: now,
  updatedAt: now,
};
const opportunity: Opportunity = {
  id: 'b0000000-0000-4000-8000-000000000001',
  clientId: client.id,
  name: 'Obra QA-P11',
  address: '',
  estimatedStartDate: '',
  responsibleSeller: 'QA',
  createdAt: now,
  updatedAt: now,
};
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

function setup(rpc: (body: Record<string, unknown>) => Response | Promise<Response>) {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url.includes('/rpc/sync_commercial_records'))
      return Promise.resolve(rpc(JSON.parse(init!.body as string)));
    return Promise.resolve(json([]));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  local.clear();
  session.clear();
  resetRemoteCommercialSync();
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
  vi.stubGlobal('window', new EventTarget());
  session.set('ingenya.activeWorkspace.v1', WS);
  session.set(
    'ingenya.auth.session.v1',
    JSON.stringify({ accessToken: 't', expiresAt: Date.now() + 60_000, userId: 'u', email: '' }),
  );
  saveClient(client);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('remote commercial sync (SCRUM-114)', () => {
  it('sends a new opportunity with its local contact and then edits it with the returned version', async () => {
    const calls: Record<string, unknown>[] = [];
    setup((body) => {
      calls.push(body);
      return json({ code: 'OK', versions: { [opportunity.id]: calls.length } });
    });
    await startRemoteCommercialSync(WS);
    expect(saveOpportunity(opportunity)).toBe(true);
    await flushRemoteCommercialChanges();
    expect(calls[0]).toMatchObject({
      p_contacts: [{ id: client.id }],
      p_opportunities: [{ expectedVersion: null, data: { id: opportunity.id } }],
    });
    saveOpportunity({ ...opportunity, name: 'Editada', updatedAt: '2026-10-30T13:00:00.000Z' });
    await flushRemoteCommercialChanges();
    expect(calls[1]).toMatchObject({
      p_opportunities: [{ expectedVersion: 1, data: { name: 'Editada' } }],
    });
  });

  it('sends contact and opportunity activity but leaves quote activity local', async () => {
    const calls: Record<string, unknown>[] = [];
    setup((body) => {
      calls.push(body);
      return json({ code: 'OK', versions: {} });
    });
    await startRemoteCommercialSync(WS);
    const base = {
      type: 'note' as const,
      occurredAt: now,
      author: 'QA',
      result: 'Nota registrada',
      note: 'Nota',
      source: 'manual' as const,
      noteRevisions: [],
    };
    saveActivity({
      ...base,
      id: 'c0000000-0000-4000-8000-000000000001',
      subject: { kind: 'client', clientId: client.id },
    });
    saveActivity({
      ...base,
      id: 'c0000000-0000-4000-8000-000000000002',
      subject: { kind: 'quote', quoteId: 'PRES-2026-ABC' },
    });
    await flushRemoteCommercialChanges();
    expect((calls[0].p_activities as { id: string }[]).map((item) => item.id)).toEqual([
      'c0000000-0000-4000-8000-000000000001',
    ]);
    expect(loadActivities().items).toHaveLength(2);
  });

  it('undoes the local change and reports why when Supabase rejects it or is unreachable', async () => {
    const responses = [json({ code: 'CONFLICT' }), Promise.reject(new TypeError('offline'))];
    setup(() => responses.shift() as Response);
    const messages: string[] = [];
    window.addEventListener(REMOTE_SYNC_FAILED_EVENT, (event) =>
      messages.push((event as CustomEvent<string>).detail),
    );
    await startRemoteCommercialSync(WS);
    saveOpportunity(opportunity);
    await flushRemoteCommercialChanges();
    expect(loadOpportunities().items).toHaveLength(0);
    saveOpportunity(opportunity);
    await flushRemoteCommercialChanges();
    expect(loadOpportunities().items).toHaveLength(0);
    expect(messages[0]).toMatch(/otra persona modificó/);
    expect(messages[1]).toMatch(/no hay conexión con Supabase/);
  });

  it('loads remote opportunities, including rows created by server flows', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          json(
            url.includes('/rest/v1/opportunities')
              ? [
                  {
                    id: opportunity.id,
                    workspace_id: WS,
                    contact_id: client.id,
                    name: 'Creada por conversión',
                    address: '',
                    estimated_start_date: null,
                    responsible_seller: '',
                    origin: null,
                    status: 'active',
                    commercial_state: 'open',
                    pipeline_stage: 'opportunity',
                    document: null,
                    version: 1,
                    archived_at: null,
                    created_at: now,
                    updated_at: now,
                  },
                ]
              : [],
          ),
        ),
      ),
    );
    await startRemoteCommercialSync(WS);
    expect(loadOpportunities().items.map((item) => item.name)).toEqual(['Creada por conversión']);
  });
});
