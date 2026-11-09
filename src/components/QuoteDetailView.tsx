import { currentActivityNote } from '../utils/activityNoteEditing';
import { buildContactMessage, buildWhatsAppUrl } from '../utils/whatsappMessage';
import { useContactSender } from '../utils/useContactSender';
import { FieldError } from './FieldError';
import {
  commercialReasonLabels,
  formatLossReason,
  getLossReasonFieldErrors,
  isLossReasonCode,
  lossReasonCodes,
} from '../utils/commercialOutcome';
import { useState } from 'react';
import { formatActivityDateTime } from '../utils/activityTimeline';
import { loadActivities } from '../utils/activityStorage';
import { UiIcon } from './UiIcon';
import { canCreateQuoteVersion } from '../utils/quoteVersioning';
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
import { ResponsibleField } from './ResponsibleSelect';
import { isPendingEmail, isPendingPhone } from '../utils/clientValidation';
import { quoteStatusLabel } from '../utils/quoteCommercialStatus';

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
  onContinueEditing(quote: SavedQuote): void;
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
  onContinueEditing,
  onRegisterSend,
  onRequestChange,
  onConvertDirect,
}: Props) {
  const [target, setTarget] = useState<CommercialStatus | null>(null);
  const [author, setAuthor] = useState('');
  const [reason, setReason] = useState('');
  const [lossCode, setLossCode] = useState('');
  const [lossDetail, setLossDetail] = useState('');
  const [showLossErrors, setShowLossErrors] = useState(false);
  const lossErrors = getLossReasonFieldErrors({ code: lossCode, detail: lossDetail });
  const [feedback, setFeedback] = useState('');
  const [changeOpen, setChangeOpen] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [changeResponsible, setChangeResponsible] = useState('');
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [converting, setConverting] = useState(false);
  const total = calculateQuoteTotal(quote.lines);
  const targets = getCommercialTransitionTargets(quote.commercialStatus, quote.status);
  const displayName = opportunity?.name || quote.projectName || 'Presupuesto';
  const isDraft = quote.status === 'draft';
  // SCRUM-121: a disabled "Registrar envío" always says why.
  const sendDisabledReason = targets.includes('sent')
    ? undefined
    : isDraft
      ? 'Finalizá el presupuesto para poder registrar su envío.'
      : quote.commercialStatus === 'paused'
        ? 'El presupuesto está pausado. Reactivalo para registrar el envío.'
        : `El envío ya está registrado. Estado: ${quoteStatusLabel(quote.commercialStatus)}.`;
  const canCreateVersion = canCreateQuoteVersion(quote, opportunity);

  async function pdf() {
    if (loadingPdf) return;
    setLoadingPdf(true);
    const error = await onPdf(quote);
    setFeedback(error ?? 'El PDF se descargó correctamente.');
    setLoadingPdf(false);
  }
  function confirm() {
    if (!target) return;
    // A loss is recorded with a reason from the list (and a few words for "Otro").
    if (target === 'rejected' && Object.keys(lossErrors).length) return setShowLossErrors(true);
    const error = onStatus(quote, target, {
      changedAt: new Date().toISOString(),
      changedBy: author.trim(),
      reason:
        target === 'rejected' && isLossReasonCode(lossCode)
          ? formatLossReason(lossCode, lossDetail)
          : reason.trim(),
    });
    if (error) return setFeedback(error);
    setFeedback(`Estado actualizado a ${commercialStatusLabels[target]}.`);
    closeStatusDialog();
  }

  function closeStatusDialog() {
    setTarget(null);
    setLossCode('');
    setLossDetail('');
    setShowLossErrors(false);
  }

  const sender = useContactSender();
  const whatsappUrl = buildWhatsAppUrl(
    client?.phone,
    buildContactMessage({
      ...sender,
      purpose: 'quote',
      contactName: client?.name || quote.clientName,
      service: opportunity?.qualification?.serviceOfInterest || quote.projectName,
    }),
  );
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
      <button
        className="button button-link quote-detail-back back-link"
        type="button"
        onClick={onBack}
      >
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
                      <th>Servicio</th>
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
              {isDraft && (
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => onContinueEditing(quote)}
                >
                  <UiIcon name="document" /> Revisar y finalizar
                </button>
              )}
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
                  whatsappUrl &&
                  openExternal(
                    whatsappUrl,
                    'WhatsApp abierto. Registrá el envío cuando lo hayas compartido.',
                  )
                }
                disabled={!whatsappUrl}
                title={!whatsappUrl ? 'Falta un teléfono válido.' : undefined}
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
                title={sendDisabledReason}
                aria-describedby={
                  sendDisabledReason && !isDraft ? 'quote-send-disabled' : undefined
                }
              >
                <UiIcon name="send" /> Registrar envío
              </button>
            </div>
            {sendDisabledReason && !isDraft && (
              <p className="quote-detail-feedback" id="quote-send-disabled">
                {sendDisabledReason}
              </p>
            )}
            {isDraft && (
              <p className="quote-detail-feedback" role="status">
                Este presupuesto está listo para revisar, pero todavía es un borrador. Completalo y
                finalizalo para habilitar el registro de envío.
              </p>
            )}
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
            {quote.commercialStatus === 'sent' && canCreateVersion && (
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
            {/* SCRUM-120: an accepted or rejected quote shows who decided, when and why. */}
            {(quote.commercialStatus === 'accepted' || quote.commercialStatus === 'rejected') && (
              <div
                className={`quote-outcome-summary quote-outcome-${quote.commercialStatus}`}
                role="status"
              >
                <strong>
                  {quote.commercialStatus === 'accepted' ? 'Aceptado' : 'Perdido'} ·{' '}
                  {formatActivityDateTime(quote.commercialStatusAudit.changedAt)}
                  {quote.commercialStatusAudit.changedBy
                    ? ` · ${quote.commercialStatusAudit.changedBy}`
                    : ''}
                </strong>
                {quote.commercialStatusAudit.reason?.trim() && (
                  <p>{quote.commercialStatusAudit.reason.trim()}</p>
                )}
              </div>
            )}
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
            <p className="quote-contact-line">
              <UiIcon name="phone" />
              {client?.phone && !isPendingPhone(client.phone) ? client.phone : 'Sin teléfono'}
            </p>
            <p className="quote-contact-line">
              <UiIcon name="email" />
              {client?.email && !isPendingEmail(client.email) ? client.email : 'Sin email'}
            </p>
          </section>
          <section className="quote-detail-card">
            <h2>Contexto operativo</h2>
            <p className="commercial-note">
              {quote.commercialStatus === 'prepared'
                ? 'Todavía no registraste el envío.'
                : 'El envío ya fue registrado para esta versión.'}
            </p>
            <p className="commercial-note">
              Próximo paso:{' '}
              {opportunity?.nextAction?.status === 'pending'
                ? opportunity.nextAction.description
                : 'Sin próximo paso programado.'}
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
                    {formatActivityDateTime(activity.occurredAt)} ·{' '}
                    {currentActivityNote(activity) || activity.result}
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
            <ResponsibleField label="Responsable" value={author} onChange={setAuthor} />
            {target === 'rejected' ? (
              <>
                <label className="field">
                  <span>Motivo</span>
                  <select
                    value={lossCode}
                    onChange={(event) => setLossCode(event.target.value)}
                    aria-invalid={showLossErrors && lossErrors.code ? true : undefined}
                    aria-describedby={
                      showLossErrors && lossErrors.code ? 'loss-reason-code-error' : undefined
                    }
                  >
                    <option value="">Elegí un motivo</option>
                    {lossReasonCodes.map((code) => (
                      <option key={code} value={code}>
                        {commercialReasonLabels[code]}
                      </option>
                    ))}
                  </select>
                  <FieldError
                    id="loss-reason-code-error"
                    message={showLossErrors ? lossErrors.code : undefined}
                  />
                </label>
                <label className="field">
                  <span>{lossCode === 'other' ? '¿Cuál es el motivo?' : 'Detalle (opcional)'}</span>
                  <textarea
                    value={lossDetail}
                    onChange={(event) => setLossDetail(event.target.value)}
                    aria-invalid={showLossErrors && lossErrors.detail ? true : undefined}
                    aria-describedby={
                      showLossErrors && lossErrors.detail ? 'loss-reason-detail-error' : undefined
                    }
                  />
                  <FieldError
                    id="loss-reason-detail-error"
                    message={showLossErrors ? lossErrors.detail : undefined}
                  />
                </label>
              </>
            ) : (
              <label className="field">
                <span>Motivo</span>
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
              </label>
            )}
            <div className="confirmation-actions">
              <button className="button button-line" type="button" onClick={closeStatusDialog}>
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
            <ResponsibleField
              label="Responsable"
              value={changeResponsible}
              onChange={setChangeResponsible}
            />
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
