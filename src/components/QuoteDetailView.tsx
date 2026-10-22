import { useState } from 'react';
import { loadActivities } from '../utils/activityStorage';
import { UiIcon } from './UiIcon';
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
  versions: readonly SavedQuote[];
  client?: Client;
  opportunity?: Opportunity;
  onBack(): void;
  onPdf(quote: SavedQuote): Promise<string | null>;
  onStatus(
    quote: SavedQuote,
    status: CommercialStatus,
    audit: CommercialStatusAudit,
  ): string | null;
  onRegisterSend(quote: SavedQuote): void;
  onRequestChange(quote: SavedQuote, reason: string, responsible: string): void;
  onConvertDirect(quote: SavedQuote): string | null;
}

export function QuoteDetailView({
  quote,
  versions,
  client,
  opportunity,
  onBack,
  onPdf,
  onStatus,
  onRegisterSend,
  onRequestChange,
  onConvertDirect,
}: Props) {
  const [target, setTarget] = useState<CommercialStatus | null>(null);
  const [author, setAuthor] = useState('');
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState('');
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [changeResponsible, setChangeResponsible] = useState('');
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [converting, setConverting] = useState(false);
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

  const phone = client?.phone?.replace(/\D/g, '');
  const email = client?.email?.trim();
  function openExternal(url: string, message: string) {
    window.open(url, '_blank', 'noopener,noreferrer');
    setFeedback(message);
  }
  function convertDirect() {
    if (converting) return;
    setConverting(true);
    const error = onConvertDirect(quote);
    setFeedback(error ?? 'El presupuesto se vinculó a una oportunidad conservando su historial.');
    setConverting(false);
  }

  return (
    <main className="quote-detail-content">
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
                <UiIcon name="document" /> {loadingPdf ? 'Generando…' : 'Descargar PDF'}
              </button>
              <button
                className="button button-line"
                type="button"
                onClick={() =>
                  phone &&
                  openExternal(
                    `https://wa.me/${phone}`,
                    'WhatsApp abierto. Registrá el envío cuando lo hayas compartido.',
                  )
                }
                disabled={!phone}
                title={!phone ? 'Falta un teléfono válido.' : undefined}
              >
                <UiIcon name="whatsapp" /> Abrir WhatsApp
              </button>
              <button
                className="button button-line"
                type="button"
                onClick={() =>
                  email &&
                  openExternal(
                    `mailto:${email}?subject=${encodeURIComponent(`Presupuesto ${quote.id}`)}&body=${encodeURIComponent(`Hola, te comparto el presupuesto ${quote.id}.`)}`,
                    'Cliente de email preparado. Registrá el envío cuando lo hayas compartido.',
                  )
                }
                disabled={!email}
                title={!email ? 'Falta un email válido.' : undefined}
              >
                <UiIcon name="email" /> Preparar email
              </button>
              <button
                className="button button-primary"
                type="button"
                onClick={() => onRegisterSend(quote)}
                disabled={!targets.includes('sent')}
              >
                <UiIcon name="send" /> Registrar envío
              </button>
            </div>
            {feedback && (
              <p className="quote-detail-feedback" role="status">
                {feedback}
              </p>
            )}
          </section>
          <section
            className="quote-detail-card quote-version-history"
            aria-labelledby="quote-version-history"
          >
            <h2 id="quote-version-history">Historial de versiones</h2>
            {[...versions]
              .sort((a, b) => (a.version ?? 1) - (b.version ?? 1))
              .map((item) => (
                <article
                  key={item.id}
                  className={
                    item.id === quote.id ? 'quote-version-row current' : 'quote-version-row sent'
                  }
                >
                  <strong>V{item.version ?? 1}</strong>
                  <div>
                    <b>
                      {item.sentAudit
                        ? `Enviada${item.sentAudit.channel ? ` por ${item.sentAudit.channel === 'whatsapp' ? 'WhatsApp' : 'email'}` : ''}`
                        : item.id === quote.id
                          ? 'Vigente'
                          : 'Reemplazada'}
                    </b>
                    <p>{item.changeRequest?.reason || 'Versión comercial registrada.'}</p>
                  </div>
                  <small>
                    {item.sentAudit
                      ? `${new Date(item.sentAudit.changedAt).toLocaleDateString('es-AR')} · ${item.sentAudit.changedBy}`
                      : `Actualizada el ${new Date(item.savedAt).toLocaleDateString('es-AR')}`}
                  </small>
                </article>
              ))}
            {quote.commercialStatus === 'sent' && (
              <>
                <p className="commercial-note">
                  La versión enviada queda preservada. Para aplicar cambios, registrá el pedido y
                  creá una nueva versión.
                </p>
                <button
                  className="button button-line"
                  type="button"
                  onClick={() => setChangeOpen(true)}
                >
                  Registrar pedido de cambio
                </button>
              </>
            )}
          </section>
          <section className="quote-detail-card quote-status-card">
            <h2>Resultado comercial</h2>
            <div className="quote-status-actions">
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
          {!opportunity && quote.clientId && (
            <section className="quote-detail-card" aria-label="Conversión comercial">
              <h2>Cliente directo</h2>
              <p className="commercial-note">
                Este presupuesto no pertenece a una oportunidad. Podés convertirlo cuando el trabajo
                requiera seguimiento comercial.
              </p>
              <button
                className="button button-line"
                type="button"
                onClick={convertDirect}
                disabled={converting}
              >
                {converting ? 'Convirtiendo…' : 'Convertir en oportunidad'}
              </button>
            </section>
          )}
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
          <section className="quote-detail-card">
            <h2>Contexto operativo</h2>
            <p className="commercial-note">
              {quote.commercialStatus === 'prepared'
                ? 'Todavía no registraste el envío.'
                : 'El envío ya fue registrado para esta versión.'}
            </p>
            <p className="commercial-note">
              Próximo paso: {opportunity?.nextAction?.description ?? 'Sin próximo paso programado.'}
            </p>
          </section>
          <section className="quote-detail-card">
            <h2>Actividad</h2>
            {loadActivities().items.filter(
              (activity) =>
                activity.subject.kind === 'quote' && activity.subject.quoteId === quote.id,
            ).length ? (
              loadActivities()
                .items.filter(
                  (activity) =>
                    activity.subject.kind === 'quote' && activity.subject.quoteId === quote.id,
                )
                .map((activity) => (
                  <p className="commercial-note" key={activity.id}>
                    {new Date(activity.occurredAt).toLocaleString('es-AR')} ·{' '}
                    {activity.note || activity.result}
                  </p>
                ))
            ) : (
              <p className="commercial-note">
                Todavía no hay actividad registrada para este presupuesto.
              </p>
            )}
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
              <button className="button button-line" type="button" onClick={() => setTarget(null)}>
                Cancelar
              </button>
              <button className="button button-primary" type="button" onClick={confirm}>
                Confirmar
              </button>
            </div>
          </section>
        </div>
      )}
      {changeOpen && (
        <div className="modal-backdrop">
          <section className="confirmation-modal" role="dialog" aria-modal="true">
            <h2>Registrar pedido de cambio</h2>
            <p>
              La versión enviada se conserva como historial y se crea una nueva versión vigente.
            </p>
            <label className="field">
              <span>Responsable</span>
              <input
                value={changeResponsible}
                onChange={(event) => setChangeResponsible(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Pedido de cambio</span>
              <textarea
                value={changeReason}
                onChange={(event) => setChangeReason(event.target.value)}
              />
            </label>
            <div className="confirmation-actions">
              <button
                className="button button-line"
                type="button"
                onClick={() => setChangeOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="button button-primary"
                type="button"
                disabled={!changeReason.trim() || !changeResponsible.trim()}
                onClick={() => {
                  onRequestChange(quote, changeReason.trim(), changeResponsible.trim());
                  setChangeOpen(false);
                }}
              >
                Crear nueva versión
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
