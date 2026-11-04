import { useEffect, useState, type FormEvent } from 'react';
import {
  addWorkspaceMember,
  listWorkspaceMembers,
  removeWorkspaceMember,
  type WorkspaceMember,
} from '../utils/supabaseRepository';
import { FieldError } from './FieldError';
import { UiIcon } from './UiIcon';

interface Props {
  workspaceId: string;
  workspaceName: string;
}

const roleLabels: Record<WorkspaceMember['role'], string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  collaborator: 'Colaborador',
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * SCRUM-125: who can open this workspace. Only the owner sees this section. Adding someone
 * gives them access to this workspace only; their own workspaces and this one stay separate.
 */
export function WorkspaceMembersSettings({ workspaceId, workspaceName }: Props) {
  const [members, setMembers] = useState<WorkspaceMember[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<WorkspaceMember | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  const [reloadToken, setReloadToken] = useState(0);
  const reload = () => setReloadToken((value) => value + 1);

  useEffect(() => {
    let cancelled = false;
    listWorkspaceMembers(workspaceId)
      .then((rows) => {
        if (cancelled) return;
        setMembers(rows);
        setLoadError('');
      })
      .catch(() => {
        if (!cancelled) setLoadError('No se pudo cargar la lista de miembros. Revisá la conexión.');
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, reloadToken]);

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();
    if (!emailPattern.test(value)) {
      setEmailError('Ingresá un email válido, por ejemplo nombre@empresa.com.');
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const result = await addWorkspaceMember(workspaceId, value);
      if (result.ok) {
        setEmail('');
        setFeedback({
          type: 'success',
          text: `${value} ya puede entrar a ${workspaceName}. Lo va a ver en su selector de espacios al volver a entrar.`,
        });
        reload();
      } else setFeedback({ type: 'error', text: result.message });
    } catch {
      setFeedback({ type: 'error', text: 'No se pudo agregar. Revisá la conexión.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(member: WorkspaceMember) {
    setSaving(true);
    setFeedback(null);
    try {
      const result = await removeWorkspaceMember(workspaceId, member.userId);
      setFeedback(
        result.ok
          ? { type: 'success', text: `${member.email} ya no tiene acceso a ${workspaceName}.` }
          : { type: 'error', text: result.message },
      );
      reload();
    } catch {
      setFeedback({ type: 'error', text: 'No se pudo quitar. Revisá la conexión.' });
    } finally {
      setSaving(false);
      setConfirmRemove(null);
    }
  }

  return (
    <section className="settings-card responsibles-settings" aria-labelledby="members-title">
      <div className="responsibles-heading">
        <span className="responsibles-heading-icon" aria-hidden="true">
          <UiIcon name="building" />
        </span>
        <div>
          <h2 id="members-title">Miembros del espacio</h2>
          <p>
            Quiénes pueden entrar a {workspaceName} con su propio usuario. Ven y trabajan solo los
            datos de este espacio; sus otros espacios no se mezclan con este.
          </p>
        </div>
      </div>

      {loadError && (
        <p className="form-error" role="alert">
          {loadError}
        </p>
      )}
      {members === null && !loadError && <p className="settings-muted">Cargando miembros…</p>}
      {members && (
        <ul className="responsibles-list">
          {members.map((member) => (
            <li key={member.userId}>
              <span className="responsibles-name">
                <strong>{member.email}</strong>
                <span className="responsibles-badge">{roleLabels[member.role]}</span>
                {member.isYou && <span className="settings-muted">Vos</span>}
              </span>
              {member.role !== 'owner' && (
                <span className="responsibles-actions">
                  {confirmRemove?.userId === member.userId ? (
                    <>
                      <button
                        className="button button-primary"
                        type="button"
                        disabled={saving}
                        onClick={() => void handleRemove(member)}
                      >
                        Sí, quitar acceso
                      </button>
                      <button
                        className="button button-line"
                        type="button"
                        disabled={saving}
                        onClick={() => setConfirmRemove(null)}
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <button
                      className="button button-line responsibles-remove"
                      type="button"
                      disabled={saving}
                      aria-label={`Quitar el acceso de ${member.email}`}
                      onClick={() => setConfirmRemove(member)}
                    >
                      Quitar acceso
                    </button>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <form className="responsibles-add" onSubmit={(event) => void handleAdd(event)} noValidate>
        <label className="field">
          <span>Agregar por email</span>
          <input
            value={email}
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="nombre@empresa.com"
            onChange={(event) => {
              setEmail(event.target.value);
              setEmailError('');
            }}
            aria-invalid={emailError ? true : undefined}
            aria-describedby={emailError ? 'member-email-error' : 'member-email-hint'}
          />
          {!emailError && (
            <small id="member-email-hint">
              La persona tiene que tener usuario. Si no tiene, pedíselo a Ventro.
            </small>
          )}
          <FieldError id="member-email-error" message={emailError} />
        </label>
        <button className="button button-primary" type="submit" disabled={saving}>
          <UiIcon name="plus" /> Dar acceso
        </button>
      </form>

      {feedback && (
        <p
          className={feedback.type === 'error' ? 'form-error' : 'settings-feedback'}
          role={feedback.type === 'error' ? 'alert' : 'status'}
        >
          {feedback.text}
        </p>
      )}
    </section>
  );
}
