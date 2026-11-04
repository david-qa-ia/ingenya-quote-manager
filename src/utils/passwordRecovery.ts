import { getSupabaseConfig, saveAuthSession } from './authService';

/**
 * SCRUM-126: "¿Olvidaste tu contraseña?". Supabase emails a link that opens the app with the
 * recovery tokens in the URL fragment (`#access_token=…&type=recovery`) or, when the link is
 * expired or already used, an error (`#error=…&error_code=otp_expired`). The fragment is read
 * once at startup and removed, so the tokens never stay in the address bar or the history.
 */

export interface PasswordRecovery {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export type RecoveryFromUrl =
  { kind: 'recovery'; recovery: PasswordRecovery } | { kind: 'error'; message: string } | null;

export const MIN_PASSWORD_LENGTH = 8;
export const EXPIRED_LINK_MESSAGE =
  'El enlace para cambiar la contraseña venció o ya se usó. Pedí uno nuevo.';

let startupNotice: string | null = null;

export function parseRecoveryFragment(hash: string): RecoveryFromUrl {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!fragment.includes('=')) return null;
  const params = new URLSearchParams(fragment);
  if (params.get('error') || params.get('error_code')) {
    return params.get('error_code') === 'otp_expired' ||
      params.get('error') === 'access_denied' ||
      params.has('error_description')
      ? { kind: 'error', message: EXPIRED_LINK_MESSAGE }
      : null;
  }
  if (params.get('type') !== 'recovery') return null;
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return { kind: 'error', message: EXPIRED_LINK_MESSAGE };
  const expiresIn = Number(params.get('expires_in'));
  return {
    kind: 'recovery',
    recovery: {
      accessToken,
      refreshToken,
      expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600,
    },
  };
}

/** Reads the recovery fragment, if any, and removes it from the address bar. */
export function consumeRecoveryFromLocation(): PasswordRecovery | null {
  if (typeof window === 'undefined') return null;
  const result = parseRecoveryFragment(window.location.hash);
  if (!result) return null;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  if (result.kind === 'error') {
    startupNotice = result.message;
    return null;
  }
  return result.recovery;
}

/** A message for the login screen (expired link), shown once. */
export function takeLoginNotice(): string | null {
  const notice = startupNotice;
  startupNotice = null;
  return notice;
}

/** Where the emailed link must come back to: this same app. */
export function recoveryRedirectUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) throw new Error('auth-not-configured');
  let response: Response;
  try {
    response = await fetch(
      `${config.url}/auth/v1/recover?redirect_to=${encodeURIComponent(recoveryRedirectUrl())}`,
      {
        method: 'POST',
        headers: { apikey: config.anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      },
    );
  } catch (reason) {
    throw new Error('network', { cause: reason });
  }
  // Every answer except a server failure is shown as "sent", including 4xx and "too many
  // requests": Supabase limits repeated requests only for emails that have a user, so telling
  // them apart would reveal which emails exist.
  if (response.status >= 500) throw new Error('network');
}

/**
 * Same rule as Supabase (Authentication > Email): at least 8 characters with a lowercase letter,
 * an uppercase letter, a digit and a symbol. Checked here so the person sees what is missing.
 */
export const passwordRequirements: readonly { label: string; test: (value: string) => boolean }[] =
  [
    {
      label: `${MIN_PASSWORD_LENGTH} caracteres o más`,
      test: (v) => v.length >= MIN_PASSWORD_LENGTH,
    },
    { label: 'una minúscula', test: (v) => /[a-z]/.test(v) },
    { label: 'una mayúscula', test: (v) => /[A-Z]/.test(v) },
    { label: 'un número', test: (v) => /[0-9]/.test(v) },
    { label: 'un símbolo (por ejemplo ! ? # $ .)', test: (v) => /[^A-Za-z0-9]/.test(v) },
  ];

export function getNewPasswordError(password: string, confirmation: string): string | null {
  const missing = passwordRequirements.filter((rule) => !rule.test(password));
  if (missing.length)
    return `A la contraseña le falta: ${missing.map((rule) => rule.label).join(', ')}.`;
  if (password !== confirmation) return 'Las contraseñas no coinciden.';
  return null;
}

/** Saves the new password and signs the person in with the recovery session. */
export async function updatePasswordWithRecovery(
  recovery: PasswordRecovery,
  password: string,
): Promise<void> {
  const config = getSupabaseConfig();
  if (!config) throw new Error('auth-not-configured');
  let response: Response;
  try {
    response = await fetch(`${config.url}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${recovery.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });
  } catch (reason) {
    throw new Error('network', { cause: reason });
  }
  if (response.status === 401 || response.status === 403) throw new Error('expired');
  if (response.status === 422) {
    const body = (await response.json().catch(() => ({}))) as { error_code?: string };
    throw new Error(body.error_code === 'same_password' ? 'same-password' : 'weak-password');
  }
  if (!response.ok) throw new Error('network');
  const user = (await response.json()) as { id: string; email?: string };
  saveAuthSession({
    accessToken: recovery.accessToken,
    refreshToken: recovery.refreshToken,
    expiresAt: Date.now() + recovery.expiresIn * 1000,
    userId: user.id,
    email: user.email ?? '',
  });
}
