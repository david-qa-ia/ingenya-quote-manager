import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EXPIRED_LINK_MESSAGE,
  getNewPasswordError,
  parseRecoveryFragment,
  requestPasswordReset,
  updatePasswordWithRecovery,
} from './passwordRecovery';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function stubSupabase() {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
}

describe('password recovery (SCRUM-126)', () => {
  it('reads the recovery tokens from the emailed link', () => {
    expect(
      parseRecoveryFragment(
        '#access_token=a&expires_in=600&refresh_token=r&token_type=bearer&type=recovery',
      ),
    ).toEqual({
      kind: 'recovery',
      recovery: { accessToken: 'a', refreshToken: 'r', expiresIn: 600 },
    });
  });

  it('turns an expired or used link into a clear message', () => {
    expect(
      parseRecoveryFragment(
        '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid',
      ),
    ).toEqual({ kind: 'error', message: EXPIRED_LINK_MESSAGE });
  });

  it('ignores the app routes and other fragments', () => {
    expect(parseRecoveryFragment('#/presupuestos')).toBeNull();
    expect(parseRecoveryFragment('')).toBeNull();
    expect(parseRecoveryFragment('#access_token=a&refresh_token=r&type=signup')).toBeNull();
  });

  it('asks for 8 characters and a matching confirmation', () => {
    expect(getNewPasswordError('corta', 'corta')).toMatch(/al menos 8/);
    expect(getNewPasswordError('larga-123', 'larga-124')).toBe('Las contraseñas no coinciden.');
    expect(getNewPasswordError('larga-123', 'larga-123')).toBeNull();
  });

  it('requests the email with the app as the return address', async () => {
    stubSupabase();
    vi.stubGlobal('window', {
      location: { origin: 'https://gestion.somosventro.com', pathname: '/' },
    });
    const fetchMock = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    await requestPasswordReset('martita@pasteleria.com');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      'https://example.supabase.co/auth/v1/recover?redirect_to=https%3A%2F%2Fgestion.somosventro.com%2F',
    );
    expect(JSON.parse(init.body as string)).toEqual({ email: 'martita@pasteleria.com' });
  });

  it('reports too many requests', async () => {
    stubSupabase();
    vi.stubGlobal('window', { location: { origin: 'https://x', pathname: '/' } });
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}', { status: 429 }))),
    );
    await expect(requestPasswordReset('a@b.com')).rejects.toThrow('rate-limited');
  });

  it('saves the new password and keeps the person signed in', async () => {
    stubSupabase();
    const session = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => session.get(key) ?? null,
      setItem: (key: string, value: string) => session.set(key, value),
      removeItem: (key: string) => session.delete(key),
    });
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ id: 'u1', email: 'm@p.com' }), { status: 200 }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    await updatePasswordWithRecovery(
      { accessToken: 'a', refreshToken: 'r', expiresIn: 600 },
      'nueva-123',
    );
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('PUT');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer a');
    expect(JSON.parse(session.get('ingenya.auth.session.v1')!)).toMatchObject({
      accessToken: 'a',
      refreshToken: 'r',
      userId: 'u1',
      email: 'm@p.com',
    });
  });

  it('explains an expired session and a repeated password', async () => {
    stubSupabase();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}', { status: 401 }))),
    );
    await expect(
      updatePasswordWithRecovery(
        { accessToken: 'a', refreshToken: 'r', expiresIn: 1 },
        'nueva-123',
      ),
    ).rejects.toThrow('expired');
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error_code: 'same_password' }), { status: 422 }),
        ),
      ),
    );
    await expect(
      updatePasswordWithRecovery(
        { accessToken: 'a', refreshToken: 'r', expiresIn: 1 },
        'nueva-123',
      ),
    ).rejects.toThrow('same-password');
  });
});
