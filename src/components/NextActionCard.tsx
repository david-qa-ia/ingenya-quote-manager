import { useState, type FormEvent } from 'react';
import type { NextAction, Opportunity } from '../types/opportunity';
import {
  getActionBucket,
  businessTimeZone,
  transitionNextAction,
} from '../utils/opportunityNextAction';

const labels = {
  call: 'Llamada',
  whatsapp: 'WhatsApp',
  email: 'Email',
  meeting: 'Reunión',
  waitForResponse: 'Esperar respuesta',
  other: 'Otra',
} as const;
const priorities = { high: 'Alta', medium: 'Media', low: 'Baja' } as const;

interface Props {
  opportunity: Opportunity;
  onSave: (opportunity: Opportunity, event: string) => boolean;
}

function localValue(iso: string) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: businessTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
function inputToIso(value: string) {
  return value ? new Date(`${value}:00-03:00`).toISOString() : '';
}

export function NextActionCard({ opportunity, onSave }: Props) {
  const action = opportunity.nextAction;
  const [mode, setMode] = useState<'complete' | 'reschedule' | 'cancel' | 'notRelevant' | null>(
    null,
  );
  const [actor, setActor] = useState('');
  const [reason, setReason] = useState('');
  const [result, setResult] = useState('');
  const [dueAt, setDueAt] = useState(action ? localValue(action.dueAt) : '');
  const [error, setError] = useState('');
  if (!action) return <CreateAction opportunity={opportunity} onSave={onSave} />;
  const bucket = getActionBucket(action);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!mode) return;
    try {
      const transition =
        mode === 'complete'
          ? 'completed'
          : mode === 'reschedule'
            ? 'rescheduled'
            : mode === 'cancel'
              ? 'cancelled'
              : 'notRelevant';
      const next = transitionNextAction(
        opportunity,
        transition,
        actor,
        reason,
        new Date().toISOString(),
        { dueAt: inputToIso(dueAt), result },
      );
      if (!onSave(next, mode)) {
        setError('No se pudo guardar la acción.');
        return;
      }
      setMode(null);
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo actualizar la acción.');
    }
  }
  return (
    <section className="summary-panel next-action-card" aria-label="Próxima acción">
      <div className="summary-panel-heading">
        <p className="eyebrow">Seguimiento</p>
        <h2>Próxima acción</h2>
      </div>
      <p>
        <strong>{labels[action.type]}</strong> ·{' '}
        {new Intl.DateTimeFormat('es-AR', {
          dateStyle: 'short',
          timeStyle: 'short',
          timeZone: businessTimeZone,
        }).format(new Date(action.dueAt))}
      </p>
      <p className={bucket === 'overdue' ? 'commercial-warning' : 'commercial-note'}>
        {bucket === 'overdue'
          ? 'Vencida'
          : `${priorities[action.priority]} · ${action.responsible}`}{' '}
        · {action.description}
      </p>
      <div className="commercial-actions">
        <button className="button button-line" type="button" onClick={() => setMode('complete')}>
          Completar
        </button>
        <button className="button button-line" type="button" onClick={() => setMode('reschedule')}>
          Reprogramar
        </button>
        <button className="button button-line" type="button" onClick={() => setMode('cancel')}>
          Cancelar
        </button>
        <button className="button button-link" type="button" onClick={() => setMode('notRelevant')}>
          No relevante
        </button>
      </div>
      {mode && (
        <div className="modal-backdrop">
          <form className="confirmation-modal commercial-form" onSubmit={submit}>
            <h2>
              {mode === 'complete'
                ? 'Completar acción'
                : mode === 'reschedule'
                  ? 'Reprogramar acción'
                  : mode === 'cancel'
                    ? 'Cancelar acción'
                    : 'Declarar no relevante'}
            </h2>
            <label className="field">
              <span>Registrado por</span>
              <input value={actor} onChange={(event) => setActor(event.target.value)} />
            </label>
            {mode === 'complete' ? (
              <label className="field">
                <span>Resultado</span>
                <textarea value={result} onChange={(event) => setResult(event.target.value)} />
              </label>
            ) : (
              <label className="field">
                <span>Motivo</span>
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
              </label>
            )}
            {mode === 'reschedule' && (
              <label className="field">
                <span>Nueva fecha y hora</span>
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                />
              </label>
            )}
            {error && (
              <p className="commercial-warning" role="alert">
                {error}
              </p>
            )}
            <div className="confirmation-actions">
              <button className="button button-line" type="button" onClick={() => setMode(null)}>
                Volver
              </button>
              <button className="button button-primary" type="submit">
                Confirmar
              </button>
            </div>
          </form>
        </div>
      )}
      {action.history.filter((item) => item.event === 'rescheduled').length > 0 && (
        <details>
          <summary>Historial de reprogramaciones</summary>
          <ul>
            {action.history
              .filter((item) => item.event === 'rescheduled')
              .map((item) => (
                <li key={item.id}>
                  {new Intl.DateTimeFormat('es-AR', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                    timeZone: businessTimeZone,
                  }).format(new Date(item.previousDueAt!))}{' '}
                  · {item.reason}
                </li>
              ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function CreateAction({ opportunity, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [responsible, setResponsible] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [type, setType] = useState<NextAction['type']>('call');
  const [priority, setPriority] = useState<NextAction['priority']>('medium');
  const [error, setError] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    const now = new Date().toISOString();
    const instant = inputToIso(dueAt);
    if (!description.trim() || !responsible.trim() || !instant) {
      setError('Completá tipo, fecha y hora, responsable y motivo.');
      return;
    }
    const id = crypto.randomUUID();
    const next = {
      ...opportunity,
      noNextActionException: undefined,
      nextAction: {
        id,
        type,
        description: description.trim(),
        dueAt: instant,
        responsible: responsible.trim(),
        priority,
        status: 'pending' as const,
        createdAt: now,
        updatedAt: now,
        history: [
          {
            id: `${id}:created`,
            occurredAt: now,
            actor: responsible.trim(),
            event: 'created' as const,
            reason: description.trim(),
          },
        ],
      },
      updatedAt: now,
    };
    if (!onSave(next, 'created')) {
      setError('No se pudo guardar la acción.');
      return;
    }
    setOpen(false);
  }
  return (
    <section className="summary-panel next-action-card">
      <h2>Próxima acción</h2>
      <p className={opportunity.noNextActionException ? 'commercial-note' : 'commercial-warning'}>
        {opportunity.noNextActionException
          ? `Excepción justificada: ${opportunity.noNextActionException.reason}`
          : 'Esta oportunidad activa no tiene próxima acción.'}
      </p>
      <button className="button button-line" type="button" onClick={() => setOpen(true)}>
        Programar acción
      </button>
      {open && (
        <div className="modal-backdrop">
          <form className="confirmation-modal commercial-form" onSubmit={submit}>
            <h2>Programar próxima acción</h2>
            <label className="field">
              <span>Tipo</span>
              <select
                value={type}
                onChange={(event) => setType(event.target.value as NextAction['type'])}
              >
                {Object.entries(labels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Motivo o detalle</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Fecha y hora</span>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Responsable</span>
              <input value={responsible} onChange={(event) => setResponsible(event.target.value)} />
            </label>
            <label className="field">
              <span>Prioridad</span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as NextAction['priority'])}
              >
                {Object.entries(priorities).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {error && <p className="commercial-warning">{error}</p>}
            <div className="confirmation-actions">
              <button className="button button-line" type="button" onClick={() => setOpen(false)}>
                Cancelar
              </button>
              <button className="button button-primary" type="submit">
                Programar
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
