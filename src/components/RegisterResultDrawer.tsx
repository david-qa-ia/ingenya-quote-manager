import { useEffect, useRef, useState } from 'react';
import type { FollowUpInboxItem } from '../types/followUpInbox';
import type { FollowUpResultSaveResult } from '../utils/followUpResultTransaction';

export type ResultChannel = 'call' | 'whatsapp' | 'email' | 'meeting';
export type ResultNextStep = 'none' | 'call' | 'sendQuote' | 'email' | 'whatsapp' | 'meeting';

export interface RegisterResultInput {
  actor: string;
  reason: string;
  result: string;
  dueAt: string;
  channel: ResultChannel;
  nextStep: ResultNextStep;
  quoteMode?: 'new' | 'existing';
}

export type RegisterResultSubmitResult = FollowUpResultSaveResult;

interface Props {
  item: FollowUpInboxItem;
  onClose: () => void;
  onSubmit: (
    input: RegisterResultInput,
  ) => RegisterResultSubmitResult | Promise<RegisterResultSubmitResult>;
  onQuoteIntent?: (item: FollowUpInboxItem, mode: 'new' | 'existing') => void;
}

const resultOptions = [
  ['effectiveContact', 'Contactado', 'contacted'],
  ['noAnswer', 'No respondió', 'noAnswer'],
  ['notInterested', 'No interesado', 'notInterested'],
  ['invalidNumber', 'Dato inválido', 'invalidNumber'],
] as const;

function OptionIcon({ icon }: { icon: string }) {
  const common = {
    className: 'result-option-icon',
    viewBox: '0 0 24 24',
    'aria-hidden': true,
  } as const;
  if (icon === 'contacted')
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <path d="M8 12.5 10.5 15 16 9.5" />
      </svg>
    );
  if (icon === 'noAnswer')
    return (
      <svg {...common}>
        <path d="m5 5 14 14M19 5 5 19" />
        <path d="M8 4h8M4 8v8M16 20H8M20 16V8" />
      </svg>
    );
  if (icon === 'notInterested')
    return (
      <svg {...common}>
        <path d="M6 8h12v10H6zM9 8V5h6v3M4 11h16" />
        <path d="m9 14 6 0" />
      </svg>
    );
  if (icon === 'invalidNumber')
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 8 8 8M16 8l-8 8" />
      </svg>
    );
  if (icon === 'call')
    return (
      <svg {...common}>
        <path d="M7 4 4.5 6.5c-.5.5-.5 1.3-.1 1.9 2.1 3.5 5.2 6.6 8.7 8.7.6.4 1.4.4 1.9-.1l2.5-2.5-3-3-1.7 1.7a15 15 0 0 1-5.2-5.2l1.7-1.7-3-3Z" />
      </svg>
    );
  if (icon === 'whatsapp')
    return (
      <svg {...common}>
        <path d="M20 11.5a8 8 0 0 1-11.7 7L4 20l1.5-4.2A8 8 0 1 1 20 11.5Z" />
        <path d="M9 8.5c.3 2 1.5 3.2 3.5 4.2l1-.9c.3-.3.7-.3 1-.1l1.1.7" />
      </svg>
    );
  if (icon === 'email')
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    );
  if (icon === 'meeting')
    return (
      <svg {...common}>
        <circle cx="9" cy="9" r="3" />
        <circle cx="17" cy="10" r="2" />
        <path d="M3.5 19c.4-3 2.2-4.5 5.5-4.5s5.1 1.5 5.5 4.5M14 15c3.5-.5 5.7.9 6.5 4" />
      </svg>
    );
  if (icon === 'sendQuote')
    return (
      <svg {...common}>
        <path d="M6 3h9l3 3v15H6z" />
        <path d="M15 3v4h4M9 12h6M9 16h6" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="m7 7 10 10" />
    </svg>
  );
}

function OptionCard({
  selected,
  label,
  icon,
  onClick,
}: {
  selected: boolean;
  label: string;
  icon: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`result-option-card ${selected ? 'result-option-card-selected' : ''}`}
      type="button"
      aria-pressed={selected}
      onClick={onClick}
    >
      <OptionIcon icon={icon} />
      <span>{label}</span>
      {selected && (
        <span className="result-option-check" aria-hidden="true">
          ✓
        </span>
      )}
    </button>
  );
}

export function RegisterResultDrawer({ item, onClose, onSubmit, onQuoteIntent }: Props) {
  const [result, setResult] = useState('');
  const [channel, setChannel] = useState<ResultChannel>(
    item.channel === 'whatsapp' || item.channel === 'email' ? item.channel : 'call',
  );
  const [nextStep, setNextStep] = useState<ResultNextStep>('none');
  const [dueAt, setDueAt] = useState('');
  const [actor, setActor] = useState(item.responsible === 'Sin asignar' ? '' : item.responsible);
  const [note, setNote] = useState('');
  const [quoteMode, setQuoteMode] = useState<'new' | 'existing'>('new');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const initials = item.clientName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  useEffect(() => closeRef.current?.focus(), []);

  useEffect(() => {
    function preventEscape(event: KeyboardEvent) {
      if (isSaving && event.key === 'Escape') event.preventDefault();
    }
    document.addEventListener('keydown', preventEscape);
    return () => document.removeEventListener('keydown', preventEscape);
  }, [isSaving]);

  async function submit() {
    if (isSaving || recoveryRequired) return;
    if (
      !result ||
      !actor.trim() ||
      (nextStep !== 'none' && !dueAt) ||
      (!item.action && nextStep === 'none')
    ) {
      setError(
        item.action
          ? 'Completá resultado, responsable y la fecha del próximo paso.'
          : 'Esta oportunidad no tiene una acción pendiente. Elegí el próximo paso y su fecha.',
      );
      return;
    }
    const input: RegisterResultInput = {
      actor: actor.trim(),
      reason: note.trim() || result,
      result,
      dueAt: dueAt ? new Date(`${dueAt}:00-03:00`).toISOString() : '',
      channel,
      nextStep,
      ...(nextStep === 'sendQuote' ? { quoteMode } : {}),
    };
    setIsSaving(true);
    try {
      const saved = await onSubmit(input);
      if (!saved.ok) {
        setRecoveryRequired(saved.recoveryRequired === true);
        setError(
          saved.message ??
            'No se pudo guardar el resultado. Revisá los datos e intentá nuevamente.',
        );
        return;
      }
    } catch {
      setError('No se pudo guardar el resultado. Revisá los datos e intentá nuevamente.');
      return;
    } finally {
      setIsSaving(false);
    }
    if (nextStep === 'sendQuote') onQuoteIntent?.(item, quoteMode);
    onClose();
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.currentTarget === event.target && !isSaving && onClose()}
    >
      <aside
        className="result-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-drawer-title"
      >
        <div className="result-drawer-header">
          <span className="result-drawer-avatar" aria-hidden="true">
            {initials}
          </span>
          <div>
            <p className="eyebrow">Registrar resultado</p>
            <h2 id="result-drawer-title">{item.clientName}</h2>
            <p>{item.opportunityName ?? item.quoteName ?? 'Sin contexto disponible'}</p>
          </div>
          <button
            ref={closeRef}
            className="button button-link"
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            disabled={isSaving}
          >
            ×
          </button>
        </div>
        <div className="result-drawer-body">
          <div className="result-drawer-context">
            <span>{item.clientCompany ?? 'Empresa pendiente'}</span>
            <span>{item.action?.description ?? 'Sin próxima tarea'}</span>
          </div>
          <fieldset className="result-option-group">
            <legend>Resultado del contacto</legend>
            <div className="result-option-grid result-option-grid-four">
              {resultOptions.map(([value, label, icon]) => (
                <OptionCard
                  key={value}
                  selected={result === value}
                  label={label}
                  icon={icon}
                  onClick={() => setResult(value)}
                />
              ))}
            </div>
          </fieldset>
          <fieldset className="result-option-group">
            <legend>Canal realizado</legend>
            <div className="result-option-grid result-option-grid-four">
              {(
                [
                  ['call', 'Llamada'],
                  ['whatsapp', 'WhatsApp'],
                  ['email', 'Email'],
                  ['meeting', 'Reunión'],
                ] as const
              ).map(([value, label]) => (
                <OptionCard
                  key={value}
                  selected={channel === value}
                  label={label}
                  icon={value}
                  onClick={() => setChannel(value)}
                />
              ))}
            </div>
          </fieldset>
          <fieldset className="result-option-group">
            <legend>Próximo paso</legend>
            <div className="result-option-grid result-option-grid-six">
              {(
                [
                  ['call', 'Llamar'],
                  ['sendQuote', 'Enviar presupuesto'],
                  ['email', 'Enviar email'],
                  ['whatsapp', 'Enviar WhatsApp'],
                  ['meeting', 'Reunión'],
                  ['none', 'Sin próximo paso'],
                ] as const
              ).map(([value, label]) => (
                <OptionCard
                  key={value}
                  selected={nextStep === value}
                  label={label}
                  icon={value}
                  onClick={() => setNextStep(value)}
                />
              ))}
            </div>
          </fieldset>
          {nextStep !== 'none' && (
            <label className="field">
              <span>Fecha y hora</span>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </label>
          )}
          {nextStep === 'sendQuote' && (
            <fieldset className="result-drawer-choice">
              <legend>Presupuesto</legend>
              <label>
                <input
                  type="radio"
                  checked={quoteMode === 'new'}
                  onChange={() => setQuoteMode('new')}
                />{' '}
                Crear presupuesto nuevo
              </label>
              <label>
                <input
                  type="radio"
                  checked={quoteMode === 'existing'}
                  onChange={() => setQuoteMode('existing')}
                />{' '}
                Usar presupuesto existente
              </label>
            </fieldset>
          )}
          <label className="field">
            <span>Responsable</span>
            <input value={actor} onChange={(event) => setActor(event.target.value)} />
          </label>
          <label className="field">
            <span>Nota</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} />
          </label>
          {error && (
            <p className="commercial-warning" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="result-drawer-actions">
          <button
            className="button button-line"
            type="button"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={() => void submit()}
            disabled={isSaving || recoveryRequired}
          >
            {isSaving ? 'Guardando…' : 'Guardar resultado'}
          </button>
        </div>
      </aside>
    </div>
  );
}
