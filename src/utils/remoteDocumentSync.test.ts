import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  flushRemoteDocumentChanges,
  hasPendingDocumentChanges,
  resetRemoteDocumentSync,
  startRemoteDocumentSync,
} from './remoteDocumentSync';
import { REMOTE_SYNC_FAILED_EVENT } from './remoteCommercialSync';

const WS = '2c90217f-f297-4a5f-a91e-20e4962a8df2';
const local = new Map<string, string>();
const session = new Map<string, string>();
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const quotesKey = `${WS}::ingenya.savedQuotes.v1`;
const catalogKey = `${WS}::ingenya.laborCatalog.v1`;
const activitiesKey = `${WS}::ingenya.activities.v1`;
const readLocal = (key: string) => JSON.parse(local.get(key) ?? '[]') as { id: string }[];

type Change = { collection: string; id: string; expectedVersion: number | null; data: unknown };

function setup(
  remoteRows: unknown[],
  rpc: (changes: Change[]) => Response | Promise<Response> = (changes) =>
    json({
      code: 'OK',
      versions: Object.fromEntries(
        changes.map((c) => [`${c.collection}:${c.id}`, (c.expectedVersion ?? 0) + 1]),
      ),
    }),
) {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
  const calls: Change[][] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      if (url.includes('/rpc/sync_workspace_documents')) {
        const changes = (JSON.parse(init!.body as string) as { p_changes: Change[] }).p_changes;
        calls.push(changes);
        return Promise.resolve(rpc(changes));
      }
      if (url.includes('/workspace_documents')) return Promise.resolve(json(remoteRows));
      return Promise.resolve(json([]));
    }),
  );
  return calls;
}

beforeEach(() => {
  local.clear();
  session.clear();
  resetRemoteDocumentSync();
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
});
afterEach(() => {
  resetRemoteDocumentSync();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('remote document sync (SCRUM-123)', () => {
  it('loads remote quotes, drops deleted ones and uploads what only existed in this browser', async () => {
    local.set(
      quotesKey,
      JSON.stringify([
        { id: 'PRES-LOCAL', total: 1 },
        { id: 'PRES-GONE', total: 2 },
        { id: 'PRES-SHARED', total: 3 },
      ]),
    );
    const calls = setup([
      {
        collection: 'savedQuotes',
        id: 'PRES-SHARED',
        data: { id: 'PRES-SHARED', total: 30 },
        version: 4,
        deleted_at: null,
      },
      {
        collection: 'savedQuotes',
        id: 'PRES-GONE',
        data: null,
        version: 2,
        deleted_at: '2026-11-01T00:00:00Z',
      },
      {
        collection: 'savedQuotes',
        id: 'PRES-OTHER',
        data: { id: 'PRES-OTHER', total: 5 },
        version: 1,
        deleted_at: null,
      },
    ]);
    await startRemoteDocumentSync(WS);
    const ids = readLocal(quotesKey)
      .map((q) => q.id)
      .sort();
    expect(ids).toEqual(['PRES-LOCAL', 'PRES-OTHER', 'PRES-SHARED']);
    expect(readLocal(quotesKey).find((q) => q.id === 'PRES-SHARED')).toEqual({
      id: 'PRES-SHARED',
      total: 30,
    });
    expect(calls).toEqual([
      [
        {
          collection: 'savedQuotes',
          id: 'PRES-LOCAL',
          expectedVersion: null,
          data: { id: 'PRES-LOCAL', total: 1 },
        },
      ],
    ]);
    expect(hasPendingDocumentChanges()).toBe(false);
  });

  it('sends edits and deletions with the confirmed version', async () => {
    const calls = setup([
      {
        collection: 'laborCatalog',
        id: 'job-1',
        data: { id: 'job-1', name: 'A' },
        version: 3,
        deleted_at: null,
      },
      {
        collection: 'laborCatalog',
        id: 'job-2',
        data: { id: 'job-2', name: 'B' },
        version: 1,
        deleted_at: null,
      },
    ]);
    await startRemoteDocumentSync(WS);
    local.set(catalogKey, JSON.stringify([{ id: 'job-1', name: 'A2' }]));
    await flushRemoteDocumentChanges();
    expect(calls.at(-1)).toEqual([
      {
        collection: 'laborCatalog',
        id: 'job-1',
        expectedVersion: 3,
        data: { id: 'job-1', name: 'A2' },
      },
      { collection: 'laborCatalog', id: 'job-2', expectedVersion: 1, data: null },
    ]);
  });

  it('only syncs quote activity; contact and opportunity activity stay with SCRUM-114', async () => {
    const calls = setup([]);
    await startRemoteDocumentSync(WS);
    const quoteActivity = {
      id: 'act-q',
      type: 'note',
      occurredAt: '2026-11-04T10:00:00.000Z',
      author: 'David',
      result: 'Presupuesto creado.',
      note: '',
      source: 'automatic',
      noteRevisions: [],
      subject: { kind: 'quote', quoteId: 'PRES-1' },
    };
    const opportunityActivity = {
      ...quoteActivity,
      id: 'act-o',
      subject: { kind: 'opportunity', opportunityId: 'x' },
    };
    local.set(activitiesKey, JSON.stringify([quoteActivity, opportunityActivity]));
    await flushRemoteDocumentChanges();
    expect(calls.at(-1)?.map((c) => `${c.collection}:${c.id}`)).toEqual(['quoteActivities:act-q']);
  });

  it('restores the browser copy and warns when Supabase reports a conflict', async () => {
    setup(
      [
        {
          collection: 'savedQuotes',
          id: 'PRES-1',
          data: { id: 'PRES-1', total: 1 },
          version: 1,
          deleted_at: null,
        },
      ],
      () => json({ code: 'CONFLICT' }),
    );
    const messages: string[] = [];
    window.addEventListener(REMOTE_SYNC_FAILED_EVENT, (event) =>
      messages.push((event as CustomEvent<string>).detail),
    );
    await startRemoteDocumentSync(WS);
    local.set(
      quotesKey,
      JSON.stringify([
        { id: 'PRES-1', total: 99 },
        { id: 'PRES-NEW', total: 7 },
      ]),
    );
    await flushRemoteDocumentChanges();
    expect(readLocal(quotesKey)).toEqual([{ id: 'PRES-1', total: 1 }]);
    expect(messages[0]).toMatch(/otra persona modificó/);
  });

  it('brings back a record deleted locally when the deletion cannot be saved', async () => {
    setup(
      [
        {
          collection: 'savedQuotes',
          id: 'PRES-1',
          data: { id: 'PRES-1' },
          version: 1,
          deleted_at: null,
        },
      ],
      () => Promise.reject(new Error('offline')),
    );
    await startRemoteDocumentSync(WS);
    local.set(quotesKey, JSON.stringify([]));
    await flushRemoteDocumentChanges();
    expect(readLocal(quotesKey)).toEqual([{ id: 'PRES-1' }]);
  });

  it('does nothing without Supabase (local mode keeps the browser as the only copy)', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await startRemoteDocumentSync(WS);
    local.set(quotesKey, JSON.stringify([{ id: 'PRES-1' }]));
    await flushRemoteDocumentChanges();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('leaves an unused collection unwritten so its defaults still load and get uploaded', async () => {
    setup([]);
    await startRemoteDocumentSync(WS);
    expect(local.has(catalogKey)).toBe(false);
  });
});
