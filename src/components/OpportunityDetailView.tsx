import { useMemo, useState } from 'react';
import { ActivityTimeline } from './ActivityTimeline';
import { NextActionCard } from './NextActionCard';
import type { Client } from '../types/client';
import type { Opportunity } from '../types/opportunity';
import type { SavedQuote } from '../types/quote';
import { businessTimeZone } from '../utils/opportunityNextAction';

type DetailTab = 'summary' | 'activity' | 'quotes' | 'notes' | 'files';

interface Props {
  opportunity: Opportunity;
  client?: Client;
  quotes: readonly SavedQuote[];
  onBack: () => void;
  onSaveOpportunity: (opportunity: Opportunity, event: string) => boolean;
  onPrepareContact: (channel: 'call' | 'whatsapp') => void;
  onOpenQuote: (quote: SavedQuote) => void;
}

const tabLabels: Record<DetailTab, string> = {
  summary: 'Resumen',
  activity: 'Actividad',
  quotes: 'Presupuestos',
  notes: 'Notas',
  files: 'Archivos',
};
const interestLabels = { high: 'Alto', medium: 'Medio', low: 'Bajo' } as const;
const channelLabels = {
  call: 'Llamada',
  whatsapp: 'WhatsApp',
  email: 'Email',
  meeting: 'Reunión',
  waitForResponse: 'Esperar respuesta',
  other: 'Otra',
} as const;
const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

function dateTime(iso: string) {
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: businessTimeZone,
  }).format(new Date(iso));
}

export function OpportunityDetailView({
  opportunity,
  client,
  quotes,
  onBack,
  onSaveOpportunity,
  onPrepareContact,
  onOpenQuote,
}: Props) {
  const [tab, setTab] = useState<DetailTab>('summary');
  const [copied, setCopied] = useState('');
  const relatedQuotes = useMemo(
    () => quotes.filter((quote) => quote.opportunityId === opportunity.id),
    [opportunity.id, quotes],
  );
  const action = opportunity.nextAction?.status === 'pending' ? opportunity.nextAction : undefined;
  const qualification = opportunity.qualification;
  const isMissingClient = !client;
  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(`${label} copiado`);
    } catch {
      setCopied(`No se pudo copiar ${label.toLocaleLowerCase('es')}.`);
    }
  }

  return (
    <main className="app-shell opportunity-detail-view">
      <button className="button button-link opportunity-back" type="button" onClick={onBack}>
        ← Volver a seguimiento
      </button>
      <header className="opportunity-detail-header">
        <div>
          <p className="eyebrow">Seguimiento / Oportunidades</p>
          <h1>{opportunity.name}</h1>
          <p className="page-description">
            {client?.company && `${client.company} · `}
            {client?.name ?? 'Cliente no disponible'}
          </p>
        </div>
        <div className="opportunity-header-actions">
          <span className="status-badge prospect-status-contacted">● En seguimiento</span>
          <button
            className="button button-primary"
            type="button"
            onClick={() => setTab('activity')}
          >
            ⚡ Registrar acción
          </button>
        </div>
      </header>
      {isMissingClient && (
        <p className="commercial-warning" role="alert">
          No se encontró el cliente vinculado. La oportunidad se muestra en modo de solo lectura.
        </p>
      )}
      <div className="opportunity-tabs" role="tablist" aria-label="Secciones de oportunidad">
        {(Object.keys(tabLabels) as DetailTab[]).map((item) => (
          <button
            key={item}
            className={tab === item ? 'opportunity-tab opportunity-tab-active' : 'opportunity-tab'}
            role="tab"
            type="button"
            aria-selected={tab === item}
            onClick={() => setTab(item)}
          >
            {tabLabels[item]}
          </button>
        ))}
      </div>
      {tab === 'summary' && (
        <div className="opportunity-detail-grid">
          <div className="opportunity-detail-main">
            <section className="quote-card opportunity-next-step">
              <p className="eyebrow">Próximo paso</p>
              {action ? (
                <div className="opportunity-step-main">
                  <div className="opportunity-step-icon" aria-hidden="true">
                    ◔
                  </div>
                  <div>
                    <h2>{action.description}</h2>
                    <p>
                      {channelLabels[action.type]} · {dateTime(action.dueAt)} · {action.responsible}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <h2>Sin próximo paso</h2>
                  <p className="commercial-note">
                    Programá una acción para sostener el seguimiento.
                  </p>
                </>
              )}
              {!isMissingClient && (
                <NextActionCard
                  opportunity={opportunity}
                  onSave={onSaveOpportunity}
                  onPrepareContact={onPrepareContact}
                />
              )}
            </section>
            <section className="quote-card opportunity-data-card">
              <h2>Datos de oportunidad</h2>
              <dl>
                <div className="opportunity-data-row">
                  <span className="opportunity-data-icon" aria-hidden="true">
                    ⌕
                  </span>
                  <dt>Servicio de interés</dt>
                  <dd>{qualification?.serviceOfInterest || 'Sin definir'}</dd>
                </div>
                <div className="opportunity-data-row">
                  <span className="opportunity-data-icon" aria-hidden="true">
                    ▥
                  </span>
                  <dt>Nivel de interés</dt>
                  <dd>
                    {qualification ? interestLabels[qualification.interestLevel] : 'Sin definir'}
                  </dd>
                </div>
                <div className="opportunity-data-row">
                  <span className="opportunity-data-icon" aria-hidden="true">
                    ◫
                  </span>
                  <dt>Necesidad</dt>
                  <dd>{qualification?.detectedNeed || 'Sin definir'}</dd>
                </div>
                {qualification?.estimatedValue !== undefined && (
                  <div className="opportunity-data-row">
                    <span className="opportunity-data-icon" aria-hidden="true">
                      ◉
                    </span>
                    <dt>Valor estimado</dt>
                    <dd>{money.format(qualification.estimatedValue)}</dd>
                  </div>
                )}
                <div className="opportunity-data-row">
                  <span className="opportunity-data-icon" aria-hidden="true">
                    ♙
                  </span>
                  <dt>Responsable</dt>
                  <dd>{opportunity.responsibleSeller || 'Sin asignar'}</dd>
                </div>
              </dl>
            </section>
          </div>
          <aside className="opportunity-detail-side">
            <section className="quote-card opportunity-contact-card">
              <h2>Contacto</h2>
              <p>
                <strong>{client?.name ?? 'Cliente no disponible'}</strong>
              </p>
              {client?.company && <p>{client.company}</p>}
              {client?.phone && (
                <p className="opportunity-contact-line">
                  <span>☎</span>
                  {client.phone}
                  <button
                    type="button"
                    aria-label="Copiar teléfono"
                    onClick={() => copy(client.phone, 'Teléfono')}
                  >
                    ⧉
                  </button>
                </p>
              )}
              {client?.email && (
                <p className="opportunity-contact-line">
                  <span>✉</span>
                  {client.email}
                  <button
                    type="button"
                    aria-label="Copiar email"
                    onClick={() => copy(client.email, 'Email')}
                  >
                    ⧉
                  </button>
                </p>
              )}
              {copied && (
                <small className="commercial-note" role="status">
                  {copied}
                </small>
              )}
            </section>
            <section className="quote-card opportunity-activity-preview">
              <h2>Actividad reciente</h2>
              <p className="commercial-note">
                Consultá la pestaña Actividad para ver y registrar movimientos.
              </p>
              <button
                className="button button-line"
                type="button"
                onClick={() => setTab('activity')}
              >
                Ver toda la actividad
              </button>
            </section>
          </aside>
        </div>
      )}
      {tab === 'activity' && (
        <section className="quote-card opportunity-tab-panel">
          <h2>Actividad</h2>
          <ActivityTimeline
            entrySubject={{ kind: 'opportunity', opportunityId: opportunity.id }}
            subjects={[
              {
                subject: { kind: 'opportunity', opportunityId: opportunity.id },
                label: 'Obra o trabajo',
              },
            ]}
            emptyMessage="Todavía no hay actividades para esta oportunidad."
          />
        </section>
      )}
      {tab === 'notes' && (
        <section className="quote-card opportunity-tab-panel">
          <h2>Notas</h2>
          <ActivityTimeline
            entrySubject={{ kind: 'opportunity', opportunityId: opportunity.id }}
            subjects={[
              {
                subject: { kind: 'opportunity', opportunityId: opportunity.id },
                label: 'Obra o trabajo',
              },
            ]}
            initialFilter="note"
            hideFilters
            emptyMessage="Todavía no hay notas para esta oportunidad."
            registerLabel="Registrar nota"
          />
        </section>
      )}
      {tab === 'quotes' && (
        <section className="quote-card opportunity-tab-panel">
          <h2>Presupuestos</h2>
          {relatedQuotes.length ? (
            <ul className="opportunity-quote-list">
              {relatedQuotes.map((quote) => (
                <li key={quote.id}>
                  <div>
                    <strong>{quote.projectName || quote.id}</strong>
                    <small>{quote.commercialStatus}</small>
                  </div>
                  <button
                    className="button button-line"
                    type="button"
                    onClick={() => onOpenQuote(quote)}
                  >
                    Abrir presupuesto
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">
              <h3>Aún no hay presupuestos</h3>
              <p>Cuando generes uno vinculado a esta oportunidad aparecerá aquí.</p>
            </div>
          )}
        </section>
      )}
      {tab === 'files' && (
        <section className="quote-card opportunity-tab-panel empty-state">
          <h2>Archivos</h2>
          <p>Aún no hay archivos adjuntos.</p>
          <p className="commercial-note">
            La carga de documentos se habilitará cuando tenga una persistencia segura, para evitar
            perder archivos al recargar.
          </p>
        </section>
      )}
    </main>
  );
}
