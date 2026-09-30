import { useState, type FormEvent } from 'react';
import './App.css';
import { initialJobCatalog } from './data/jobCatalog';
import { workUnitLabels, workUnitSymbols } from './data/workUnits';
import type { QuoteDraft, QuoteLine, SavedQuote, WorkUnit } from './types/quote';
import { calculateLineSubtotal, calculateQuoteTotal } from './utils/quoteCalculations';
import { loadSavedQuotes, saveQuoteDraft } from './utils/quoteDraftStorage';
import { currencyFormatter } from './utils/quoteFormatting';
import { downloadQuotePdf } from './utils/quotePdf';
import { QuotePdfValidationError } from './utils/quotePdfModel';

const activeCatalogJobs = initialJobCatalog.filter((job) => job.isActive);
const initialCatalogJob = activeCatalogJobs[0];
const availableWorkUnits = Object.keys(workUnitLabels) as WorkUnit[];
const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function createLineId(): string {
  return crypto.randomUUID();
}

function createQuoteId(): string {
  return `PRES-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function App() {
  const [quoteId, setQuoteId] = useState(createQuoteId);
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([]);
  const [savedQuotes, setSavedQuotes] = useState(loadSavedQuotes);
  const [currentView, setCurrentView] = useState<'editor' | 'summary' | 'savedQuotes'>('editor');
  const [clientName, setClientName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [saveFeedback, setSaveFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [pdfFeedback, setPdfFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState(initialCatalogJob.id);
  const [catalogQuantity, setCatalogQuantity] = useState('1');
  const [catalogUnitPrice, setCatalogUnitPrice] = useState(String(initialCatalogJob.defaultPrice));
  const [manualName, setManualName] = useState('');
  const [manualUnit, setManualUnit] = useState<WorkUnit>('squareMeter');
  const [manualQuantity, setManualQuantity] = useState('1');
  const [manualUnitPrice, setManualUnitPrice] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [manualError, setManualError] = useState('');
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editUnitPrice, setEditUnitPrice] = useState('');
  const [editError, setEditError] = useState('');

  const selectedJob =
    activeCatalogJobs.find((job) => job.id === selectedJobId) ?? initialCatalogJob;
  const quoteTotal = calculateQuoteTotal(quoteLines);

  function handleCatalogJobChange(jobId: string) {
    const nextJob = activeCatalogJobs.find((job) => job.id === jobId);

    if (!nextJob) return;

    setSelectedJobId(nextJob.id);
    setCatalogUnitPrice(String(nextJob.defaultPrice));
    setCatalogError('');
  }

  function handleCatalogSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quantity = Number(catalogQuantity);
    const unitPrice = Number(catalogUnitPrice);

    if (quantity <= 0 || unitPrice <= 0) {
      setCatalogError('Ingresá una cantidad y un precio unitario mayores a cero.');
      return;
    }

    setQuoteLines((currentLines) => [
      ...currentLines,
      {
        id: createLineId(),
        catalogJobId: selectedJob.id,
        name: selectedJob.name,
        unit: selectedJob.unit,
        quantity,
        unitPrice,
        source: 'catalog',
      },
    ]);
    setCatalogQuantity('1');
    setCatalogUnitPrice(String(selectedJob.defaultPrice));
    setCatalogError('');
  }

  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = manualName.trim();
    const quantity = Number(manualQuantity);
    const unitPrice = Number(manualUnitPrice);

    if (!name) {
      setManualError('Ingresá el nombre del servicio.');
      return;
    }

    if (quantity <= 0 || unitPrice <= 0) {
      setManualError('Ingresá una cantidad y un precio unitario mayores a cero.');
      return;
    }

    setQuoteLines((currentLines) => [
      ...currentLines,
      {
        id: createLineId(),
        name,
        unit: manualUnit,
        quantity,
        unitPrice,
        source: 'manual',
      },
    ]);
    setManualName('');
    setManualUnit('squareMeter');
    setManualQuantity('1');
    setManualUnitPrice('');
    setManualError('');
  }

  function handleEditStart(line: QuoteLine) {
    setEditingLineId(line.id);
    setEditQuantity(String(line.quantity));
    setEditUnitPrice(String(line.unitPrice));
    setEditError('');
  }

  function handleEditCancel() {
    setEditingLineId(null);
    setEditQuantity('');
    setEditUnitPrice('');
    setEditError('');
  }

  function handleEditSave(lineId: string) {
    const quantity = Number(editQuantity);
    const unitPrice = Number(editUnitPrice);

    if (
      !Number.isFinite(quantity) ||
      !Number.isFinite(unitPrice) ||
      quantity <= 0 ||
      unitPrice <= 0
    ) {
      setEditError('Ingresá una cantidad y un precio unitario mayores a cero.');
      return;
    }

    setQuoteLines((currentLines) =>
      currentLines.map((line) =>
        line.id === lineId
          ? {
              ...line,
              quantity,
              unitPrice,
            }
          : line,
      ),
    );
    handleEditCancel();
  }

  function handleLineDelete(lineId: string) {
    setQuoteLines((currentLines) => currentLines.filter((line) => line.id !== lineId));

    if (editingLineId === lineId) {
      handleEditCancel();
    }
  }

  function resetTransientState() {
    setSaveFeedback(null);
    setPdfFeedback(null);
    setCatalogError('');
    setManualError('');
    handleEditCancel();
  }

  function handleNewQuote() {
    setQuoteId(createQuoteId());
    setQuoteLines([]);
    setClientName('');
    setProjectName('');
    resetTransientState();
    setCurrentView('editor');
  }

  function handleSavedQuoteOpen(savedQuote: SavedQuote) {
    setQuoteId(savedQuote.id);
    setQuoteLines(savedQuote.lines);
    setClientName(savedQuote.clientName);
    setProjectName(savedQuote.projectName);
    resetTransientState();
    setCurrentView('editor');
  }

  function handleDraftSave() {
    const draft: QuoteDraft = {
      id: quoteId,
      status: 'draft',
      clientName,
      projectName,
      lines: quoteLines,
    };

    if (saveQuoteDraft(draft)) {
      setSavedQuotes(loadSavedQuotes());
      setSaveFeedback({
        type: 'success',
        message: 'Borrador guardado correctamente.',
      });
      return;
    }

    setSaveFeedback({
      type: 'error',
      message: 'No se pudo guardar el borrador. Intentá nuevamente.',
    });
  }

  async function handlePdfDownload() {
    if (isDownloadingPdf) return;

    const draft: QuoteDraft = {
      id: quoteId,
      status: 'draft',
      clientName,
      projectName,
      lines: quoteLines,
    };

    setIsDownloadingPdf(true);
    setPdfFeedback(null);

    try {
      await downloadQuotePdf(draft);
      setPdfFeedback({
        type: 'success',
        message: 'El PDF se descargó correctamente.',
      });
    } catch (error) {
      setPdfFeedback({
        type: 'error',
        message:
          error instanceof QuotePdfValidationError
            ? error.message
            : 'No se pudo generar el PDF. Intentá nuevamente.',
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  if (currentView === 'savedQuotes') {
    return (
      <main className="app-shell saved-quotes-shell">
        <header className="saved-quotes-header">
          <div>
            <p className="eyebrow">Ingenya · Presupuestos</p>
            <h1>Presupuestos guardados</h1>
            <p className="page-description">
              Abrí un presupuesto anterior para continuar editándolo o empezá uno nuevo.
            </p>
          </div>
          <button className="button button-primary" type="button" onClick={handleNewQuote}>
            Nuevo presupuesto
          </button>
        </header>

        <section className="quote-card" aria-labelledby="saved-quotes-title">
          <div className="quote-heading">
            <div>
              <p className="eyebrow">Guardados localmente</p>
              <h2 id="saved-quotes-title">Tus presupuestos</h2>
            </div>
            <span className="line-count">
              {savedQuotes.length} {savedQuotes.length === 1 ? 'presupuesto' : 'presupuestos'}
            </span>
          </div>

          {savedQuotes.length === 0 ? (
            <div className="empty-state saved-quotes-empty-state">
              <span aria-hidden="true">⌁</span>
              <h3>No hay presupuestos guardados</h3>
              <p>Guardá un borrador y aparecerá en este listado.</p>
              <button className="button button-secondary" type="button" onClick={handleNewQuote}>
                Crear presupuesto
              </button>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Cliente</th>
                    <th>Obra</th>
                    <th>Estado</th>
                    <th>Fecha de guardado</th>
                    <th className="numeric-cell">Total</th>
                    <th className="actions-cell">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {savedQuotes.map((savedQuote) => (
                    <tr key={savedQuote.id}>
                      <td>
                        <strong>{savedQuote.id}</strong>
                      </td>
                      <td>{savedQuote.clientName.trim() || 'Sin cliente'}</td>
                      <td>{savedQuote.projectName.trim() || 'Sin obra'}</td>
                      <td>
                        <span className="status-badge">Borrador</span>
                      </td>
                      <td>{dateFormatter.format(new Date(savedQuote.savedAt))}</td>
                      <td className="numeric-cell subtotal">
                        {currencyFormatter.format(calculateQuoteTotal(savedQuote.lines))}
                      </td>
                      <td className="actions-cell">
                        <button
                          className="button button-line"
                          type="button"
                          onClick={() => handleSavedQuoteOpen(savedQuote)}
                        >
                          Abrir
                        </button>
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
          onClick={() => setCurrentView('editor')}
        >
          <span aria-hidden="true">←</span> Volver al presupuesto actual
        </button>
      </main>
    );
  }

  if (currentView === 'summary') {
    return (
      <main className="app-shell summary-shell">
        <header className="summary-header">
          <div>
            <p className="eyebrow">Ingenya · Presupuestos</p>
            <h1>Resumen del presupuesto</h1>
            <p className="page-description">
              Revisá los servicios, cantidades y precios antes de guardar el borrador.
            </p>
          </div>
          <div className="header-actions">
            <button
              className="button button-line"
              type="button"
              onClick={() => setCurrentView('savedQuotes')}
            >
              Presupuestos guardados
            </button>
            <div className="quote-identity" aria-label={`Presupuesto ${quoteId}, Borrador`}>
              <span>{quoteId}</span>
              <strong>Borrador</strong>
            </div>
          </div>
        </header>

        <div className="summary-layout">
          <section className="quote-card summary-lines" aria-labelledby="summary-lines-title">
            <div className="quote-heading">
              <div>
                <p className="eyebrow">Detalle</p>
                <h2 id="summary-lines-title">Servicios incluidos</h2>
              </div>
              <span className="line-count">
                {quoteLines.length} {quoteLines.length === 1 ? 'servicio' : 'servicios'}
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
                  {quoteLines.map((line) => (
                    <tr key={line.id}>
                      <td>
                        <strong>{line.name}</strong>
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

            <footer className="summary-total">
              <span>Total del presupuesto</span>
              <strong>{currencyFormatter.format(quoteTotal)}</strong>
            </footer>
          </section>

          <aside className="summary-sidebar" aria-label="Datos y acciones del presupuesto">
            <section className="summary-panel">
              <div className="summary-panel-heading">
                <p className="eyebrow">Datos opcionales</p>
                <h2>Información del trabajo</h2>
              </div>

              <label className="field">
                <span>Cliente</span>
                <input
                  type="text"
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  placeholder="Nombre del cliente"
                />
                <small>Podés dejar este campo vacío.</small>
              </label>

              <label className="field">
                <span>Obra</span>
                <input
                  type="text"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder="Nombre o ubicación de la obra"
                />
                <small>Podés dejar este campo vacío.</small>
              </label>
            </section>

            <section
              className="summary-panel summary-actions"
              aria-label="Acciones del presupuesto"
            >
              <button className="button button-primary" type="button" onClick={handleDraftSave}>
                Guardar borrador
              </button>
              {saveFeedback && (
                <p
                  className={`save-feedback save-feedback-${saveFeedback.type}`}
                  role={saveFeedback.type === 'error' ? 'alert' : 'status'}
                >
                  {saveFeedback.message}
                </p>
              )}
              <button
                className="button button-secondary pdf-download-button"
                type="button"
                onClick={handlePdfDownload}
                disabled={quoteLines.length === 0 || isDownloadingPdf}
              >
                {isDownloadingPdf ? 'Generando PDF…' : 'Descargar PDF'}
              </button>
              {pdfFeedback && (
                <p
                  className={`save-feedback save-feedback-${pdfFeedback.type}`}
                  role={pdfFeedback.type === 'error' ? 'alert' : 'status'}
                >
                  {pdfFeedback.message}
                </p>
              )}
              <button
                className="button button-link"
                type="button"
                onClick={() => setCurrentView('editor')}
              >
                <span aria-hidden="true">←</span> Volver a editar
              </button>
            </section>
          </aside>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Ingenya · Presupuestos</p>
          <h1>Mano de obra</h1>
          <p className="page-description">
            Agregá los servicios, ajustá cantidades y precios, y revisá el total antes de continuar.
          </p>
        </div>
        <div className="header-actions">
          <button
            className="button button-line"
            type="button"
            onClick={() => setCurrentView('savedQuotes')}
          >
            Presupuestos guardados
          </button>
          <button className="button button-line" type="button" onClick={handleNewQuote}>
            Nuevo presupuesto
          </button>
          <div
            className="header-total"
            aria-label={`Total actual: ${currencyFormatter.format(quoteTotal)}`}
          >
            <span>Total actual</span>
            <strong>{currencyFormatter.format(quoteTotal)}</strong>
          </div>
        </div>
      </header>

      <section className="entry-grid" aria-label="Agregar mano de obra">
        <form className="entry-card" onSubmit={handleCatalogSubmit}>
          <div className="card-heading">
            <span className="step-number">1</span>
            <div>
              <h2>Elegir del catálogo</h2>
              <p>Usá un servicio existente y ajustá su precio para este presupuesto.</p>
            </div>
          </div>

          <label className="field">
            <span>Servicio</span>
            <select
              value={selectedJobId}
              onChange={(event) => handleCatalogJobChange(event.target.value)}
            >
              {activeCatalogJobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.name}
                </option>
              ))}
            </select>
          </label>

          <div className="form-grid">
            <div className="field read-only-field">
              <span>Unidad</span>
              <strong>
                {workUnitLabels[selectedJob.unit]} ({workUnitSymbols[selectedJob.unit]})
              </strong>
            </div>
            <label className="field">
              <span>Cantidad</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={catalogQuantity}
                onChange={(event) => setCatalogQuantity(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Precio unitario</span>
              <div className="money-input">
                <span>$</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={catalogUnitPrice}
                  onChange={(event) => setCatalogUnitPrice(event.target.value)}
                  required
                />
              </div>
              <small>Precio sugerido, editable para este presupuesto.</small>
            </label>
          </div>

          {catalogError && <p className="form-error">{catalogError}</p>}
          <button className="button button-secondary" type="submit">
            Agregar servicio
          </button>
        </form>

        <form className="entry-card" onSubmit={handleManualSubmit}>
          <div className="card-heading">
            <span className="step-number">2</span>
            <div>
              <h2>Agregar servicio manual</h2>
              <p>Creá una línea cuando el servicio no esté disponible en el catálogo.</p>
            </div>
          </div>

          <label className="field">
            <span>Nombre del servicio</span>
            <input
              type="text"
              value={manualName}
              onChange={(event) => setManualName(event.target.value)}
              placeholder="Ej.: Reparar revoque"
              required
            />
          </label>

          <div className="form-grid">
            <label className="field">
              <span>Unidad</span>
              <select
                value={manualUnit}
                onChange={(event) => setManualUnit(event.target.value as WorkUnit)}
              >
                {availableWorkUnits.map((unit) => (
                  <option key={unit} value={unit}>
                    {workUnitLabels[unit]} ({workUnitSymbols[unit]})
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Cantidad</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={manualQuantity}
                onChange={(event) => setManualQuantity(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Precio unitario</span>
              <div className="money-input">
                <span>$</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={manualUnitPrice}
                  onChange={(event) => setManualUnitPrice(event.target.value)}
                  placeholder="0"
                  required
                />
              </div>
            </label>
          </div>

          {manualError && <p className="form-error">{manualError}</p>}
          <button className="button button-secondary" type="submit">
            Agregar servicio manual
          </button>
        </form>
      </section>

      <section className="quote-card" aria-labelledby="quote-lines-title">
        <div className="quote-heading">
          <div>
            <p className="eyebrow">Detalle</p>
            <h2 id="quote-lines-title">Servicios del presupuesto</h2>
          </div>
          <span className="line-count">
            {quoteLines.length} {quoteLines.length === 1 ? 'servicio' : 'servicios'}
          </span>
        </div>

        {quoteLines.length === 0 ? (
          <div className="empty-state">
            <span aria-hidden="true">＋</span>
            <h3>Todavía no agregaste servicios</h3>
            <p>Elegí uno del catálogo o cargalo manualmente para empezar el presupuesto.</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Servicio</th>
                  <th>Unidad</th>
                  <th className="numeric-cell">Cantidad</th>
                  <th className="numeric-cell">Precio unitario</th>
                  <th className="numeric-cell">Subtotal</th>
                  <th className="actions-cell">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {quoteLines.map((line) => {
                  const isEditing = editingLineId === line.id;

                  return (
                    <tr key={line.id}>
                      <td>
                        <strong>{line.name}</strong>
                        <small>{line.source === 'catalog' ? 'Catálogo' : 'Manual'}</small>
                      </td>
                      <td>{workUnitSymbols[line.unit]}</td>
                      <td className="numeric-cell">
                        {isEditing ? (
                          <input
                            className="line-edit-input"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={editQuantity}
                            onChange={(event) => setEditQuantity(event.target.value)}
                            aria-label={`Cantidad de ${line.name}`}
                          />
                        ) : (
                          line.quantity
                        )}
                      </td>
                      <td className="numeric-cell">
                        {isEditing ? (
                          <input
                            className="line-edit-input line-edit-price"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={editUnitPrice}
                            onChange={(event) => setEditUnitPrice(event.target.value)}
                            aria-label={`Precio unitario de ${line.name}`}
                          />
                        ) : (
                          currencyFormatter.format(line.unitPrice)
                        )}
                      </td>
                      <td className="numeric-cell subtotal">
                        {currencyFormatter.format(
                          calculateLineSubtotal(line.quantity, line.unitPrice),
                        )}
                      </td>
                      <td className="actions-cell">
                        {isEditing ? (
                          <>
                            <div className="line-actions">
                              <button
                                className="button button-line button-save"
                                type="button"
                                onClick={() => handleEditSave(line.id)}
                              >
                                Guardar
                              </button>
                              <button
                                className="button button-line"
                                type="button"
                                onClick={handleEditCancel}
                              >
                                Cancelar
                              </button>
                            </div>
                            {editError && (
                              <small className="line-edit-error" role="alert">
                                {editError}
                              </small>
                            )}
                          </>
                        ) : (
                          <div className="line-actions">
                            <button
                              className="button button-line"
                              type="button"
                              onClick={() => handleEditStart(line)}
                            >
                              Editar
                            </button>
                            <button
                              className="button button-line button-delete"
                              type="button"
                              onClick={() => handleLineDelete(line.id)}
                            >
                              Eliminar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="quote-footer">
          <div className="grand-total">
            <span>Total del presupuesto</span>
            <strong>{currencyFormatter.format(quoteTotal)}</strong>
          </div>
          <button
            className="button button-primary"
            type="button"
            disabled={quoteLines.length === 0}
            onClick={() => setCurrentView('summary')}
          >
            Continuar presupuesto <span aria-hidden="true">→</span>
          </button>
        </footer>
      </section>
    </main>
  );
}

export default App;
