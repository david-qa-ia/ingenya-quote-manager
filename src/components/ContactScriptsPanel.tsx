import { useState, type FormEvent } from 'react';
import type { ContactChannel, ContactScriptTemplate } from '../types/contactScript';
import {
  getContactScriptTokenErrors,
  getContactScriptVariables,
  loadContactScripts,
  saveContactScript,
} from '../utils/contactScriptStorage';

export function ContactScriptsPanel() {
  const [templates, setTemplates] = useState(() => loadContactScripts().items);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ContactScriptTemplate | null>(null);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<ContactChannel>('call');
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('');
  const [message, setMessage] = useState('');
  const errors = getContactScriptTokenErrors(content);
  function edit(item?: ContactScriptTemplate) {
    setEditorOpen(true);
    setEditing(item ?? null);
    setName(item?.name ?? '');
    setChannel(item?.channel ?? 'call');
    setContent(item?.content ?? '');
    setAuthor(item?.createdBy ?? '');
    setMessage('');
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !author.trim() || errors.length)
      return setMessage('Completá nombre, autor y corregí las variables.');
    const now = new Date().toISOString();
    const next: ContactScriptTemplate = {
      id: editing?.id ?? crypto.randomUUID(),
      name: name.trim(),
      channel,
      content,
      variables: getContactScriptVariables(content),
      status: editing?.status ?? 'active',
      createdBy: editing?.createdBy ?? author.trim(),
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
      version: (editing?.version ?? 0) + 1,
    };
    if (!saveContactScript(next)) return setMessage('No se pudo guardar la plantilla.');
    setTemplates(loadContactScripts().items);
    setEditorOpen(false);
    setEditing(null);
    setMessage('Plantilla guardada.');
  }
  function archive(item: ContactScriptTemplate) {
    const next = {
      ...item,
      status: 'archived' as const,
      version: item.version + 1,
      updatedAt: new Date().toISOString(),
    };
    if (!saveContactScript(next)) return setMessage('No se pudo archivar la plantilla.');
    setTemplates(loadContactScripts().items);
    setMessage('Plantilla archivada. Los snapshots históricos se conservan.');
  }
  return (
    <section className="summary-panel" aria-label="Plantillas de contacto">
      <h2>Plantillas de contacto</h2>
      <button className="button button-line" type="button" onClick={() => edit()}>
        Nueva plantilla
      </button>
      <ul className="activity-list">
        {templates.map((item) => (
          <li key={item.id}>
            <strong>{item.name}</strong>
            <small>
              {item.channel === 'call' ? 'Llamada' : 'WhatsApp'} · v{item.version} ·{' '}
              {item.status === 'active' ? 'Activa' : 'Archivada'}
            </small>
            <div className="commercial-actions">
              <button className="button button-line" type="button" onClick={() => edit(item)}>
                Editar
              </button>
              {item.status === 'active' && (
                <button className="button button-link" type="button" onClick={() => archive(item)}>
                  Archivar
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {editorOpen && (
        <form className="commercial-form" onSubmit={submit}>
          <label className="field">
            <span>Nombre</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>Canal</span>
            <select value={channel} onChange={(e) => setChannel(e.target.value as ContactChannel)}>
              <option value="call">Llamada</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </label>
          <label className="field">
            <span>Contenido</span>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} />
          </label>
          <label className="field">
            <span>Autor local</span>
            <input value={author} onChange={(e) => setAuthor(e.target.value)} />
          </label>
          {errors.length > 0 && (
            <p className="commercial-warning" role="alert">
              {errors.join(' ')}
            </p>
          )}
          <button className="button button-primary" type="submit">
            Guardar plantilla
          </button>
        </form>
      )}
      {message && (
        <p className="commercial-note" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
