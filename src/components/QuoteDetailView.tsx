import { useState } from 'react';
import { workUnitSymbols } from '../data/workUnits';
import type { Client } from '../types/client';
import type { Opportunity } from '../types/opportunity';
import type { CommercialStatus, CommercialStatusAudit, SavedQuote } from '../types/quote';
import { calculateLineSubtotal, calculateQuoteTotal } from '../utils/quoteCalculations';
import { currencyFormatter } from '../utils/quoteFormatting';
import {
  commercialStatusLabels,
  getCommercialTransitionTargets,
} from '../utils/quoteCommercialStatus';

interface Props {
  quote: SavedQuote;
  client?: Client;
  opportunity?: Opportunity;
  onBack(): void;
  onPdf(quote: SavedQuote): Promise<string | null>;
  onStatus(
    quote: SavedQuote,
    status: CommercialStatus,
    audit: CommercialStatusAudit,
  ): string | null;
}

export function QuoteDetailView({ quote, client, opportunity, onBack, onPdf, onStatus }: Props) {
  const [target, setTarget] = useState<CommercialStatus | null>(null);
  const [author, setAuthor] = useState('');
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [loadingPdf, setLoadingPdf] = useState(false);
  const total = calculateQuoteTotal(quote.lines);
  const targets = getCommercialTransitionTargets(quote.commercialStatus, quote.status);
  const displayName = opportunity?.name || quote.projectName || 'Presupuesto';

  async function pdf() {
    if (loadingPdf) return;
    setLoadingPdf(true);
    const error = await onPdf(quote);
    setFeedback(error ?? 'El PDF se descargó correctamente.');
    setLoadingPdf(false);
  }
  function confirm() {
    if (!target) return;
    const error = onStatus(quote, target, {
      changedAt: new Date().toISOString(),
      changedBy: author.trim(),
      reason: reason.trim(),
    });
    if (error) return setFeedback(error);
    setFeedback(`Estado actualizado a ${commercialStatusLabels[target]}.`);
    setTarget(null);
  }

  return (
    <main className="quote-detail-workspace">
      <aside className="quote-detail-sidebar" aria-label="Navegación">
        <strong>ingenya</strong>
        <small>CONSTRUYE RELACIONES</small>
        <span>♧ Prospectos</span>
        <span>▥ Métricas</span>
        <span className="quote-nav-active">▣ Seguimiento</span>
        <span>➤ Cadencias</span>
        <span>▤ Mis presupuestos</span>
        <span>⌂ Mano de obra</span>
      </aside>
      <section className="quote-detail-content">
        <p className="quote-breadcrumb">
          Seguimiento / Oportunidades / <strong>Presupuestos</strong>
        </p>
        <button className="button button-link quote-detail-back" type="button" onClick={onBack}>
          ← Volver a oportunidad
        </button>
        <header className="quote-detail-header">
          <div>
            <div className="quote-title-line">
              <h1>{displayName}</h1>
              <span className="quote-proposal-chip">
                {commercialStatusLabels[quote.commercialStatus]}
              </span>
            </div>
            <p>
              {client?.name || quote.clientName || 'Cliente sin asociar'} ·{' '}
              {client?.company || 'Sin empresa'} · {client?.phone || 'Teléfono pendiente'} ·{' '}
              {client?.email || 'Email pendiente'}
            </p>
          </div>
        </header>
        <nav className="quote-detail-tabs" aria-label="Secciones">
          <span>Resumen</span>
          <span>Actividad</span>
          <strong>Presupuestos</strong>
          <span>Notas</span>
          <span>Archivos</span>
        </nav>
        <div className="quote-detail-grid">
          <div className="quote-detail-main">
            <section className="quote-detail-card">
              <div className="quote-card-title">
                <div>
                  <h2>Presupuesto {quote.id}</h2>
                  <p>Guardado el {new Date(quote.savedAt).toLocaleDateString('es-AR')}</p>
                </div>
                <b>Versión actual</b>
              </div>
              {quote.lines.length ? (
                <div className="table-scroll">
                  <table className="quote-detail-table">
                    <thead>
                      <tr>
                        <th>Servicio / Material</th>
                        <th>Cantidad</th>
                        <th>Precio unitario</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quote.lines.map((line) => (
                        <tr key={line.id}>
                          <td>
                            <strong>{line.name}</strong>
                            {line.description && <small>{line.description}</small>}
                          </td>
                          <td>
                            {line.quantity} {workUnitSymbols[line.unit]}
                          </td>
                          <td>{currencyFormatter.format(line.unitPrice)}</td>
                          <td>
                            {currencyFormatter.format(
                              calculateLineSubtotal(line.quantity, line.unitPrice),
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="commercial-warning">Este presupuesto no tiene servicios.</p>
              )}
              <footer className="quote-document-total">
                <span>Total</span>
                <strong>{currencyFormatter.format(total)}</strong>
              </footer>
              <div className="quote-document-actions">
                <button
                  className="button button-primary"
                  type="button"
                  onClick={pdf}
                  disabled={loadingPdf || !quote.lines.length}
                >
                  {loadingPdf ? 'Generando…' : '▧ Ver PDF'}
                </button>
                <a
                  className="button button-line"
                  href={
                    client?.phone ? `https://wa.me/${client.phone.replace(/\D/g, '')}` : undefined
                  }
                  aria-disabled={!client?.phone}
                >
                  ◉ Enviar por WhatsApp
                </a>
                <a
                  className="button button-line"
                  href={client?.email ? `mailto:${client.email}` : undefined}
                  aria-disabled={!client?.email}
                >
                  ✉ Enviar por email
                </a>
              </div>
              {feedback && (
                <p className="quote-detail-feedback" role="status">
                  {feedback}
                </p>
              )}
            </section>
            <section className="quote-detail-card quote-status-card">
              <h2>Estado del presupuesto</h2>
              <div className="quote-status-flow">
                <span>Borrador</span>
                <i />
                <span
                  className={
                    ['sent', 'followingUp'].includes(quote.commercialStatus) ? 'active' : ''
                  }
                >
                  Enviado
                </span>
                <i />
                <span className={quote.commercialStatus === 'accepted' ? 'accepted' : ''}>
                  Aceptado
                </span>
              </div>
              <div className="quote-status-actions">
                {targets.includes('sent') && (
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => setTarget('sent')}
                  >
                    Registrar envío
                  </button>
                )}
                {targets.includes('accepted') && (
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => setTarget('accepted')}
                  >
                    Marcar aceptado
                  </button>
                )}
                {targets.includes('rejected') && (
                  <button
                    className="button button-danger"
                    type="button"
                    onClick={() => setTarget('rejected')}
                  >
                    ✕ Marcar como perdido
                  </button>
                )}
              </div>
            </section>
          </div>
          <aside className="quote-detail-side">
            <section className="quote-detail-card quote-contact-detail">
              <h2>Contacto</h2>
              <p>
                <strong>{client?.name || quote.clientName || 'Cliente sin asociar'}</strong>
                <br />
                {client?.company || 'Sin empresa'}
              </p>
              <p>☎ {client?.phone || 'Teléfono pendiente'}</p>
              <p>✉ {client?.email || 'Email pendiente'}</p>
            </section>
            <section className="quote-detail-card quote-commercial-summary">
              <h2>Resumen comercial</h2>
              <p>
                Valor estimado{' '}
                <strong>
                  {currencyFormatter.format(opportunity?.qualification?.estimatedValue ?? total)}
                </strong>
              </p>
              <p>
                Etapa <strong>{commercialStatusLabels[quote.commercialStatus]}</strong>
              </p>
              <p>
                Responsable <strong>{opportunity?.responsibleSeller || 'Sin asignar'}</strong>
              </p>
            </section>
            <section className="quote-detail-card">
              <h2>Actividad reciente</h2>
              <p className="commercial-note">
                Los envíos y cambios de estado quedarán registrados en la actividad del presupuesto.
              </p>
            </section>
          </aside>
        </div>
        {target && (
          <div className="modal-backdrop">
            <section className="confirmation-modal" role="dialog" aria-modal="true">
              <h2>¿Registrar {commercialStatusLabels[target].toLowerCase()}?</h2>
              <p>Este cambio se auditará; no se cerrará si el guardado falla.</p>
              <label className="field">
                <span>Responsable</span>
                <input value={author} onChange={(event) => setAuthor(event.target.value)} />
              </label>
              <label className="field">
                <span>Motivo</span>
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
              </label>
              <div className="confirmation-actions">
                <button
                  className="button button-line"
                  type="button"
                  onClick={() => setTarget(null)}
                >
                  Cancelar
                </button>
                <button className="button button-primary" type="button" onClick={confirm}>
                  Confirmar
                </button>
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
