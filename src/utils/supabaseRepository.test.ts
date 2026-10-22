import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  importRemoteProspects,
  convertRemoteProspectToOpportunity,
  registerRemoteProspectResult,
  registerRemoteQuoteSend,
} from './supabaseRepository';
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

describe('remote prospect result', () => {
  const input = {
    workspaceId: '5d6c1a4e-5f7a-4b94-b9f7-6c6b2c7a61c3',
    prospectId: '9a4e167e-8f7b-4a6d-b87c-6a671d9b7612',
    expectedVersion: 2,
    result: 'contacted',
    channel: 'instagram' as const,
    note: 'Reunión confirmada.',
    followUpAt: '2026-10-22T22:30:00.000Z',
    responsible: 'David',
    idempotencyKey: 'prospect-result:9a4e:2',
  };

  it('persists result and future step in one RPC request', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ code: 'OK', version: 3 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(registerRemoteProspectResult(input)).resolves.toEqual({
      ok: true,
      idempotent: false,
      version: 3,
    });
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(request.body as string)).toMatchObject({
      p_workspace_id: input.workspaceId,
      p_prospect_id: input.prospectId,
      p_follow_up_at: input.followUpAt,
      p_channel: 'instagram',
      p_idempotency_key: input.idempotencyKey,
    });
  });

  it('returns a typed version conflict and supports idempotent retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ code: 'CONFLICT', version: 4 }), { status: 200 }),
        ),
    );
    await expect(registerRemoteProspectResult(input)).resolves.toMatchObject({
      ok: false,
      reason: 'conflict',
      version: 4,
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 'OK', version: 3, idempotent: true }), {
          status: 200,
        }),
      ),
    );
    await expect(registerRemoteProspectResult(input)).resolves.toEqual({
      ok: true,
      idempotent: true,
      version: 3,
    });
  });

  it('does not turn a network failure into a local success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(registerRemoteProspectResult(input)).rejects.toMatchObject({ code: 'network' });
  });
});

describe('remote prospect conversion', () => {
  const input = {
    workspaceId: '5d6c1a4e-5f7a-4b94-b9f7-6c6b2c7a61c3',
    prospectId: '9a4e167e-8f7b-4a6d-b87c-6a671d9b7612',
    expectedVersion: 2,
    idempotencyKey: 'convert-prospect:9a4e:2',
  };

  it('confirms the remote conversion before the local mirror is updated', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'OK',
          version: 3,
          opportunityId: '9a4e167e-8f7b-4a6d-b87c-6a671d9b7613',
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(convertRemoteProspectToOpportunity(input)).resolves.toEqual({
      ok: true,
      idempotent: false,
      version: 3,
      opportunityId: '9a4e167e-8f7b-4a6d-b87c-6a671d9b7613',
    });
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/rest/v1/rpc/convert_prospect_to_opportunity');
    expect(JSON.parse(request.body as string)).toMatchObject({
      p_workspace_id: input.workspaceId,
      p_prospect_id: input.prospectId,
      p_expected_version: input.expectedVersion,
      p_idempotency_key: input.idempotencyKey,
    });
  });

  it('returns a typed conflict instead of creating another opportunity', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ code: 'CONFLICT', currentVersion: 4 }), { status: 200 }),
        ),
    );
    await expect(convertRemoteProspectToOpportunity(input)).resolves.toMatchObject({
      ok: false,
      reason: 'conflict',
      version: 4,
    });
  });
});

describe('remote prospect history and profile', () => {
  it('maps persisted prospect activities with their real channel and follow-up', async () => {
    const { mapRemoteProspectActivity } = await import('./supabaseRepository');
    expect(
      mapRemoteProspectActivity({
        id: 'activity-1',
        workspace_id: 'workspace',
        prospect_id: 'prospect-1',
        type: 'contactResult',
        occurred_at: '2026-10-22T22:30:00.000Z',
        created_at: '2026-10-22T22:30:00.000Z',
        result: 'contacted',
        note: 'Reunión por Instagram.',
        communication: {
          channel: 'instagram',
          followUpAt: '2026-10-23T22:30:00.000Z',
          responsible: 'David',
        },
      }),
    ).toMatchObject({
      prospectId: 'prospect-1',
      channel: 'instagram',
      followUpAt: '2026-10-23T22:30:00.000Z',
      author: 'David',
    });
  });
});
