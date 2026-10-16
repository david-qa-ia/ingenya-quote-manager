import { useState } from 'react';
import type { FollowUpBucket, FollowUpInboxItem } from '../types/followUpInbox';
import { businessTimeZone } from '../utils/opportunityNextAction';

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
  const missing = items.filter((item) => item.bucket === 'missing');
  const quoteAlerts = items.filter(
    (item) => item.subjectType === 'quote' && item.bucket === 'overdue',
  );
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
        <div className="daily-dashboard-alerts" aria-label="Alertas">
          <button type="button" onClick={onShowFollowUp}>
            <span className="daily-alert-icon" aria-hidden="true">
              !
            </span>
            <strong>
              {missing.length} {missing.length === 1 ? 'oportunidad' : 'oportunidades'} sin próximo
              paso
            </strong>
            <span aria-hidden="true">›</span>
          </button>
          <button type="button" onClick={onShowFollowUp}>
            <span className="daily-alert-icon" aria-hidden="true">
              ✉
            </span>
            <strong>
              {quoteAlerts.length} {quoteAlerts.length === 1 ? 'propuesta' : 'propuestas'} sin
              respuesta
            </strong>
            <span aria-hidden="true">›</span>
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
              <button className="button button-primary" type="button" onClick={() => onOpen(item)}>
                {item.action?.kind === 'sendQuote'
                  ? 'Enviar presupuesto'
                  : item.action?.type === 'call'
                    ? 'Llamar'
                    : item.action?.type === 'whatsapp'
                      ? 'WhatsApp'
                      : 'Registrar resultado'}
              </button>
              <button
                className="daily-row-menu"
                type="button"
                aria-label={`Más opciones para ${item.clientName}`}
                onClick={() => onOpen(item)}
              >
                ⋮
              </button>
            </article>
          ))
        ) : (
          <p className="commercial-note">Tu bandeja está al día.</p>
        )}
      </section>
    </main>
  );
}
