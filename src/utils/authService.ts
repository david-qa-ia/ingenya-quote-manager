export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
  email: string;
}

const SESSION_KEY = 'ingenya.auth.session.v1';

export function getSupabaseConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = (
    import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  )?.trim();
  return url && anonKey ? { url, anonKey } : null;
}

export function isAuthConfigured(): boolean {
  return getSupabaseConfig() !== null;
}

export function loadAuthSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    if (!session.accessToken || session.expiresAt <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

function persistSession(session: AuthSession | null): void {
  if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(SESSION_KEY);
}

export async function signInWithPassword(email: string, password: string): Promise<AuthSession> {
  const config = getSupabaseConfig();
  if (!config) throw new Error('auth-not-configured');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  let response: Response;
  try {
    response = await fetch(`${config.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: config.anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === 'AbortError') {
      throw new Error('timeout', { cause: reason });
    }
    throw new Error('network', { cause: reason });
  } finally {
    window.clearTimeout(timeout);
  }
  if (response.status >= 400 && response.status < 500) throw new Error('invalid-credentials');
  if (!response.ok) throw new Error('network');
  const body = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: { id: string; email?: string };
  };
  const session: AuthSession = {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: Date.now() + body.expires_in * 1000,
    userId: body.user.id,
    email: body.user.email ?? email,
  };
  persistSession(session);
  return session;
}

export function signOut(): void {
  persistSession(null);
}
