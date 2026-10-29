import { useEffect, useRef, useState } from 'react';
import type { SavedQuote } from '../types/quote';
import type { NextAction } from '../types/opportunity';
import { getQuoteSendFieldErrors, quoteSendFieldOrder } from '../utils/quoteSendValidation';
import { FieldError } from './FieldError';
import { UiIcon } from './UiIcon';
import { useFieldValidation } from './useFieldValidation';

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
  canSendWhatsApp: boolean;
  canSendEmail: boolean;
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
export function RegisterQuoteSendDrawer({
  quote,
  onClose,
  onSubmit,
  existingNextAction,
  canSendWhatsApp,
  canSendEmail,
}: Props) {
  const [channel, setChannel] = useState<QuoteSendChannel>(
    canSendWhatsApp ? 'whatsapp' : canSendEmail ? 'email' : 'meeting',
  );
  const [sentAt, setSentAt] = useState(argentinaLocalDateTime);
  const [responsible, setResponsible] = useState('');
  const [note, setNote] = useState('');
  const [nextStep, setNextStep] = useState<QuoteSendInput['nextStep']>('none');
  const [nextStepAt, setNextStepAt] = useState('');
  const [replaceExistingNextAction, setReplaceExistingNextAction] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const lockRef = useRef(false);
  const validation = useFieldValidation(
    `quote-send-${quote.id}`,
    getQuoteSendFieldErrors({ channel, sentAt, responsible, note, nextStep, nextStepAt }),
    quoteSendFieldOrder,
  );
  useEffect(() => {
    const prevent = (event: KeyboardEvent) => {
      if (saving && event.key === 'Escape') event.preventDefault();
    };
    window.addEventListener('keydown', prevent);
    return () => window.removeEventListener('keydown', prevent);
  }, [saving]);
  async function submit() {
    if (saving || lockRef.current) return;
    if (!validation.validateForSubmit()) return setError('');
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
            {(Object.keys(channelLabels) as QuoteSendChannel[]).map((item) => {
              const unavailable =
                (item === 'whatsapp' && !canSendWhatsApp) || (item === 'email' && !canSendEmail);
              return (
                <button
                  key={item}
                  type="button"
                  className={channel === item ? 'selected' : ''}
                  disabled={unavailable}
                  title={
                    item === 'whatsapp' && unavailable
                      ? 'El contacto no tiene un teléfono válido.'
                      : item === 'email' && unavailable
                        ? 'El contacto no tiene un email válido.'
                        : undefined
                  }
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
              );
            })}
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
            {...validation.fieldProps('sentAt')}
          />
          <FieldError
            id={validation.errorId('sentAt')}
            message={validation.visibleError('sentAt')}
          />
        </label>
        <label className="field">
          <span>Responsable</span>
          <input
            value={responsible}
            disabled={saving}
            onChange={(event) => setResponsible(event.target.value)}
            {...validation.fieldProps('responsible')}
          />
          <FieldError
            id={validation.errorId('responsible')}
            message={validation.visibleError('responsible')}
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
            {...validation.fieldProps('note')}
          />
          <FieldError id={validation.errorId('note')} message={validation.visibleError('note')} />
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
                aria-label="Fecha y hora del próximo paso"
                value={nextStepAt}
                onChange={(event) => setNextStepAt(event.target.value)}
                {...validation.fieldProps('nextStepAt')}
              />
            )}
          </div>
          {nextStep !== 'none' && (
            <FieldError
              id={validation.errorId('nextStepAt')}
              message={validation.visibleError('nextStepAt')}
            />
          )}
        </fieldset>
        {error && (
          <p className="form-error" role="alert">
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
