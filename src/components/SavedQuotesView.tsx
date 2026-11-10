import type { Opportunity } from '../types/opportunity';
import type { SavedQuote } from '../types/quote';
import { calculateQuoteTotal } from '../utils/quoteCalculations';
import { commercialStatusLabels } from '../utils/quoteCommercialStatus';
import { currencyFormatter } from '../utils/quoteFormatting';
import type { SavedQuoteCommercialFilter, SavedQuoteFilter } from '../utils/savedQuoteFilters';

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  hourCycle: 'h23',
  timeZone: 'America/Argentina/Buenos_Aires',
});

interface Props {
  /** Every saved quote, to know whether "Ver todos" can show something. */
  quotes: readonly SavedQuote[];
  /** The quotes that match both filters. */
  visibleQuotes: readonly SavedQuote[];
  opportunities: readonly Opportunity[];
  documentFilter: SavedQuoteFilter;
  onDocumentFilterChange: (filter: SavedQuoteFilter) => void;
  commercialFilter: SavedQuoteCommercialFilter;
  onCommercialFilterChange: (filter: SavedQuoteCommercialFilter) => void;
  /** True when quotes are kept in the workspace (Supabase) rather than only in this browser. */
  storedInWorkspace: boolean;
  downloadingQuoteId: string | null;
  pdfFeedback: { quoteId: string; type: 'success' | 'error'; message: string } | null;
  onOpen: (quote: SavedQuote) => void;
  onDownloadPdf: (quote: SavedQuote) => void;
  onNewQuote: () => void;
  onBackToCurrent: () => void;
}

/** "Presupuestos guardados": drafts and finalized quotes, including quick quotes without a client. */
export function SavedQuotesView({
  quotes,
  visibleQuotes,
  opportunities,
  documentFilter,
  onDocumentFilterChange,
  commercialFilter,
  onCommercialFilterChange,
  storedInWorkspace,
  downloadingQuoteId,
  pdfFeedback,
  onOpen,
  onDownloadPdf,
  onNewQuote,
  onBackToCurrent,
}: Props) {
  return (
    <main className="app-shell saved-quotes-shell">
      <header className="saved-quotes-header">
        <div>
          <p className="eyebrow">Ventro · Presupuestos</p>
          <h1>Mis presupuestos</h1>
          <p className="page-description">
            Continuá un borrador o consultá un presupuesto finalizado.
          </p>
        </div>
      </header>

      <section className="quote-card" aria-labelledby="saved-quotes-title">
        <div className="quote-heading">
          <div>
            <p className="eyebrow">
              {storedInWorkspace
                ? 'Guardados en el espacio de trabajo'
                : 'Guardados en este navegador'}
            </p>
            <h2 id="saved-quotes-title">Tus presupuestos</h2>
          </div>
          <span className="line-count">
            {visibleQuotes.length} {visibleQuotes.length === 1 ? 'presupuesto' : 'presupuestos'}
          </span>
        </div>

        <div
          className="saved-quote-filters saved-quote-lifecycle-filters"
          aria-label="Filtrar presupuestos por estado"
        >
          <span className="saved-quote-filter-label">Documento</span>
          {(
            [
              ['all', 'Todos'],
              ['draft', 'Borradores'],
              ['finalized', 'Finalizados'],
            ] as const
          ).map(([filter, label]) => (
            <button
              key={filter}
              className={`saved-quote-filter ${documentFilter === filter ? 'saved-quote-filter-active' : ''}`}
              type="button"
              aria-pressed={documentFilter === filter}
              onClick={() => onDocumentFilterChange(filter)}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          className="saved-quote-filters saved-quote-commercial-filters"
          aria-label="Filtrar presupuestos por estado comercial"
        >
          <span className="saved-quote-filter-label">Seguimiento comercial</span>
          {(
            [
              'all',
              'prepared',
              'sent',
              'followingUp',
              'accepted',
              'rejected',
              'expired',
              'paused',
            ] as const
          ).map((filter) => (
            <button
              key={filter}
              className={`saved-quote-filter ${commercialFilter === filter ? 'saved-quote-filter-active' : ''}`}
              type="button"
              aria-pressed={commercialFilter === filter}
              onClick={() => onCommercialFilterChange(filter)}
            >
              {filter === 'all' ? 'Comerciales: todos' : commercialStatusLabels[filter]}
            </button>
          ))}
        </div>

        {visibleQuotes.length === 0 ? (
          <div className="empty-state saved-quotes-empty-state">
            <span aria-hidden="true">⌁</span>
            <h3>No hay presupuestos en este estado</h3>
            <p>
              {documentFilter === 'all'
                ? 'Creá un presupuesto nuevo para comenzar.'
                : 'Podés volver a ver todos los presupuestos o crear uno nuevo.'}
            </p>
            <div className="empty-state-actions">
              {documentFilter !== 'all' && quotes.length > 0 && (
                <button
                  className="button button-line"
                  type="button"
                  onClick={() => onDocumentFilterChange('all')}
                >
                  Ver todos
                </button>
              )}
              <button className="button button-secondary" type="button" onClick={onNewQuote}>
                Nuevo presupuesto
              </button>
            </div>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="saved-quotes-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Cliente</th>
                  <th>Proyecto en seguimiento</th>
                  <th>Estado</th>
                  <th>Estado comercial</th>
                  <th>Fecha</th>
                  <th className="numeric-cell">Total</th>
                  <th className="actions-cell">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleQuotes.map((savedQuote) => (
                  <tr key={savedQuote.id}>
                    <td data-label="ID">
                      <strong>{savedQuote.id}</strong>
                    </td>
                    <td data-label="Cliente">{savedQuote.clientName.trim() || 'Sin cliente'}</td>
                    <td data-label="Proyecto en seguimiento">
                      {savedQuote.projectName.trim() || 'Sin proyecto'}
                      {savedQuote.opportunityId && (
                        <small>
                          Proyecto:{' '}
                          {opportunities.find(
                            (item) =>
                              item.id === savedQuote.opportunityId &&
                              item.clientId === savedQuote.clientId,
                          )?.name ?? 'Asociación no disponible'}
                        </small>
                      )}
                    </td>
                    <td data-label="Estado">
                      <span className={`status-badge status-badge-${savedQuote.status}`}>
                        {savedQuote.status === 'draft' ? 'Borrador' : 'Finalizado'}
                      </span>
                    </td>
                    <td data-label="Estado comercial">
                      <span
                        className={`status-badge commercial-status-badge status-badge-${savedQuote.commercialStatus}`}
                      >
                        {commercialStatusLabels[savedQuote.commercialStatus]}
                      </span>
                    </td>
                    <td data-label="Fecha">{dateFormatter.format(new Date(savedQuote.savedAt))}</td>
                    <td data-label="Total" className="numeric-cell subtotal">
                      {currencyFormatter.format(
                        calculateQuoteTotal(savedQuote.lines, savedQuote.discount),
                      )}
                    </td>
                    <td data-label="Acciones" className="actions-cell saved-quote-actions-cell">
                      <div className="saved-quote-actions">
                        <button
                          className="button button-line"
                          type="button"
                          onClick={() => onOpen(savedQuote)}
                        >
                          {savedQuote.status === 'draft' ? 'Continuar editando' : 'Ver presupuesto'}
                        </button>
                        {savedQuote.status === 'finalized' && (
                          <button
                            className="button button-line"
                            type="button"
                            onClick={() => onDownloadPdf(savedQuote)}
                            disabled={downloadingQuoteId !== null}
                          >
                            {downloadingQuoteId === savedQuote.id ? 'Generando…' : 'PDF'}
                          </button>
                        )}
                      </div>
                      {pdfFeedback?.quoteId === savedQuote.id && (
                        <p
                          className={`saved-quote-pdf-feedback save-feedback-${pdfFeedback.type}`}
                          role={pdfFeedback.type === 'error' ? 'alert' : 'status'}
                        >
                          {pdfFeedback.message}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <button
        className="button button-link back-to-current"
        type="button"
        onClick={onBackToCurrent}
      >
        <span aria-hidden="true">←</span> Volver al presupuesto actual
      </button>
    </main>
  );
}
