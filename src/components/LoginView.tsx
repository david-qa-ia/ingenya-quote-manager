import { useState, type FormEvent } from 'react';
import { UiIcon } from './UiIcon';
import { signInWithPassword } from '../utils/authService';

interface Props {
  onAuthenticated: () => void;
}

export function LoginView({ onAuthenticated }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <main className="workspace-access-state">
      <form className="workspace-access-card login-card" onSubmit={handleSubmit}>
        <UiIcon name="building" />
        <h1>Iniciar sesión</h1>
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
          {isSubmitting ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </main>
  );
}
