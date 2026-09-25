import { useState, type FormEvent } from 'react';
import './App.css';
import { initialJobCatalog } from './data/jobCatalog';
import { workUnitLabels, workUnitSymbols } from './data/workUnits';
import type { QuoteLine, WorkUnit } from './types/quote';
import { calculateLineSubtotal, calculateQuoteTotal } from './utils/quoteCalculations';

const activeCatalogJobs = initialJobCatalog.filter((job) => job.isActive);
const initialCatalogJob = activeCatalogJobs[0];
const availableWorkUnits = Object.keys(workUnitLabels) as WorkUnit[];

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

function createLineId(): string {
  return crypto.randomUUID();
}

function App() {
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([]);
  const [selectedJobId, setSelectedJobId] = useState(initialCatalogJob.id);
  const [catalogQuantity, setCatalogQuantity] = useState('1');
  const [catalogUnitPrice, setCatalogUnitPrice] = useState(String(initialCatalogJob.defaultPrice));
  const [manualName, setManualName] = useState('');
  const [manualUnit, setManualUnit] = useState<WorkUnit>('squareMeter');
  const [manualQuantity, setManualQuantity] = useState('1');
  const [manualUnitPrice, setManualUnitPrice] = useState('');
  const [catalogError, setCatalogError] = useState('');
  const [manualError, setManualError] = useState('');

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
        <div
          className="header-total"
          aria-label={`Total actual: ${currencyFormatter.format(quoteTotal)}`}
        >
          <span>Total actual</span>
          <strong>{currencyFormatter.format(quoteTotal)}</strong>
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
                </tr>
              </thead>
              <tbody>
                {quoteLines.map((line) => (
                  <tr key={line.id}>
                    <td>
                      <strong>{line.name}</strong>
                      <small>{line.source === 'catalog' ? 'Catálogo' : 'Manual'}</small>
                    </td>
                    <td>{workUnitSymbols[line.unit]}</td>
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
          >
            Continuar presupuesto <span aria-hidden="true">→</span>
          </button>
        </footer>
      </section>
    </main>
  );
}

export default App;
