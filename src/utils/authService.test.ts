import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getValidAuthSession } from './authService';

const values = new Map<string, string>();

describe('auth session refresh', () => {
  beforeEach(() => {
    values.clear();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('refreshes an expired session before a protected operation', async () => {
    values.set(
      'ingenya.auth.session.v1',
      JSON.stringify({
        accessToken: 'expired-token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() - 1,
        userId: 'user-1',
        email: 'david@example.com',
      }),
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'fresh-token',
          refresh_token: 'fresh-refresh-token',
          expires_in: 3600,
          user: { id: 'user-1', email: 'david@example.com' },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getValidAuthSession()).resolves.toMatchObject({ accessToken: 'fresh-token' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.supabase.co/auth/v1/token?grant_type=refresh_token',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
