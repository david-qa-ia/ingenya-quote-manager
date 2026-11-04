import { useState, type FormEvent } from 'react';
import { UiIcon } from './UiIcon';
import { signInWithPassword } from '../utils/authService';
import { requestPasswordReset, takeLoginNotice } from '../utils/passwordRecovery';

interface Props {
  onAuthenticated: () => void;
}

let lastNotice: string | null = null;
function takeLoginNoticeOnce(): boolean {
  lastNotice = takeLoginNotice() ?? lastNotice;
  return lastNotice !== null;
}

export function LoginView({ onAuthenticated }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // SCRUM-126: "¿Olvidaste tu contraseña?" and the notice of an expired recovery link.
  const [mode, setMode] = useState<'signIn' | 'forgot' | 'sent'>(() =>
    takeLoginNoticeOnce() ? 'forgot' : 'signIn',
  );
  const [notice] = useState(() => lastNotice);

  async function handleForgot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Ingresá tu email, por ejemplo nombre@empresa.com.');
      return;
    }
    setIsSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setMode('sent');
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message === 'rate-limited'
          ? 'Ya pediste varios enlaces. Esperá unos minutos y volvé a intentar.'
          : 'No pudimos enviar el enlace. Revisá la conexión e intentá nuevamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await signInWithPassword(email.trim(), password);
      onAuthenticated();
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message === 'invalid-credentials'
          ? 'El email o la contraseña no son correctos.'
          : reason instanceof Error && reason.message === 'timeout'
            ? 'El servidor tardó demasiado. Revisá la conexión e intentá nuevamente.'
            : 'No pudimos iniciar sesión. Revisá la conexión e intentá nuevamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="workspace-access-state login-experience">
      <div className="login-cloud login-cloud-one" aria-hidden="true" />
      <div className="login-cloud login-cloud-two" aria-hidden="true" />
      <div className="login-cloud login-cloud-three" aria-hidden="true" />
      <section className="login-welcome" aria-label="Bienvenida a Ventro">
        <div className="login-brand-mark" aria-hidden="true">
          <UiIcon name="ventro" />
        </div>
        <p className="login-eyebrow">VENTRO · GESTIÓN COMERCIAL</p>
        <h1>Tu día de trabajo, más claro.</h1>
        <p className="login-welcome-copy">
          Organizá oportunidades, presupuestos y próximos pasos desde un solo lugar.
        </p>
        <div className="login-welcome-points" aria-label="Funciones de Ventro">
          <span>
            <UiIcon name="check-circle" /> Seguimiento ordenado
          </span>
          <span>
            <UiIcon name="check-circle" /> Presupuestos a mano
          </span>
        </div>
      </section>
      <form
        className="workspace-access-card login-card"
        onSubmit={mode === 'signIn' ? handleSubmit : handleForgot}
        noValidate={mode !== 'signIn'}
      >
        <div className="login-card-heading">
          <div className="login-card-icon">
            <UiIcon name="ventro" />
          </div>
          <div>
            <p className="login-card-overline">BIENVENIDO A VENTRO</p>
            <h2>{mode === 'signIn' ? 'Iniciá sesión' : 'Recuperar contraseña'}</h2>
          </div>
        </div>
        {mode === 'signIn' && (
          <>
            <p className="login-card-description">Ingresá tus datos para continuar.</p>
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <label htmlFor="login-password">Contraseña</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            {error ? (
              <p className="workspace-access-error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="button button-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Ingresando…' : 'Ingresar a Ventro'}
            </button>
            <button
              className="button button-link login-secondary-link"
              type="button"
              onClick={() => {
                setError('');
                setMode('forgot');
              }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </>
        )}
        {mode === 'forgot' && (
          <>
            {notice ? (
              <p className="workspace-access-error" role="status">
                {notice}
              </p>
            ) : null}
            <p className="login-card-description">
              Escribí tu email y te mandamos un enlace para elegir una contraseña nueva.
            </p>
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {error ? (
              <p className="workspace-access-error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="button button-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Enviando…' : 'Enviar enlace'}
            </button>
            <button
              className="button button-link login-secondary-link"
              type="button"
              onClick={() => {
                setError('');
                setMode('signIn');
              }}
            >
              Volver a iniciar sesión
            </button>
          </>
        )}
        {mode === 'sent' && (
          <>
            <p className="login-card-description" role="status">
              Si {email.trim()} tiene un usuario, en unos minutos le llega un enlace para elegir una
              contraseña nueva. Revisá también la carpeta de spam.
            </p>
            <button
              className="button button-line"
              type="button"
              onClick={() => {
                setPassword('');
                setMode('signIn');
              }}
            >
              Volver a iniciar sesión
            </button>
          </>
        )}
      </form>
    </main>
  );
}
