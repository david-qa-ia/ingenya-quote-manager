import { useEffect, useRef, useState } from 'react';
import type { SavedQuote } from '../types/quote';
import type { NextAction } from '../types/opportunity';
import { UiIcon } from './UiIcon';

export type QuoteSendChannel = 'whatsapp' | 'email' | 'meeting' | 'other';
export interface QuoteSendInput {
  channel: QuoteSendChannel;
  sentAt: string;
  responsible: string;
  note: string;
  nextStep: 'none' | 'call' | 'whatsapp' | 'email' | 'meeting';
  nextStepAt: string;
  replaceExistingNextAction: boolean;
}
interface Props {
  quote: SavedQuote;
  onClose(): void;
  onSubmit(input: QuoteSendInput): Promise<{ ok: boolean; error?: string }>;
  existingNextAction?: NextAction;
}
const channelLabels: Record<QuoteSendChannel, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  meeting: 'Reunión',
  other: 'Otro',
};
function argentinaLocalDateTime(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((value, part) => ({ ...value, [part.type]: part.value }), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
export function RegisterQuoteSendDrawer({ quote, onClose, onSubmit, existingNextAction }: Props) {
  const [channel, setChannel] = useState<QuoteSendChannel>('whatsapp');
  const [sentAt, setSentAt] = useState(argentinaLocalDateTime);
  const [responsible, setResponsible] = useState('');
  const [note, setNote] = useState('');
  const [nextStep, setNextStep] = useState<QuoteSendInput['nextStep']>('none');
  const [nextStepAt, setNextStepAt] = useState('');
  const [replaceExistingNextAction, setReplaceExistingNextAction] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const lockRef = useRef(false);
  useEffect(() => {
    const prevent = (event: KeyboardEvent) => {
      if (saving && event.key === 'Escape') event.preventDefault();
    };
    window.addEventListener('keydown', prevent);
    return () => window.removeEventListener('keydown', prevent);
  }, [saving]);
  async function submit() {
    if (saving || lockRef.current) return;
    if (!responsible.trim()) return setError('Indicá quién registró el envío.');
    if (!sentAt || Number.isNaN(Date.parse(sentAt)) || Date.parse(sentAt) > Date.now())
      return setError('La fecha y hora de envío debe ser válida y no futura.');
    if (nextStep !== 'none' && (!nextStepAt || Date.parse(nextStepAt) <= Date.now()))
      return setError('El próximo paso debe tener una fecha futura.');
    lockRef.current = true;
    setSaving(true);
    setError('');
    try {
      const result = await onSubmit({
        channel,
        sentAt: new Date(`${sentAt}:00-03:00`).toISOString(),
        responsible: responsible.trim(),
        note: note.trim(),
        nextStep,
        nextStepAt: nextStepAt ? new Date(`${nextStepAt}:00-03:00`).toISOString() : '',
        replaceExistingNextAction,
      });
      if (result.ok) onClose();
      else setError(result.error ?? 'No se pudo confirmar el envío.');
    } finally {
      lockRef.current = false;
      setSaving(false);
    }
  }
  return (
    <div className="quote-send-layer" role="presentation">
      <button
        className="quote-send-backdrop"
        aria-label="Cerrar"
        type="button"
        disabled={saving}
        onClick={onClose}
      />
      <aside
        className="quote-send-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quote-send-title"
      >
        <header>
          <div>
            <h2 id="quote-send-title">Registrar envío</h2>
            <p>
              Presupuesto {quote.id} · Versión {quote.version ?? 1}
            </p>
          </div>
          <button aria-label="Cerrar" type="button" disabled={saving} onClick={onClose}>
            ×
          </button>
        </header>
        <p className="quote-send-notice">
          <UiIcon name="help" /> Registrar el envío no lo manda: confirma que ya lo compartiste.
        </p>
        <fieldset disabled={saving}>
          <legend>Canal real</legend>
          <div className="quote-send-channels">
            {(Object.keys(channelLabels) as QuoteSendChannel[]).map((item) => (
              <button
                key={item}
                type="button"
                className={channel === item ? 'selected' : ''}
                onClick={() => setChannel(item)}
              >
                {item === 'whatsapp' ? (
                  <UiIcon name="whatsapp" />
                ) : item === 'email' ? (
                  <UiIcon name="email" />
                ) : item === 'meeting' ? (
                  <UiIcon name="calendar" />
                ) : (
                  <UiIcon name="more" />
                )}
                {channelLabels[item]}
              </button>
            ))}
          </div>
        </fieldset>
        {existingNextAction && nextStep !== 'none' && (
          <fieldset disabled={saving}>
            <legend>Tarea pendiente actual</legend>
            <p className="commercial-note">
              {existingNextAction.description} · {existingNextAction.type} ·{' '}
              {new Date(existingNextAction.dueAt).toLocaleString('es-AR')}
            </p>
            <label>
              <input
                type="radio"
                checked={!replaceExistingNextAction}
                onChange={() => setReplaceExistingNextAction(false)}
              />{' '}
              Conservar tarea actual
            </label>
            <label>
              <input
                type="radio"
                checked={replaceExistingNextAction}
                onChange={() => setReplaceExistingNextAction(true)}
              />{' '}
              Reemplazar por el nuevo seguimiento
            </label>
          </fieldset>
        )}
        <label className="field">
          <span>Fecha y hora de envío</span>
          <input
            type="datetime-local"
            value={sentAt}
            disabled={saving}
            onChange={(event) => setSentAt(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Responsable</span>
          <input
            value={responsible}
            disabled={saving}
            onChange={(event) => setResponsible(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Nota</span>
          <textarea
            maxLength={500}
            value={note}
            disabled={saving}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Presupuesto enviado; esperamos confirmación."
          />
        </label>
        <fieldset disabled={saving}>
          <legend>
            Próximo paso <small>(opcional)</small>
          </legend>
          <div className="quote-send-next">
            <select
              value={nextStep}
              onChange={(event) => setNextStep(event.target.value as QuoteSendInput['nextStep'])}
            >
              <option value="none">Sin próximo paso</option>
              <option value="call">Llamar</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
              <option value="meeting">Reunión</option>
            </select>
            {nextStep !== 'none' && (
              <input
                type="datetime-local"
                value={nextStepAt}
                onChange={(event) => setNextStepAt(event.target.value)}
              />
            )}
          </div>
        </fieldset>
        {error && (
          <p className="commercial-warning" role="alert">
            {error}
          </p>
        )}
        <footer>
          <button className="button button-line" type="button" disabled={saving} onClick={onClose}>
            Cancelar
          </button>
          <button
            className="button button-primary"
            type="button"
            disabled={saving}
            onClick={() => void submit()}
          >
            {saving ? 'Guardando…' : 'Confirmar envío'}
          </button>
        </footer>
      </aside>
    </div>
  );
}
