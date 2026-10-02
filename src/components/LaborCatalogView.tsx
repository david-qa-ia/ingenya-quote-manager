import { useState, type FormEvent } from 'react';
import { workUnitLabels, workUnitSymbols } from '../data/workUnits';
import type { CatalogJob, WorkUnit } from '../types/quote';
import { filterCatalogJobs, type CatalogJobFilter } from '../utils/jobCatalogFilters';
import type { LaborCatalogLoadIssue } from '../utils/jobCatalogStorage';
import { validateCatalogJobInput } from '../utils/jobCatalogValidation';
import { currencyFormatter } from '../utils/quoteFormatting';

interface LaborCatalogViewProps {
  jobs: readonly CatalogJob[];
  loadIssue: LaborCatalogLoadIssue | null;
  onBack: () => void;
  onCreate: (job: Omit<CatalogJob, 'id' | 'isActive'>) => string | null;
  onUpdate: (job: CatalogJob) => string | null;
  onSetActive: (job: CatalogJob, isActive: boolean) => string | null;
}

const availableWorkUnits = Object.keys(workUnitLabels) as WorkUnit[];

export function LaborCatalogView({
  jobs,
  loadIssue,
  onBack,
  onCreate,
  onUpdate,
  onSetActive,
}: LaborCatalogViewProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CatalogJobFilter>('all');
  const [editingJob, setEditingJob] = useState<CatalogJob | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState<WorkUnit>('squareMeter');
  const [price, setPrice] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [jobToDeactivate, setJobToDeactivate] = useState<CatalogJob | null>(null);
  const visibleJobs = filterCatalogJobs(jobs, search, filter);

  function resetForm() {
    setEditingJob(null);
    setName('');
    setDescription('');
    setUnit('squareMeter');
    setPrice('');
  }

  function startEditing(job: CatalogJob) {
    setEditingJob(job);
    setName(job.name);
    setDescription(job.description ?? '');
    setUnit(job.unit);
    setPrice(String(job.defaultPrice));
    setFeedback(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateCatalogJobInput({
      name,
      description,
      unit,
      defaultPrice: Number(price),
    });

    if (!validation.success || price.trim() === '') {
      setFeedback({
        type: 'error',
        message: validation.success
          ? 'Ingresá un precio sugerido válido y mayor que cero.'
          : validation.message,
      });
      return;
    }

    const error = editingJob
      ? onUpdate({ ...editingJob, ...validation.value })
      : onCreate(validation.value);
    if (error) {
      setFeedback({ type: 'error', message: error });
      return;
    }

    setFeedback({
      type: 'success',
      message: editingJob
        ? 'Servicio actualizado correctamente.'
        : 'Servicio creado correctamente.',
    });
    resetForm();
  }

  function handleActivation(job: CatalogJob, isActive: boolean) {
    const error = onSetActive(job, isActive);
    if (error) {
      setFeedback({ type: 'error', message: error });
      return;
    }
    setFeedback({
      type: 'success',
      message: isActive
        ? 'Servicio reactivado correctamente.'
        : 'Servicio desactivado correctamente.',
    });
    setJobToDeactivate(null);
  }

  const loadIssueMessage =
    loadIssue === 'invalid-root'
      ? 'No se pudo leer el catálogo guardado. Se muestra una copia segura inicial y se preservó el contenido original para diagnóstico.'
      : loadIssue === 'invalid-entries'
        ? 'Algunos servicios guardados eran inválidos y fueron omitidos. Los servicios válidos se conservaron.'
        : loadIssue
          ? 'No se pudo inicializar el almacenamiento del catálogo. Revisá la disponibilidad del navegador.'
          : null;

  return (
    <main className="app-shell catalog-shell">
      <header className="saved-quotes-header">
        <div>
          <p className="eyebrow">Ingenya · Catálogo</p>
          <h1>Mano de obra</h1>
          <p className="page-description">
            Administrá los servicios reutilizables para tus presupuestos.
          </p>
        </div>
        <button className="button button-line" type="button" onClick={onBack}>
          Volver al presupuesto
        </button>
      </header>

      {loadIssueMessage && (
        <p className="catalog-warning" role="alert">
          {loadIssueMessage}
        </p>
      )}

      <div className="catalog-layout">
        <form className="entry-card catalog-form" onSubmit={handleSubmit}>
          <div className="card-heading">
            <div>
              <p className="eyebrow">{editingJob ? 'Edición' : 'Nuevo servicio'}</p>
              <h2>{editingJob ? 'Editar servicio' : 'Crear servicio'}</h2>
            </div>
          </div>
          <label className="field">
            <span>Nombre</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label className="field">
            <span>Descripción (opcional)</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </label>
          <label className="field">
            <span>Unidad</span>
            <select value={unit} onChange={(event) => setUnit(event.target.value as WorkUnit)}>
              {availableWorkUnits.map((value) => (
                <option key={value} value={value}>
                  {workUnitLabels[value]} ({workUnitSymbols[value]})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Precio unitario sugerido</span>
            <div className="money-input">
              <span>$</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                required
              />
            </div>
          </label>
          {feedback && (
            <p
              className={`save-feedback save-feedback-${feedback.type}`}
              role={feedback.type === 'error' ? 'alert' : 'status'}
            >
              {feedback.message}
            </p>
          )}
          <div className="catalog-form-actions">
            <button className="button button-primary" type="submit">
              {editingJob ? 'Guardar cambios' : 'Crear servicio'}
            </button>
            {editingJob && (
              <button className="button button-line" type="button" onClick={resetForm}>
                Cancelar
              </button>
            )}
          </div>
        </form>

        <section className="quote-card catalog-list" aria-labelledby="catalog-title">
          <div className="quote-heading">
            <div>
              <p className="eyebrow">Servicios guardados</p>
              <h2 id="catalog-title">Catálogo</h2>
            </div>
            <span className="line-count">{visibleJobs.length} servicios</span>
          </div>
          <div className="catalog-tools">
            <label className="field catalog-search">
              <span>Buscar</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nombre o descripción"
              />
            </label>
            <div className="saved-quote-filters" aria-label="Filtrar servicios por estado">
              {(
                [
                  ['all', 'Todos'],
                  ['active', 'Activos'],
                  ['inactive', 'Inactivos'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  className={`saved-quote-filter ${filter === value ? 'saved-quote-filter-active' : ''}`}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {visibleJobs.length === 0 ? (
            <div className="empty-state">
              <h3>No se encontraron servicios</h3>
              <p>Probá otra búsqueda o filtro.</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="catalog-table">
                <thead>
                  <tr>
                    <th>Servicio</th>
                    <th>Unidad</th>
                    <th className="numeric-cell">Precio sugerido</th>
                    <th>Estado</th>
                    <th className="actions-cell">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleJobs.map((job) => (
                    <tr key={job.id}>
                      <td data-label="Servicio">
                        <strong>{job.name}</strong>
                        {job.description && <small>{job.description}</small>}
                      </td>
                      <td data-label="Unidad">
                        {workUnitLabels[job.unit]} ({workUnitSymbols[job.unit]})
                      </td>
                      <td data-label="Precio" className="numeric-cell">
                        {currencyFormatter.format(job.defaultPrice)}
                      </td>
                      <td data-label="Estado">
                        <span
                          className={`status-badge ${job.isActive ? '' : 'status-badge-inactive'}`}
                        >
                          {job.isActive ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td data-label="Acciones" className="actions-cell">
                        <div className="line-actions">
                          <button
                            className="button button-line"
                            type="button"
                            onClick={() => startEditing(job)}
                          >
                            Editar
                          </button>
                          {job.isActive ? (
                            <button
                              className="button button-line button-delete"
                              type="button"
                              onClick={() => setJobToDeactivate(job)}
                            >
                              Desactivar
                            </button>
                          ) : (
                            <button
                              className="button button-line"
                              type="button"
                              onClick={() => handleActivation(job, true)}
                            >
                              Reactivar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {jobToDeactivate && (
        <div className="modal-backdrop">
          <section
            className="confirmation-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deactivate-title"
          >
            <h2 id="deactivate-title">¿Desactivar “{jobToDeactivate.name}”?</h2>
            <p>
              Dejará de ofrecerse en presupuestos nuevos. Los presupuestos anteriores no serán
              modificados.
            </p>
            <div className="confirmation-actions">
              <button
                className="button button-line"
                type="button"
                onClick={() => setJobToDeactivate(null)}
              >
                Cancelar
              </button>
              <button
                className="button button-primary"
                type="button"
                onClick={() => handleActivation(jobToDeactivate, false)}
              >
                Sí, desactivar
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
