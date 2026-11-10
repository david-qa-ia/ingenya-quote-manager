import { UiIcon } from './UiIcon';
import type { RefObject } from 'react';
import { workUnitLabels, workUnitSymbols } from '../data/workUnits';
import type { QuoteLine, QuoteStatus } from '../types/quote';
import { calculateLineSubtotal, type QuoteTotals } from '../utils/quoteCalculations';
import { QuoteTotalsBreakdown } from './QuoteTotalsBreakdown';
import { currencyFormatter } from '../utils/quoteFormatting';

type Feedback = { type: 'success' | 'error'; message: string } | null;

interface Props {
  quoteId: string;
  status: QuoteStatus;
  clientName: string;
  onClientNameChange: (value: string) => void;
  projectName: string;
  onProjectNameChange: (value: string) => void;
  lines: readonly QuoteLine[];
  totals: QuoteTotals;
  saveFeedback: Feedback;
  finalizationFeedback: Feedback;
  pdfFeedback: Feedback;
  isDownloadingPdf: boolean;
  isFinalizing: boolean;
  isDocumentDataOpen: boolean;
  onToggleDocumentData: () => void;
  isConfirmationOpen: boolean;
  /** Focus returns here when the confirmation closes. */
  finalizationTriggerRef: RefObject<HTMLButtonElement | null>;
  finalizationCancelRef: RefObject<HTMLButtonElement | null>;
  finalizationConfirmRef: RefObject<HTMLButtonElement | null>;
  onEdit: () => void;
  onSaveDraft: () => void;
  onDownloadPdf: () => void;
  onRequestFinalization: () => void;
  onCancelFinalization: () => void;
  onConfirmFinalization: () => void;
  /** SCRUM-118: from a finalized quote the user can register the send and follow it up. */
  onRegisterSend: () => void;
  /** Finalizes the draft and registers its send in one step; missing without a client. */
  onSend?: () => void;
  onShowSavedQuotes: () => void;
}

/** Review of the quote being edited: confirm it, finalize it or download the PDF. */
export function QuoteSummaryView({
  quoteId,
  status,
  clientName,
  onClientNameChange,
  projectName,
  onProjectNameChange,
  lines,
  totals,
  saveFeedback,
  finalizationFeedback,
  pdfFeedback,
  isDownloadingPdf,
  isFinalizing,
  isDocumentDataOpen,
  onToggleDocumentData,
  isConfirmationOpen,
  finalizationTriggerRef,
  finalizationCancelRef,
  finalizationConfirmRef,
  onEdit,
  onSaveDraft,
  onDownloadPdf,
  onRequestFinalization,
  onCancelFinalization,
  onConfirmFinalization,
  onRegisterSend,
  onSend,
  onShowSavedQuotes,
}: Props) {
  return (
    <main className="app-shell summary-shell">
      <header className="summary-header">
        <div>
          <p className="eyebrow">Ventro · Presupuestos</p>
          <h1>{status === 'draft' ? 'Revisá el presupuesto' : 'Presupuesto finalizado'}</h1>
          <p className="page-description">
            {status === 'draft'
              ? 'Confirmá los datos antes de finalizarlo.'
              : 'Consultá el detalle o descargá el PDF del presupuesto.'}
          </p>
        </div>
        <div className="page-context">
          <div
            className="quote-identity"
            aria-label={`Presupuesto ${quoteId}, ${status === 'draft' ? 'Borrador' : 'Finalizado'}`}
          >
            <span>{quoteId}</span>
            <strong>{status === 'draft' ? 'Borrador' : 'Finalizado'}</strong>
          </div>
        </div>
      </header>

      <div className="summary-layout">
        <div className="summary-main-column">
          <section className="quote-card summary-action-card" aria-label="Acciones del presupuesto">
            <div className="summary-action-row">
              {status === 'draft' && (
                <>
                  <button className="button button-line" type="button" onClick={onEdit}>
                    <span aria-hidden="true">←</span> Volver a editar
                  </button>
                  <button className="button button-line" type="button" onClick={onSaveDraft}>
                    Guardar borrador
                  </button>
                </>
              )}
              <button
                className="button button-secondary summary-pdf-button"
                type="button"
                onClick={onDownloadPdf}
                disabled={lines.length === 0 || isDownloadingPdf}
              >
                {isDownloadingPdf ? 'Generando PDF…' : 'Descargar PDF'}
              </button>
              {status === 'draft' && (
                <button
                  ref={finalizationTriggerRef}
                  className={`button ${onSend ? 'button-line' : 'button-primary'}`}
                  type="button"
                  onClick={onRequestFinalization}
                  disabled={isFinalizing}
                >
                  {onSend ? 'Finalizar sin enviar' : 'Finalizar presupuesto'}
                </button>
              )}
              {status === 'draft' && onSend && (
                <button
                  className="button button-primary"
                  type="button"
                  onClick={onSend}
                  disabled={isFinalizing || lines.length === 0}
                >
                  <UiIcon name="send" /> Enviar
                </button>
              )}
              {status === 'finalized' && (
                <button className="button button-primary" type="button" onClick={onRegisterSend}>
                  Registrar envío y seguimiento
                </button>
              )}
              {status === 'finalized' && (
                <button className="button button-line" type="button" onClick={onShowSavedQuotes}>
                  Ir a Mis presupuestos
                </button>
              )}
            </div>
            {status === 'draft' && (
              <p className="finalization-note">
                {onSend
                  ? 'Enviar finaliza el presupuesto y registra el envío. La app no lo manda: lo compartís vos.'
                  : 'Finalizar no envía el presupuesto al cliente ni registra un cobro.'}
              </p>
            )}
            {saveFeedback && (
              <p
                className={`save-feedback save-feedback-${saveFeedback.type}`}
                role={saveFeedback.type === 'error' ? 'alert' : 'status'}
              >
                {saveFeedback.message}
              </p>
            )}
            {finalizationFeedback && (
              <p
                className={`save-feedback save-feedback-${finalizationFeedback.type}`}
                role={finalizationFeedback.type === 'error' ? 'alert' : 'status'}
              >
                {finalizationFeedback.message}
              </p>
            )}
            {pdfFeedback && (
              <p
                className={`save-feedback save-feedback-${pdfFeedback.type}`}
                role={pdfFeedback.type === 'error' ? 'alert' : 'status'}
              >
                {pdfFeedback.message}
              </p>
            )}
            <section className="document-data-card" aria-labelledby="document-data-title">
              <div className="summary-panel-heading">
                <p className="eyebrow">Datos del documento</p>
                <h2 id="document-data-title">¿Para quién es este presupuesto?</h2>
              </div>
              <p className="commercial-note">
                Estos datos aparecen en el presupuesto y PDF. Quedan congelados al finalizarlo y no
                cambian al vincular una ficha comercial.
              </p>
              <dl className="summary-read-only-data">
                <div>
                  <dt>Cliente en el presupuesto</dt>
                  <dd>{clientName.trim() || 'Sin especificar'}</dd>
                </div>
                <div>
                  <dt>Proyecto / referencia</dt>
                  <dd>{projectName.trim() || 'Sin especificar'}</dd>
                </div>
              </dl>
              {status === 'draft' && (
                <button
                  className="button button-line"
                  type="button"
                  aria-expanded={isDocumentDataOpen}
                  aria-controls="document-data-edit"
                  onClick={onToggleDocumentData}
                >
                  {isDocumentDataOpen ? 'Cerrar edición' : 'Editar datos del documento'}
                </button>
              )}
              {status === 'draft' && isDocumentDataOpen && (
                <div id="document-data-edit" className="document-data-edit">
                  <label className="field">
                    <span>Cliente en el presupuesto</span>
                    <input
                      type="text"
                      value={clientName}
                      onChange={(event) => onClientNameChange(event.target.value)}
                      placeholder="Nombre que figurará en el presupuesto"
                    />
                    <small>Podés dejar este campo vacío.</small>
                  </label>
                  <label className="field">
                    <span>Proyecto / referencia</span>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(event) => onProjectNameChange(event.target.value)}
                      placeholder="Nombre o ubicación del proyecto"
                    />
                    <small>Podés dejar este campo vacío.</small>
                  </label>
                </div>
              )}
            </section>
          </section>

          <section className="quote-card summary-lines" aria-labelledby="summary-lines-title">
            <div className="quote-heading">
              <div>
                <p className="eyebrow">Detalle</p>
                <h2 id="summary-lines-title">Servicios incluidos</h2>
              </div>
              <span className="line-count">
                {lines.length} {lines.length === 1 ? 'servicio' : 'servicios'}
              </span>
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Servicio</th>
                    <th>Unidad</th>
                    <th className="numeric-cell">Cantidad</th>
                    <th className="numeric-cell">Precio unitario</th>
                    <th className="numeric-cell">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id}>
                      <td>
                        <strong>{line.name}</strong>
                        {line.description && <small>{line.description}</small>}
                        <small>{line.source === 'catalog' ? 'Catálogo' : 'Manual'}</small>
                      </td>
                      <td>
                        {workUnitLabels[line.unit]} ({workUnitSymbols[line.unit]})
                      </td>
                      <td className="numeric-cell">{line.quantity}</td>
                      <td className="numeric-cell">{currencyFormatter.format(line.unitPrice)}</td>
                      <td className="numeric-cell subtotal">
                        {currencyFormatter.format(
                          calculateLineSubtotal(line.quantity, line.unitPrice),
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <QuoteTotalsBreakdown
              totals={totals}
              totalLabel="Total del presupuesto"
              className="summary-total"
            />
          </section>
        </div>
      </div>
      {isConfirmationOpen && (
        <div className="modal-backdrop">
          <section
            className="confirmation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finalization-title"
            aria-describedby="finalization-description"
          >
            <h2 id="finalization-title">¿Finalizar este presupuesto?</h2>
            <p id="finalization-description">
              Se guardará con estado “Finalizado”. No se enviará al cliente y podrás descargar el
              PDF después.
            </p>
            <div className="confirmation-actions">
              <button
                ref={finalizationCancelRef}
                className="button button-line"
                type="button"
                onClick={onCancelFinalization}
                disabled={isFinalizing}
              >
                Cancelar
              </button>
              <button
                ref={finalizationConfirmRef}
                className="button button-primary"
                type="button"
                onClick={onConfirmFinalization}
                disabled={isFinalizing}
              >
                {isFinalizing ? 'Finalizando…' : 'Sí, finalizar'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
