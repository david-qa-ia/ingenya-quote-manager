import type { FormEvent } from 'react';
import { workUnitLabels, workUnitSymbols } from '../data/workUnits';
import type { CatalogJob, WorkUnit } from '../types/quote';
import type { ManualQuoteLineField } from '../utils/manualQuoteLineValidation';
import { currencyFormatter } from '../utils/quoteFormatting';
import { FieldError } from './FieldError';
import type { useFieldValidation } from './useFieldValidation';

const availableWorkUnits = Object.keys(workUnitLabels) as WorkUnit[];

export interface CatalogEntry {
  search: string;
  onSearchChange: (value: string) => void;
  onSearchFocus: () => void;
  isMenuOpen: boolean;
  /** Active catalog services that match the search. */
  jobs: readonly CatalogJob[];
  onSelect: (job: CatalogJob) => void;
  selectedJob?: CatalogJob;
  quantity: string;
  onQuantityChange: (value: string) => void;
  unitPrice: string;
  onUnitPriceChange: (value: string) => void;
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export interface ManualEntry {
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  unit: WorkUnit;
  onUnitChange: (value: WorkUnit) => void;
  quantity: string;
  onQuantityChange: (value: string) => void;
  unitPrice: string;
  onUnitPriceChange: (value: string) => void;
  saveToCatalog: boolean;
  onSaveToCatalogChange: (value: boolean) => void;
  validation: ReturnType<typeof useFieldValidation<ManualQuoteLineField>>;
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

interface Props {
  mode: 'catalog' | 'manual';
  onModeChange: (mode: 'catalog' | 'manual') => void;
  catalog: CatalogEntry;
  manual: ManualEntry;
}

/** "Agregar servicio" in the quote editor: from the catalog or typed by hand. */
export function ServiceEntryCard({ mode, onModeChange, catalog, manual }: Props) {
  return (
    <section className="entry-grid service-entry-grid" aria-label="Agregar servicio">
      <div className="entry-card service-entry-card">
        <div className="card-heading">
          <span className="step-number">1</span>
          <div>
            <h2>{mode === 'catalog' ? 'Agregar servicio' : 'Agregar servicio manual'}</h2>
            <p>
              {mode === 'catalog'
                ? 'Buscá un servicio del catálogo y ajustá su precio para este presupuesto.'
                : 'Completá el servicio que no está disponible en el catálogo.'}
            </p>
          </div>
          <div className="service-entry-toggle" aria-label="Modo de carga">
            <button
              className={`button button-line ${mode === 'catalog' ? 'is-selected' : ''}`}
              type="button"
              onClick={() => onModeChange('catalog')}
            >
              Catálogo
            </button>
            <button
              className={`button button-line ${mode === 'manual' ? 'is-selected' : ''}`}
              type="button"
              onClick={() => onModeChange('manual')}
            >
              Agregar manualmente
            </button>
          </div>
        </div>
        {mode === 'catalog' ? (
          <form onSubmit={catalog.onSubmit}>
            <label className="field">
              <span>Buscar servicio activo</span>
              <div className="search-select">
                <input
                  type="search"
                  value={catalog.search}
                  onFocus={catalog.onSearchFocus}
                  onChange={(event) => catalog.onSearchChange(event.target.value)}
                  placeholder="Nombre o descripción"
                  aria-expanded={catalog.isMenuOpen}
                  aria-controls="catalog-service-results"
                />
                {catalog.isMenuOpen && (
                  <div id="catalog-service-results" className="search-select-menu" role="listbox">
                    {catalog.jobs.length > 0 ? (
                      catalog.jobs.map((job) => (
                        <button
                          type="button"
                          key={job.id}
                          className="search-select-option"
                          role="option"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => catalog.onSelect(job)}
                        >
                          <strong>{job.name}</strong>
                          <span>
                            {job.description || 'Sin descripción'} · {workUnitLabels[job.unit]} ·{' '}
                            {currencyFormatter.format(job.defaultPrice)}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="search-select-empty">
                        <p>No encontramos un servicio activo con esos datos.</p>
                        <button
                          type="button"
                          className="button button-line"
                          onClick={() => onModeChange('manual')}
                        >
                          Agregar manualmente
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </label>
            <p className="commercial-note">
              Escribí para filtrar y elegí un servicio de la lista. Podés borrar y buscar otro.
            </p>

            <div className="form-grid">
              <div className="field read-only-field">
                <span>Unidad</span>
                <strong>
                  {catalog.selectedJob
                    ? `${workUnitLabels[catalog.selectedJob.unit]} (${workUnitSymbols[catalog.selectedJob.unit]})`
                    : 'Sin servicio seleccionado'}
                </strong>
              </div>
              <label className="field">
                <span>Cantidad</span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={catalog.quantity}
                  onChange={(event) => catalog.onQuantityChange(event.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>Precio unitario</span>
                <div className="money-input">
                  <span>$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={catalog.unitPrice}
                    onChange={(event) => catalog.onUnitPriceChange(event.target.value)}
                    required
                  />
                </div>
                <small>Precio sugerido, editable para este presupuesto.</small>
              </label>
            </div>

            {catalog.error && <p className="form-error">{catalog.error}</p>}
            <button
              className="button button-secondary"
              type="submit"
              disabled={!catalog.selectedJob}
              aria-describedby={catalog.selectedJob ? undefined : 'catalog-add-hint'}
            >
              Agregar servicio
            </button>
            {!catalog.selectedJob && (
              <p className="field-hint" id="catalog-add-hint">
                Elegí un servicio de la lista para agregarlo.
              </p>
            )}
          </form>
        ) : (
          <form onSubmit={manual.onSubmit} noValidate>
            <label className="field">
              <span>Nombre del servicio</span>
              <input
                type="text"
                value={manual.name}
                onChange={(event) => manual.onNameChange(event.target.value)}
                placeholder="Ej.: Reparar revoque"
                required
                {...manual.validation.fieldProps('name')}
              />
              <FieldError
                id={manual.validation.errorId('name')}
                message={manual.validation.visibleError('name')}
              />
            </label>

            <label className="field quick-description">
              <span>Descripción (opcional)</span>
              <textarea
                value={manual.description}
                onChange={(event) => manual.onDescriptionChange(event.target.value)}
                placeholder="Detalle breve del trabajo"
                rows={3}
              />
            </label>

            <div className="form-grid">
              <label className="field">
                <span>Unidad</span>
                <select
                  value={manual.unit}
                  onChange={(event) => manual.onUnitChange(event.target.value as WorkUnit)}
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
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={manual.quantity}
                  onChange={(event) => manual.onQuantityChange(event.target.value)}
                  required
                  {...manual.validation.fieldProps('quantity')}
                />
                <FieldError
                  id={manual.validation.errorId('quantity')}
                  message={manual.validation.visibleError('quantity')}
                />
              </label>
              <label className="field">
                <span>Precio unitario</span>
                <div className="money-input">
                  <span>$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={manual.unitPrice}
                    onChange={(event) => manual.onUnitPriceChange(event.target.value)}
                    placeholder="0"
                    required
                    {...manual.validation.fieldProps('unitPrice')}
                  />
                </div>
                <FieldError
                  id={manual.validation.errorId('unitPrice')}
                  message={manual.validation.visibleError('unitPrice')}
                />
              </label>
            </div>

            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={manual.saveToCatalog}
                onChange={(event) => manual.onSaveToCatalogChange(event.target.checked)}
              />
              <span>Guardar también en el catálogo para reutilizarlo</span>
            </label>

            {manual.error && (
              <p className="form-error" role="alert">
                {manual.error}
              </p>
            )}
            <button className="button button-secondary" type="submit">
              Agregar servicio
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
