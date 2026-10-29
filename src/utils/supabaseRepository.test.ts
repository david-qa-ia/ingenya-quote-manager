import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRemoteProspect,
  importRemoteProspects,
  convertRemoteProspectToOpportunity,
  fromSupabaseProspectChannel,
  mapRemoteProspect,
  registerRemoteProspectResult,
  registerRemoteQuoteSend,
  setRemoteProspectArchived,
  toSupabaseProspectChannel,
  updateRemoteProspectProfile,
} from './supabaseRepository';
import { prepareProspectImport } from './prospectImportTransaction';
import { isProspect } from './prospectStorage';
import type { Prospect } from '../types/prospect';

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

  it('writes a phone result as call and maps it back when loading history', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ code: 'OK', version: 3 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await registerRemoteProspectResult({ ...input, channel: 'phone' });
    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(request.body as string).p_channel).toBe('call');

    const { mapRemoteProspectActivity } = await import('./supabaseRepository');
    expect(
      mapRemoteProspectActivity({
        id: 'activity-call',
        workspace_id: 'workspace',
        prospect_id: 'prospect-1',
        type: 'contactResult',
        occurred_at: '2026-10-22T22:30:00.000Z',
        created_at: '2026-10-22T22:30:00.000Z',
        result: 'contacted',
        note: '',
        communication: { channel: 'call' },
      }).channel,
    ).toBe('phone');
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
          contactId: '0b8f3f3e-2f8a-4d5c-9e1a-3c2b1a0f9e8d',
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
      contactId: '0b8f3f3e-2f8a-4d5c-9e1a-3c2b1a0f9e8d',
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

  it('maps the replaced follow-up date of a rescheduled next step (SCRUM-103)', async () => {
    const { mapRemoteProspectActivity } = await import('./supabaseRepository');
    expect(
      mapRemoteProspectActivity({
        id: 'activity-2',
        workspace_id: 'workspace',
        prospect_id: 'prospect-1',
        type: 'contactResult',
        occurred_at: '2026-10-28T15:39:30.000Z',
        created_at: '2026-10-28T15:39:30.000Z',
        result: 'noResponse',
        note: '',
        communication: {
          channel: 'call',
          followUpAt: '2026-11-04T13:00:00.000Z',
          previousFollowUpAt: '2026-11-02T18:00:00.000Z',
        },
      }),
    ).toMatchObject({
      channel: 'phone',
      followUpAt: '2026-11-04T13:00:00.000Z',
      previousFollowUpAt: '2026-11-02T18:00:00.000Z',
    });
  });

  it('translates every prospect channel at the Supabase boundary', () => {
    expect(toSupabaseProspectChannel('phone')).toBe('call');
    expect(toSupabaseProspectChannel('whatsapp')).toBe('whatsapp');
    expect(toSupabaseProspectChannel('email')).toBe('email');
    expect(toSupabaseProspectChannel('instagram')).toBe('instagram');
    expect(toSupabaseProspectChannel('')).toBe('');
    expect(fromSupabaseProspectChannel('call')).toBe('phone');
    expect(fromSupabaseProspectChannel('phone')).toBe('phone');
    expect(fromSupabaseProspectChannel('whatsapp')).toBe('whatsapp');
    expect(fromSupabaseProspectChannel('email')).toBe('email');
    expect(fromSupabaseProspectChannel('instagram')).toBe('instagram');
    expect(fromSupabaseProspectChannel(null)).toBe('');
  });

  it('maps converted remote prospects into valid local mirror records', () => {
    const mapped = mapRemoteProspect({
      id: 'prospect-1',
      workspace_id: 'workspace',
      name: 'Ana',
      company: 'Obras Sur',
      phone: '3415550101',
      email: 'ana@example.com',
      instagram: null,
      address: null,
      source: 'Referido',
      potential_service: 'Pintura',
      notes: '',
      status: 'converted',
      priority: 'medium',
      priority_reason: '',
      next_action: '',
      next_action_at: null,
      responsible: '',
      preferred_channel: 'call',
      conversion: { contactId: 'contact-1', opportunityId: 'opportunity-1' },
      version: 4,
      created_at: '2026-10-28T13:00:00.000Z',
      updated_at: '2026-10-28T14:00:00.000Z',
    });

    expect(isProspect(mapped)).toBe(true);
    expect(mapped).toMatchObject({
      preferredChannel: 'phone',
      conversion: {
        state: 'completed',
        draft: { clientId: 'contact-1', opportunityId: 'opportunity-1' },
      },
    });
  });

  it('writes phone as call for profile, creation and import requests', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ code: 'OK', version: 2, importedCount: 1 }), {
          status: 200,
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const prospect: Prospect = {
      id: 'prospect-1',
      name: 'Ana',
      company: '',
      phone: '3415550101',
      email: 'ana@example.com',
      source: '',
      potentialService: '',
      notes: '',
      status: 'uncontacted',
      priority: 'medium',
      priorityReason: '',
      nextAction: '',
      nextActionAt: '',
      responsible: '',
      preferredChannel: 'phone',
      activities: [],
      createdAt: '2026-10-28T13:00:00.000Z',
      updatedAt: '2026-10-28T13:00:00.000Z',
      version: 1,
    };

    await updateRemoteProspectProfile({
      workspaceId: 'workspace',
      prospect,
      idempotencyKey: 'update-prospect-1',
    });
    await createRemoteProspect('workspace', prospect);
    await importRemoteProspects(
      'workspace',
      prepareProspectImport(
        [{ line: 2, input: prospect, duplicate: false }],
        {
          schedule: true,
          channel: 'phone',
          dueAt: '2026-10-29T13:00:00.000Z',
          responsible: 'David',
          note: '',
        },
        'phone-channel',
        '2026-10-28T13:00:00.000Z',
      ),
    );

    const profile = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    const creation = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const imported = JSON.parse(fetchMock.mock.calls[2][1].body as string);
    expect(profile.p_payload.preferredChannel).toBe('call');
    expect(creation.p_payload.preferredChannel).toBe('call');
    expect(imported.p_prospects[0].preferredChannel).toBe('call');
  });
});

describe('remote prospect archive (SCRUM-111)', () => {
  const workspaceId = '5d6c1a4e-5f7a-4b94-b9f7-6c6b2c7a61c3';
  const prospect = mapRemoteProspect({
    id: '9a4e167e-8f7b-4a6d-b87c-6a671d9b7612',
    workspace_id: workspaceId,
    name: 'QA-P06 Archivo',
    company: '',
    phone: '3415550106',
    email: '',
    instagram: null,
    address: null,
    source: 'Referido',
    potential_service: '',
    notes: '',
    status: 'notInterested',
    priority: 'low',
    priority_reason: '',
    next_action: '',
    next_action_at: null,
    responsible: 'QA Tester',
    preferred_channel: 'call',
    archived_at: '2026-10-29T12:00:00.000Z',
    version: 2,
    created_at: '2026-10-28T13:00:00.000Z',
    updated_at: '2026-10-29T12:00:00.000Z',
  });

  it('maps archived_at into a valid local mirror record', () => {
    expect(prospect.archivedAt).toBe('2026-10-29T12:00:00.000Z');
    expect(isProspect(prospect)).toBe(true);
  });

  it('sends the archive with version, reason and an idempotency key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ code: 'OK', version: 3, archivedAt: '2026-10-29T13:00:00.000Z' }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      setRemoteProspectArchived({
        workspaceId,
        prospect,
        archived: true,
        reason: 'Duplicado',
        author: 'qa@example.test',
      }),
    ).resolves.toEqual({ ok: true, version: 3, archivedAt: '2026-10-29T13:00:00.000Z' });
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/rest/v1/rpc/set_prospect_archived');
    expect(JSON.parse(request.body as string)).toMatchObject({
      p_prospect_id: prospect.id,
      p_expected_version: 2,
      p_archived: true,
      p_reason: 'Duplicado',
      p_idempotency_key: `archive-prospect:${prospect.id}:2`,
    });
  });

  it('reports a conflict and a missing prospect without throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ code: 'CONFLICT', version: 5 }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ code: 'NOT_FOUND' }), { status: 200 }),
        ),
    );
    const input = { workspaceId, prospect, archived: false, reason: '', author: '' };
    await expect(setRemoteProspectArchived(input)).resolves.toMatchObject({
      ok: false,
      reason: 'conflict',
      version: 5,
    });
    await expect(setRemoteProspectArchived(input)).resolves.toMatchObject({
      ok: false,
      reason: 'notFound',
    });
  });
});
