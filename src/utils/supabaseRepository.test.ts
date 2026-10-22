import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importRemoteProspects, registerRemoteQuoteSend } from './supabaseRepository';
import { prepareProspectImport } from './prospectImportTransaction';

const session = new Map<string, string>();
beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => session.get(key) ?? null,
    setItem: (key: string, value: string) => session.set(key, value),
    removeItem: (key: string) => session.delete(key),
  });
  session.set(
    'ingenya.auth.session.v1',
    JSON.stringify({
      accessToken: 'token',
      expiresAt: Date.now() + 60_000,
      userId: 'user',
      email: '',
    }),
  );
});
afterEach(() => {
  session.clear();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const input = {
  workspaceId: 'workspace',
  quoteVersionId: 'version',
  expectedVersion: 3,
  channel: 'whatsapp',
  recipient: '3415550101',
  sentAt: '2026-10-21T13:00:00.000Z',
  note: 'Enviado',
  nextAction: { type: 'call' as const, dueAt: '2026-10-22T13:00:00.000Z', responsible: 'David' },
  nextActionDecision: 'replace' as const,
  idempotencyKey: 'quote-send:version',
};

describe('remote quote send', () => {
  it('sends the follow-up and replacement decision in the same RPC request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ code: 'OK', version: 4 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(registerRemoteQuoteSend(input)).resolves.toMatchObject({ ok: true, version: 4 });
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(request.body as string)).toMatchObject({
      p_next_action_decision: 'replace',
      p_next_action: { type: 'call', responsible: 'David' },
    });
  });
  it('returns a typed conflict without creating a fallback result', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ code: 'CONFLICT' }), { status: 200 })),
    );
    await expect(registerRemoteQuoteSend(input)).resolves.toMatchObject({
      ok: false,
      reason: 'conflict',
    });
  });
  it('accepts an idempotent retry without creating a second result locally', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 'OK', version: 4, idempotent: true }), {
          status: 200,
        }),
      ),
    );
    await expect(registerRemoteQuoteSend(input)).resolves.toEqual({
      ok: true,
      version: 4,
      idempotent: true,
    });
  });
  it('reports a typed network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(registerRemoteQuoteSend(input)).rejects.toMatchObject({ code: 'network' });
  });
});

describe('remote prospect import', () => {
  const prepared = prepareProspectImport(
    [
      {
        line: 2,
        input: {
          name: 'Ana',
          company: '',
          phone: '3415550101',
          email: '',
          source: '',
          potentialService: '',
          notes: '',
          status: 'uncontacted',
          priority: 'medium',
          priorityReason: '',
          nextAction: '',
          nextActionAt: '',
          responsible: '',
          preferredChannel: '',
        },
        duplicate: false,
      },
    ],
    { schedule: false, channel: 'whatsapp', dueAt: '', responsible: '', note: '' },
    'remote-import',
    '2026-10-22T12:00:00.000Z',
  );
  it('returns the typed count and idempotency result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 'OK', importedCount: 1, idempotent: true }), {
          status: 200,
        }),
      ),
    );
    await expect(importRemoteProspects('workspace', prepared)).resolves.toEqual({
      importedCount: 1,
      idempotent: true,
    });
  });
  it('rejects a 2xx response whose count does not match the prepared batch', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ code: 'OK', importedCount: 0 }), { status: 200 }),
        ),
    );
    await expect(importRemoteProspects('workspace', prepared)).rejects.toMatchObject({
      code: 'server',
    });
  });
  it('reports an unavailable RPC as a server error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    await expect(importRemoteProspects('workspace', prepared)).rejects.toMatchObject({
      code: 'server',
    });
  });
});
