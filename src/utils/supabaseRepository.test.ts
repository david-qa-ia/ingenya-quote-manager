import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerRemoteQuoteSend } from './supabaseRepository';

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
    await expect(registerRemoteQuoteSend(input)).rejects.toMatchObject({ code: 'conflict' });
  });
  it('reports a typed network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(registerRemoteQuoteSend(input)).rejects.toMatchObject({ code: 'network' });
  });
});
