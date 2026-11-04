import { useState, type FormEvent } from 'react';
import { UiIcon } from './UiIcon';
import { FieldError } from './FieldError';
import {
  EXPIRED_LINK_MESSAGE,
  getNewPasswordError,
  MIN_PASSWORD_LENGTH,
  updatePasswordWithRecovery,
  type PasswordRecovery,
} from '../utils/passwordRecovery';

interface Props {
  recovery: PasswordRecovery;
  onDone: () => void;
}

/** SCRUM-126: opened from the emailed link; the person chooses a new password and gets in. */
export function PasswordResetView({ recovery, onDone }: Props) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = getNewPasswordError(password, confirmation);
    setFieldError(invalid ?? '');
    setError('');
    if (invalid) return;
    setIsSubmitting(true);
    try {
      await updatePasswordWithRecovery(recovery, password);
      onDone();
    } catch (reason) {
      const code = reason instanceof Error ? reason.message : '';
      setError(
        code === 'expired'
          ? EXPIRED_LINK_MESSAGE
          : code === 'same-password'
            ? 'Elegí una contraseña distinta a la anterior.'
            : code === 'weak-password'
              ? 'Esa contraseña es muy fácil de adivinar. Probá con una más larga.'
              : 'No pudimos guardar la contraseña. Revisá la conexión e intentá nuevamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="workspace-access-state login-experience password-reset-experience">
      <form className="workspace-access-card login-card" onSubmit={handleSubmit} noValidate>
        <div className="login-card-heading">
          <div className="login-card-icon">
            <UiIcon name="ventro" />
          </div>
          <div>
            <p className="login-card-overline">VENTRO · GESTIÓN COMERCIAL</p>
            <h2>Elegí una contraseña nueva</h2>
          </div>
        </div>
        <p className="login-card-description">
          Usá al menos {MIN_PASSWORD_LENGTH} caracteres. Al guardarla vas a entrar directamente.
        </p>
        <label htmlFor="reset-password">Contraseña nueva</label>
        <input
          id="reset-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? 'reset-password-error' : undefined}
        />
        <label htmlFor="reset-password-confirmation">Repetí la contraseña</label>
        <input
          id="reset-password-confirmation"
          type="password"
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={fieldError ? 'reset-password-error' : undefined}
        />
        <FieldError id="reset-password-error" message={fieldError} />
        {error ? (
          <p className="workspace-access-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="button button-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : 'Guardar y entrar'}
        </button>
        {error === EXPIRED_LINK_MESSAGE && (
          <button
            className="button button-link login-secondary-link"
            type="button"
            onClick={onDone}
          >
            Volver al inicio de sesión
          </button>
        )}
      </form>
    </main>
  );
}
