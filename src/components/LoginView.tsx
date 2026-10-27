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
    <main className="workspace-access-state login-experience">
      <div className="login-cloud login-cloud-one" aria-hidden="true" />
      <div className="login-cloud login-cloud-two" aria-hidden="true" />
      <div className="login-cloud login-cloud-three" aria-hidden="true" />
      <section className="login-welcome" aria-label="Bienvenida a Brio">
        <div className="login-brand-mark" aria-hidden="true">
          <UiIcon name="building" />
        </div>
        <p className="login-eyebrow">BRIO · GESTIÓN COMERCIAL</p>
        <h1>Tu día de trabajo, más claro.</h1>
        <p className="login-welcome-copy">
          Organizá oportunidades, presupuestos y próximos pasos desde un solo lugar.
        </p>
        <div className="login-welcome-points" aria-label="Funciones de Brio">
          <span><UiIcon name="check-circle" /> Seguimiento ordenado</span>
          <span><UiIcon name="check-circle" /> Presupuestos a mano</span>
        </div>
      </section>
      <form className="workspace-access-card login-card" onSubmit={handleSubmit}>
        <div className="login-card-heading">
          <div className="login-card-icon"><UiIcon name="building" /></div>
          <div>
            <p className="login-card-overline">BIENVENIDO A BRIO</p>
            <h2>Iniciá sesión</h2>
          </div>
        </div>
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
          {isSubmitting ? 'Ingresando…' : 'Ingresar a Brio'}
        </button>
      </form>
    </main>
  );
}
