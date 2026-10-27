import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  Activity,
  ActivityInput,
  ActivitySubject,
  ActivityType,
  CallResult,
} from '../types/activity';
import {
  appendActivityNoteRevision,
  loadActivities,
  loadActivityAuthor,
  saveActivity,
  saveActivityAuthor,
} from '../utils/activityStorage';
import {
  getTimelineActivitiesForSubjects,
  getTimelineSubjectLabel,
  type ActivityFilter,
  type TimelineSubject,
} from '../utils/activityTimeline';

const typeLabels: Record<ActivityType, string> = {
  call: 'Llamada',
  whatsapp: 'WhatsApp',
  email: 'Email',
  note: 'Nota',
  relevantChange: 'Cambio relevante',
};
const callResultLabels: Record<CallResult, string> = {
  effectiveContact: 'Contacto efectivo',
  noAnswer: 'No contesta',
  callBack: 'Volver a llamar',
  notInterested: 'No interesado',
  invalidNumber: 'Número inválido',
};
const activityTypes = Object.keys(typeLabels) as ActivityType[];

interface Props {
  entrySubject: ActivitySubject;
  subjects: readonly TimelineSubject[];
  initialFilter?: ActivityFilter;
  hideFilters?: boolean;
  noteOnly?: boolean;
  emptyMessage?: string;
  registerLabel?: string;
}

function toLocalDateTime(isoDate: string): string {
  const date = new Date(isoDate);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function ActivityTimeline({
  entrySubject,
  subjects,
  initialFilter = 'all',
  hideFilters = false,
  noteOnly = false,
  emptyMessage = 'Todavía no hay actividades para este presupuesto.',
  registerLabel = 'Registrar actividad',
}: Props) {
  const [activities, setActivities] = useState(() => loadActivities().items);
  const [filter, setFilter] = useState<ActivityFilter>(initialFilter);
  const [author, setAuthor] = useState(loadActivityAuthor);
  const [input, setInput] = useState<ActivityInput>({
    type: 'note',
    occurredAt: new Date().toISOString(),
    author: loadActivityAuthor(),
    result: '',
    note: '',
  });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedNote, setEditedNote] = useState('');
  const [feedback, setFeedback] = useState('');
  const visibleActivities = useMemo(
    () =>
      getTimelineActivitiesForSubjects(
        activities,
        subjects.map(({ subject }) => subject),
        filter,
      ),
    [activities, filter, subjects],
  );

  function refresh() {
    setActivities(loadActivities().items);
  }

  useEffect(() => {
    window.addEventListener('activitiesupdated', refresh);
    return () => window.removeEventListener('activitiesupdated', refresh);
  }, []);

  function saveAuthor() {
    if (!saveActivityAuthor(author)) {
      setFeedback('Ingresá un autor para registrar actividades.');
      return;
    }
    setInput((current) => ({ ...current, author: author.trim() }));
    setFeedback('Autor local actualizado.');
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const normalizedAuthor = input.author.trim();
    const result = noteOnly ? 'Nota registrada' : input.result.trim();
    if (!normalizedAuthor || !input.note.trim() || !input.occurredAt || !result) {
      setFeedback(
        noteOnly ? 'Completá autor, fecha y nota.' : 'Completá autor, fecha, resultado y nota.',
      );
      return;
    }
    const activity: Activity = {
      id: crypto.randomUUID(),
      type: noteOnly ? 'note' : input.type,
      occurredAt: new Date(input.occurredAt).toISOString(),
      author: normalizedAuthor,
      result,
      note: input.note.trim(),
      subject: entrySubject,
      source: 'manual',
      noteRevisions: [],
    };
    if (!saveActivity(activity)) {
      setFeedback('No se pudo guardar la actividad.');
      return;
    }
    setAuthor(normalizedAuthor);
    refresh();
    setInput({
      type: 'note',
      occurredAt: new Date().toISOString(),
      author: normalizedAuthor,
      result: '',
      note: '',
    });
    setIsFormOpen(false);
    setFeedback('Actividad registrada.');
  }

  function saveRevision(activity: Activity) {
    if (!editedNote.trim()) {
      setFeedback('La nota no puede quedar vacía.');
      return;
    }
    if (
      !appendActivityNoteRevision(activity.id, author.trim(), {
        editedAt: new Date().toISOString(),
        editedBy: author.trim(),
        note: editedNote.trim(),
      })
    ) {
      setFeedback('No se pudo guardar la edición de la nota.');
      return;
    }
    refresh();
    setEditingId(null);
    setFeedback('Nota actualizada. El historial se conserva.');
  }

  return (
    <div className="activity-timeline" aria-label="Historial de actividades">
      <details className="activity-advanced-tools">
        <summary>Preferencias de actividad</summary>
        <div className="activity-author">
          <label className="field">
            <span>Autor actual</span>
            <input value={author} onChange={(event) => setAuthor(event.target.value)} />
          </label>
          <button className="button button-line" type="button" onClick={saveAuthor}>
            Guardar autor
          </button>
        </div>
      </details>
      <button
        className={isFormOpen ? 'button button-line' : 'button button-primary'}
        type="button"
        onClick={() => setIsFormOpen((open) => !open)}
      >
        {isFormOpen ? 'Cancelar' : registerLabel}
      </button>
      {isFormOpen && (
        <form className="commercial-form" onSubmit={submit} noValidate>
          {!noteOnly && (
            <label className="field">
              <span>Tipo</span>
              <select
                value={input.type}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    type: event.target.value as ActivityType,
                    result: '',
                  }))
                }
              >
                {activityTypes.map((type) => (
                  <option key={type} value={type}>
                    {typeLabels[type]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            <span>Fecha y hora</span>
            <input
              type="datetime-local"
              value={toLocalDateTime(input.occurredAt)}
              onChange={(event) =>
                setInput((current) => ({ ...current, occurredAt: event.target.value }))
              }
            />
          </label>
          <label className="field">
            <span>Autor</span>
            <input
              value={input.author}
              onChange={(event) =>
                setInput((current) => ({ ...current, author: event.target.value }))
              }
            />
          </label>
          {!noteOnly && input.type === 'call' ? (
            <label className="field">
              <span>Resultado</span>
              <select
                value={input.result}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    result: event.target.value as CallResult,
                  }))
                }
              >
                <option value="">Seleccionar resultado</option>
                {Object.entries(callResultLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : !noteOnly ? (
            <label className="field">
              <span>Resultado</span>
              <input
                value={input.result}
                onChange={(event) =>
                  setInput((current) => ({ ...current, result: event.target.value }))
                }
              />
            </label>
          ) : null}
          <label className="field">
            <span>Nota</span>
            <textarea
              value={input.note}
              onChange={(event) =>
                setInput((current) => ({ ...current, note: event.target.value }))
              }
            />
          </label>
          <button className="button button-primary" type="submit">
            {noteOnly ? 'Guardar nota' : 'Guardar actividad'}
          </button>
        </form>
      )}
      {feedback && (
        <p className="commercial-note" role="status">
          {feedback}
        </p>
      )}
      <ol className="activity-list">
        {visibleActivities.map((activity) => (
          <li key={activity.id}>
            <strong>{typeLabels[activity.type]}</strong> ·{' '}
            {new Date(activity.occurredAt).toLocaleString('es-AR')}
            <small>
              <span className="activity-source">{getTimelineSubjectLabel(activity, subjects)}</span>{' '}
              {activity.source === 'automatic' ? 'Sistema local' : activity.author} ·{' '}
              {activity.type === 'call'
                ? callResultLabels[activity.result as CallResult]
                : activity.result}
            </small>
            {editingId === activity.id ? (
              <div className="commercial-form">
                <textarea
                  value={editedNote}
                  onChange={(event) => setEditedNote(event.target.value)}
                />
                <button
                  className="button button-line"
                  type="button"
                  onClick={() => saveRevision(activity)}
                >
                  Guardar edición
                </button>
              </div>
            ) : (
              <p>{activity.note}</p>
            )}
            {activity.source === 'manual' &&
              activity.author === author.trim() &&
              editingId !== activity.id && (
                <button
                  className="button button-link"
                  type="button"
                  onClick={() => {
                    setEditingId(activity.id);
                    setEditedNote(activity.note);
                  }}
                >
                  Editar mi nota
                </button>
              )}
            {activity.noteRevisions.length > 0 && (
              <small>
                {activity.noteRevisions.length} edición
                {activity.noteRevisions.length === 1 ? '' : 'es'} conservada
                {activity.noteRevisions.length === 1 ? '' : 's'}.
              </small>
            )}
          </li>
        ))}
      </ol>
      {visibleActivities.length === 0 && <p className="commercial-note">{emptyMessage}</p>}
      {!hideFilters && (
        <details className="activity-advanced-tools">
          <summary>Filtros avanzados</summary>
          <div className="saved-quote-filters" aria-label="Filtrar actividades">
            {(['all', ...activityTypes] as ActivityFilter[]).map((item) => (
              <button
                key={item}
                className={`saved-quote-filter ${filter === item ? 'saved-quote-filter-active' : ''}`}
                type="button"
                aria-pressed={filter === item}
                onClick={() => setFilter(item)}
              >
                {item === 'all' ? 'Todas' : typeLabels[item]}
              </button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
