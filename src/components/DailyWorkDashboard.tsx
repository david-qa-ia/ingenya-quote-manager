import { useState } from 'react';
import type { FollowUpBucket, FollowUpInboxItem } from '../types/followUpInbox';
import { businessTimeZone } from '../utils/opportunityNextAction';
import { getContactAction } from '../utils/contactAction';

interface Props {
  items: readonly FollowUpInboxItem[];
  onShowFollowUp: () => void;
  onOpen: (item: FollowUpInboxItem) => void;
}

const labels = { overdue: 'Vencidos', today: 'Hoy', upcoming: 'Próximos' } as const;

function BucketIcon({ bucket }: { bucket: keyof typeof labels }) {
  if (bucket === 'upcoming') {
    return (
      <svg
        className={`daily-bucket-icon daily-bucket-icon-${bucket}`}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="m9 5 7 7-7 7" />
      </svg>
    );
  }
  if (bucket === 'today') {
    return (
      <svg
        className={`daily-bucket-icon daily-bucket-icon-${bucket}`}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
        <path d="M7 3.5v4M17 3.5v4M3.5 10h17" />
      </svg>
    );
  }
  return (
    <svg
      className={`daily-bucket-icon daily-bucket-icon-${bucket}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

function ContactAction({ item }: { item: FollowUpInboxItem }) {
  const [feedback, setFeedback] = useState('');
  const action = getContactAction(item);
  if (!action) return null;
  if ('disabledReason' in action)
    return (
      <button className="button button-line" type="button" disabled title={action.disabledReason}>
        {action.label}
      </button>
    );
  const href = action.href;
  async function openCall() {
    try {
      window.location.href = href;
    } catch {
      await navigator.clipboard?.writeText(item.phone ?? '');
      setFeedback('No se pudo iniciar la llamada. Teléfono copiado.');
    }
  }
  if (action.label === 'Llamar')
    return (
      <>
        <button className="button button-line" type="button" onClick={() => void openCall()}>
          Llamar
        </button>
        {feedback && <small className="commercial-warning">{feedback}</small>}
      </>
    );
  return (
    <a className="button button-line" href={href}>
      {action.label}
    </a>
  );
}

export function DailyWorkDashboard({ items, onShowFollowUp, onOpen }: Props) {
  const [selectedBucket, setSelectedBucket] = useState<FollowUpBucket | 'all'>('today');
  const date = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: businessTimeZone,
  }).format(new Date());
  const visible = items
    .filter((item) => item.bucket !== 'missing')
    .filter((item) => selectedBucket === 'all' || item.bucket === selectedBucket)
    .slice(0, 6);
  return (
    <main className="app-shell daily-dashboard">
      <header className="daily-dashboard-header">
        <div>
          <h1>Mi trabajo de hoy</h1>
          <p className="page-description">{date}</p>
          <button className="daily-dashboard-followup-link" type="button" onClick={onShowFollowUp}>
            Ver seguimiento completo →
          </button>
        </div>
      </header>
      <section className="daily-dashboard-summary" aria-label="Resumen del trabajo diario">
        {(Object.keys(labels) as (keyof typeof labels)[]).map((bucket) => (
          <button
            className={`daily-dashboard-tab ${selectedBucket === bucket ? 'daily-dashboard-tab-active' : ''}`}
            key={bucket}
            type="button"
            aria-pressed={selectedBucket === bucket}
            onClick={() => setSelectedBucket(bucket)}
          >
            <BucketIcon bucket={bucket} />
            <strong>{items.filter((item) => item.bucket === bucket).length}</strong>
            <span>{labels[bucket]}</span>
          </button>
        ))}
      </section>
      <section className="quote-card daily-dashboard-table">
        <div className="daily-dashboard-columns">
          <span>Contacto / Proyecto</span>
          <span>Tipo</span>
          <span>Valor comercial</span>
          <span>Horario</span>
          <span>Próxima tarea</span>
          <span>Acción</span>
        </div>
        {visible.length ? (
          visible.map((item) => (
            <article className="daily-dashboard-row" key={item.id}>
              <div>
                <strong>{item.clientName}</strong>
                <small>{item.opportunityName ?? item.quoteName ?? 'Sin contexto disponible'}</small>
              </div>
              <span className="daily-type-badge">
                {item.subjectType === 'prospect'
                  ? 'Prospecto'
                  : item.subjectType === 'quote'
                    ? 'Presupuesto enviado'
                    : 'Oportunidad'}
              </span>
              <span>
                {item.estimatedValue === undefined
                  ? 'Sin valor estimado'
                  : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(
                      item.estimatedValue,
                    )}
              </span>
              <strong>
                {new Intl.DateTimeFormat('es-AR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: businessTimeZone,
                }).format(new Date(item.action!.dueAt))}
              </strong>
              <span>{item.action?.description}</span>
              <div className="daily-row-actions">
                <ContactAction item={item} />
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => onOpen(item)}
                >
                  ✓ Registrar resultado
                </button>
              </div>
            </article>
          ))
        ) : (
          <p className="commercial-note">Tu bandeja está al día.</p>
        )}
      </section>
    </main>
  );
}
