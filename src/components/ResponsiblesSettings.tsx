import { useState, type FormEvent } from 'react';
import {
  activeResponsibles,
  addResponsible,
  removeResponsible,
  setPrimaryResponsible,
  type ResponsibleChange,
} from '../utils/responsibleStorage';
import { persistResponsibles } from '../utils/responsibleSync';
import { useResponsibles } from '../utils/useResponsibles';
import { FieldError } from './FieldError';
import { UiIcon } from './UiIcon';

interface Props {
  workspaceId?: string;
}

/**
 * SCRUM-117: the people who register results. Everyone shares the account, so each result says
 * who did it; this list keeps those names consistent and sets the default (principal).
 */
export function ResponsiblesSettings({ workspaceId }: Props) {
  const list = useResponsibles();
  const active = activeResponsibles(list);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);

  async function apply(change: ResponsibleChange, success: string): Promise<boolean> {
    if (!change.ok) {
      setFeedback({ type: 'error', text: change.error });
      return false;
    }
    setNameError('');
    setSaving(true);
    try {
      const saved = await persistResponsibles(workspaceId, change.list);
      setFeedback(
        saved.ok ? { type: 'success', text: success } : { type: 'error', text: saved.message },
      );
      return saved.ok;
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const change = addResponsible(list, name);
    if (!change.ok) {
      setNameError(change.error);
      return;
    }
    setNameError('');
    if (await apply(change, `${name.trim()} se agregó a la lista.`)) setName('');
  }

  return (
    <section className="settings-card responsibles-settings" aria-labelledby="responsibles-title">
      <div className="responsibles-heading">
        <span className="responsibles-heading-icon" aria-hidden="true">
          <UiIcon name="users" />
        </span>
        <div>
          <h2 id="responsibles-title">Responsables</h2>
          <p>
            Quiénes registran contactos y decisiones. El principal aparece elegido por defecto; si
            lo hizo otra persona, se cambia en el desplegable. Quitar a alguien no borra lo que ya
            registró.
          </p>
        </div>
      </div>

      {active.length ? (
        <ul className="responsibles-list">
          {active.map((item) => (
            <li key={item.id}>
              <span className="responsibles-name">
                <strong>{item.name}</strong>
                {item.isPrimary && <span className="responsibles-badge">Principal</span>}
              </span>
              <span className="responsibles-actions">
                {!item.isPrimary && (
                  <button
                    className="button button-line"
                    type="button"
                    disabled={saving}
                    onClick={() =>
                      void apply(
                        setPrimaryResponsible(list, item.id),
                        `${item.name} es ahora el responsable principal.`,
                      )
                    }
                  >
                    Hacer principal
                  </button>
                )}
                <button
                  className="button button-line responsibles-remove"
                  type="button"
                  disabled={saving || active.length === 1}
                  title={
                    active.length === 1 ? 'Tiene que quedar al menos un responsable.' : undefined
                  }
                  aria-label={`Quitar a ${item.name}`}
                  onClick={() =>
                    void apply(
                      removeResponsible(list, item.id),
                      `${item.name} se quitó de la lista.`,
                    )
                  }
                >
                  Quitar
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="settings-muted">
          Todavía no hay responsables. Agregá a la primera persona; va a quedar como principal.
        </p>
      )}

      <form className="responsibles-add" onSubmit={(event) => void handleAdd(event)} noValidate>
        <label className="field">
          <span>Agregar responsable</span>
          <input
            value={name}
            maxLength={80}
            placeholder="Nombre y apellido"
            onChange={(event) => {
              setName(event.target.value);
              setNameError('');
            }}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? 'responsible-name-error' : undefined}
          />
          <FieldError id="responsible-name-error" message={nameError} />
        </label>
        <button className="button button-primary" type="submit" disabled={saving}>
          <UiIcon name="plus" /> Agregar
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
