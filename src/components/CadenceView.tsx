import { useState, type FormEvent } from 'react';
import type { CadenceTemplate } from '../types/cadence';
import {
  loadCadenceExecutions,
  loadCadenceTemplates,
  removeCadenceTemplate,
  saveCadenceTemplate,
} from '../utils/cadenceStorage';

const channels = [
  ['call', 'Llamada'],
  ['whatsapp', 'WhatsApp'],
  ['email', 'Email'],
  ['meeting', 'Reunión'],
  ['waitForResponse', 'Esperar respuesta'],
  ['other', 'Otra'],
] as const;
export function CadenceView({ onBack }: { onBack: () => void }) {
  const [templates, setTemplates] = useState(() => loadCadenceTemplates().items);
  const [editing, setEditing] = useState<CadenceTemplate | null>(null);
  const [message, setMessage] = useState('');
  function refresh() {
    setTemplates(loadCadenceTemplates().items);
    setEditing(null);
  }
  function save(template: CadenceTemplate) {
    if (!saveCadenceTemplate(template)) {
      setMessage('No se pudo guardar la plantilla.');
      return;
    }
    setMessage('Plantilla guardada.');
    refresh();
  }
  return (
    <main className="app-shell">
      <header className="saved-quotes-header">
        <p className="eyebrow">Seguimiento comercial</p>
        <h1>Cadencias</h1>
        <p className="page-description">
          Organizá pasos de seguimiento. No se envían mensajes automáticamente.
        </p>
      </header>
      <div className="commercial-actions">
        <button className="button button-line" type="button" onClick={onBack}>
          Volver
        </button>
        <button
          className="button button-primary"
          type="button"
          onClick={() => setEditing(createTemplate())}
        >
          Crear cadencia
        </button>
      </div>
      {message && (
        <p className="commercial-note" role="status">
          {message}
        </p>
      )}
      {editing && (
        <CadenceForm template={editing} onSave={save} onCancel={() => setEditing(null)} />
      )}
      <section className="quote-card inbox-section">
        <h2>Plantillas reutilizables</h2>
        {templates.length === 0 ? (
          <p className="commercial-note">Todavía no hay plantillas.</p>
        ) : (
          <ul className="activity-list">
            {templates.map((template) => (
              <li key={template.id}>
                <strong>{template.name}</strong>
                <span>
                  {template.steps.length} pasos ·{' '}
                  {template.status === 'active' ? 'Activa' : 'Pausada'}
                </span>
                <small>{template.description || 'Sin descripción'}</small>
                <div className="commercial-actions">
                  <button
                    className="button button-line"
                    type="button"
                    onClick={() => setEditing(template)}
                  >
                    Editar
                  </button>
                  <button
                    className="button button-line"
                    type="button"
                    onClick={() =>
                      save({
                        ...structuredClone(template),
                        id: crypto.randomUUID(),
                        name: `${template.name} (copia)`,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                      })
                    }
                  >
                    Duplicar
                  </button>
                  <button
                    className="button button-line"
                    type="button"
                    onClick={() =>
                      save({
                        ...template,
                        status: template.status === 'active' ? 'paused' : 'active',
                        updatedAt: new Date().toISOString(),
                      })
                    }
                  >
                    {template.status === 'active' ? 'Pausar' : 'Activar'}
                  </button>
                  <button
                    className="button button-link"
                    type="button"
                    disabled={loadCadenceExecutions().items.some(
                      (item) => item.templateId === template.id,
                    )}
                    onClick={() => {
                      if (removeCadenceTemplate(template.id)) {
                        setMessage('Plantilla eliminada.');
                        refresh();
                      }
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
function createTemplate(): CadenceTemplate {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: '',
    description: '',
    status: 'active',
    steps: [
      {
        id: crypto.randomUUID(),
        order: 1,
        channel: 'call',
        description: '',
        waitAmount: 1,
        waitUnit: 'days',
        responsible: '',
        status: 'active',
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}
function CadenceForm({
  template,
  onSave,
  onCancel,
}: {
  template: CadenceTemplate;
  onSave: (template: CadenceTemplate) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(template));
  const [error, setError] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    if (
      !draft.name.trim() ||
      draft.steps.some((step) => !step.description.trim() || !step.responsible.trim())
    ) {
      setError('Completá nombre, descripción y responsable de cada paso.');
      return;
    }
    onSave({
      ...draft,
      name: draft.name.trim(),
      description: draft.description.trim(),
      updatedAt: new Date().toISOString(),
    });
  }
  return (
    <form className="quote-card commercial-form" onSubmit={submit}>
      <h2>{template.name ? 'Editar cadencia' : 'Nueva cadencia'}</h2>
      <label className="field">
        <span>Nombre</span>
        <input
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
      </label>
      <label className="field">
        <span>Descripción</span>
        <textarea
          value={draft.description}
          onChange={(event) => setDraft({ ...draft, description: event.target.value })}
        />
      </label>
      <h3>Pasos</h3>
      {draft.steps.map((step, index) => (
        <div className="commercial-form" key={step.id}>
          <strong>Paso {index + 1}</strong>
          <label className="field">
            <span>Canal</span>
            <select
              value={step.channel}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  steps: draft.steps.map((item) =>
                    item.id === step.id
                      ? { ...item, channel: event.target.value as typeof step.channel }
                      : item,
                  ),
                })
              }
            >
              {channels.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Descripción</span>
            <input
              value={step.description}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  steps: draft.steps.map((item) =>
                    item.id === step.id ? { ...item, description: event.target.value } : item,
                  ),
                })
              }
            />
          </label>
          <label className="field">
            <span>Espera</span>
            <input
              type="number"
              min="1"
              max="3650"
              value={step.waitAmount}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  steps: draft.steps.map((item) =>
                    item.id === step.id
                      ? { ...item, waitAmount: Number(event.target.value) }
                      : item,
                  ),
                })
              }
            />
          </label>
          <label className="field">
            <span>Unidad</span>
            <select
              value={step.waitUnit}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  steps: draft.steps.map((item) =>
                    item.id === step.id
                      ? { ...item, waitUnit: event.target.value as typeof step.waitUnit }
                      : item,
                  ),
                })
              }
            >
              <option value="hours">Horas</option>
              <option value="days">Días</option>
            </select>
          </label>
          <label className="field">
            <span>Responsable</span>
            <input
              value={step.responsible}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  steps: draft.steps.map((item) =>
                    item.id === step.id ? { ...item, responsible: event.target.value } : item,
                  ),
                })
              }
            />
          </label>
          <label className="field">
            <span>Estado</span>
            <select
              value={step.status}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  steps: draft.steps.map((item) =>
                    item.id === step.id
                      ? { ...item, status: event.target.value as typeof step.status }
                      : item,
                  ),
                })
              }
            >
              <option value="active">Activo</option>
              <option value="paused">Pausado</option>
            </select>
          </label>
          <button
            className="button button-link"
            type="button"
            disabled={draft.steps.length === 1}
            onClick={() =>
              setDraft({
                ...draft,
                steps: draft.steps
                  .filter((item) => item.id !== step.id)
                  .map((item, position) => ({ ...item, order: position + 1 })),
              })
            }
          >
            Quitar paso
          </button>
        </div>
      ))}
      <button
        className="button button-line"
        type="button"
        onClick={() =>
          setDraft({
            ...draft,
            steps: [
              ...draft.steps,
              {
                id: crypto.randomUUID(),
                order: draft.steps.length + 1,
                channel: 'call',
                description: '',
                waitAmount: 1,
                waitUnit: 'days',
                responsible: '',
                status: 'active',
              },
            ],
          })
        }
      >
        Agregar paso
      </button>
      {error && (
        <p className="commercial-warning" role="alert">
          {error}
        </p>
      )}
      <div className="confirmation-actions">
        <button className="button button-line" type="button" onClick={onCancel}>
          Cancelar
        </button>
        <button className="button button-primary" type="submit">
          Guardar
        </button>
      </div>
    </form>
  );
}
