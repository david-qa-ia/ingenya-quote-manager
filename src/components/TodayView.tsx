import { useState } from 'react';
import { formatCurrency } from '../utils/quoteFormatting';
import type { FollowUpInboxItem } from '../types/followUpInbox';
import { defaultFollowUpFilters, filterFollowUpInbox } from '../utils/followUpInbox';
import { businessTimeZone } from '../utils/opportunityNextAction';
import { getContactAction } from '../utils/contactAction';
import { useContactSender } from '../utils/useContactSender';
import { UiIcon } from './UiIcon';

interface Props {
  items: readonly FollowUpInboxItem[];
  /** Data that could not be read; the valid records are still shown. */
  issues: readonly string[];
  onOpen: (item: FollowUpInboxItem) => void;
  /** SCRUM-119: clicking the contact opens its context (prospect, opportunity or quote). */
  onOpenContext: (item: FollowUpInboxItem) => void;
  onShowMetrics: () => void;
  onShowCadences: () => void;
}

const labels = {
  overdue: 'Vencidos',
  today: 'Hoy',
  upcoming: 'Próximos',
  missing: 'Sin próxima acción',
} as const;
type Bucket = keyof typeof labels;
const bucketOrder = Object.keys(labels) as Bucket[];

function BucketIcon({ bucket }: { bucket: Bucket }) {
  if (bucket === 'missing') {
    return (
      <span className={`daily-bucket-icon daily-bucket-icon-${bucket}`}>
        <UiIcon name="help" />
      </span>
    );
  }
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
  const action = getContactAction(item, useContactSender());
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
    <a
      className="button button-line"
      href={href}
      {...(action.label === 'WhatsApp' ? { target: '_blank', rel: 'noreferrer' } : {})}
    >
      {action.label}
    </a>
  );
}

function formatDue(item: FollowUpInboxItem) {
  if (!item.action) return 'Sin fecha';
  return new Intl.DateTimeFormat(
    'es-AR',
    item.bucket === 'today'
      ? { hour: '2-digit', minute: '2-digit', timeZone: businessTimeZone }
      : {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
          timeZone: businessTimeZone,
        },
  ).format(new Date(item.action.dueAt));
}

/**
 * Hoy: everything to contact, overdue first, plus the jobs that have no next action yet.
 * It replaces "Mi trabajo de hoy" and "A quién contactar hoy", and leads to Indicadores.
 */
export function TodayView({
  items,
  issues,
  onOpen,
  onOpenContext,
  onShowMetrics,
  onShowCadences,
}: Props) {
  // SCRUM-117: open on the first bucket with work (overdue, then today, then upcoming), so the
  // screen never says "al día" while there is a pending action in another tab.
  const [selectedBucket, setSelectedBucket] = useState<Bucket>(
    () => bucketOrder.find((bucket) => items.some((item) => item.bucket === bucket)) ?? 'today',
  );
  const [search, setSearch] = useState('');
  const pendingElsewhere = bucketOrder
    .filter((bucket) => bucket !== selectedBucket)
    .map((bucket) => ({ bucket, count: items.filter((item) => item.bucket === bucket).length }))
    .filter((entry) => entry.count > 0);
  const date = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: businessTimeZone,
  }).format(new Date());
  const visible = filterFollowUpInbox(items, {
    ...defaultFollowUpFilters,
    bucket: selectedBucket,
    search,
  });
  return (
    <main className="app-shell daily-dashboard">
      <header className="daily-dashboard-header">
        <div>
          <h1>Hoy</h1>
          <p className="page-description">{date}</p>
        </div>
        <div className="header-actions">
          <button className="button button-line" type="button" onClick={onShowMetrics}>
            <UiIcon name="bar-chart" /> Indicadores
          </button>
          <button className="button button-line" type="button" onClick={onShowCadences}>
            <UiIcon name="activity" /> Automatizaciones
          </button>
        </div>
      </header>
      {issues.length > 0 && (
        <p className="commercial-warning" role="alert">
          No se pudieron recuperar todos los datos de seguimiento. Se muestran los registros válidos
          disponibles.
        </p>
      )}
      <section className="daily-dashboard-summary" aria-label="Resumen del trabajo diario">
        {bucketOrder.map((bucket) => (
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
        <label className="field daily-dashboard-search">
          <span>Buscar</span>
          <input
            type="search"
            value={search}
            placeholder="Contacto, proyecto o presupuesto"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        {visible.length ? (
          <>
            <div className="daily-dashboard-columns">
              <span>Contacto / Proyecto</span>
              <span>Tipo</span>
              <span>Valor comercial</span>
              <span>Horario</span>
              <span>Próxima tarea</span>
              <span>Acción</span>
            </div>
            {visible.map((item) => (
              <article className="daily-dashboard-row" key={item.id}>
                <button
                  className="daily-row-context"
                  type="button"
                  onClick={() => onOpenContext(item)}
                  aria-label={`Abrir el contexto de ${item.clientName}`}
                >
                  <strong>{item.clientName}</strong>
                  <small>
                    {item.opportunityName ??
                      item.quoteName ??
                      (item.subjectType === 'prospect' ? 'Prospecto' : 'Sin contexto disponible')}
                  </small>
                </button>
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
                    : formatCurrency(item.estimatedValue)}
                </span>
                <strong>{formatDue(item)}</strong>
                <span>{item.action?.description ?? 'Definí cómo seguir'}</span>
                <div className="daily-row-actions">
                  {item.contactRestricted ? (
                    <small className="commercial-warning">No contactar</small>
                  ) : (
                    <>
                      <ContactAction item={item} />
                      <button
                        className="button button-primary"
                        type="button"
                        onClick={() => onOpen(item)}
                      >
                        {item.action ? '✓ Registrar resultado' : 'Definir próxima acción'}
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </>
        ) : (
          <div className="daily-dashboard-empty-state">
            <span className="daily-empty-icon">
              <UiIcon name="check-circle" />
            </span>
            <div>
              {search.trim() ? (
                <>
                  <p>Sin resultados para “{search.trim()}”</p>
                  <small>Probá con otro nombre o revisá las otras pestañas.</small>
                </>
              ) : pendingElsewhere.length ? (
                <>
                  <p>Nada en {labels[selectedBucket].toLowerCase()}</p>
                  <small>
                    Tenés{' '}
                    {pendingElsewhere
                      .map(({ bucket, count }) => `${count} en ${labels[bucket].toLowerCase()}`)
                      .join(' y ')}
                    .
                  </small>
                </>
              ) : (
                <>
                  <p>Tu bandeja está al día</p>
                  <small>No hay acciones de seguimiento pendientes.</small>
                </>
              )}
            </div>
            {!search.trim() && pendingElsewhere.length > 0 && (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setSelectedBucket(pendingElsewhere[0].bucket)}
              >
                Ver {labels[pendingElsewhere[0].bucket].toLowerCase()}
              </button>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
