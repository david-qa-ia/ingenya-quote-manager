import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addWorkspaceMember,
  listWorkspaceMembers,
  removeWorkspaceMember,
} from './supabaseRepository';

const WS = '2c90217f-f297-4a5f-a91e-20e4962a8df2';
const session = new Map<string, string>();
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

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
    JSON.stringify({ accessToken: 't', expiresAt: Date.now() + 60_000, userId: 'u', email: '' }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('workspace members (SCRUM-125)', () => {
  it('lists members of the workspace through the owner-only RPC', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(json([{ userId: 'a', email: 'martita@p.com', role: 'owner', isYou: true }])),
    );
    vi.stubGlobal('fetch', fetchMock);
    const members = await listWorkspaceMembers(WS);
    expect(members[0].email).toBe('martita@p.com');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/rpc\/list_workspace_members$/);
    expect(JSON.parse(init.body as string)).toEqual({ p_workspace_id: WS });
  });

  it('adds by email with an idempotency key and returns the server message on refusal', async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        bodies.push(JSON.parse(init!.body as string) as Record<string, unknown>);
        return Promise.resolve(
          json(
            bodies.length === 1
              ? { code: 'OK' }
              : { code: 'NOT_FOUND', message: 'No hay ningún usuario con ese email.' },
          ),
        );
      }),
    );
    expect(await addWorkspaceMember(WS, 'david@ventro.com')).toEqual({ ok: true });
    expect(bodies[0]).toMatchObject({ p_workspace_id: WS, p_email: 'david@ventro.com' });
    expect(String(bodies[0].p_idempotency_key)).toMatch(/^add-member:/);
    expect(await addWorkspaceMember(WS, 'x@y.com')).toEqual({
      ok: false,
      message: 'No hay ningún usuario con ese email.',
    });
  });

  it('removes a member by user id', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(json({ code: 'OK' })));
    vi.stubGlobal('fetch', fetchMock);
    expect(await removeWorkspaceMember(WS, 'user-1')).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/rpc\/remove_workspace_member$/);
    expect(JSON.parse(init.body as string)).toMatchObject({ p_user_id: 'user-1' });
  });
});
