import { useState } from 'react';
import type { Quote } from '../types/quote';
import {
  loadCadenceExecutions,
  loadCadenceTemplates,
  saveCadenceExecution,
} from '../utils/cadenceStorage';
import { setCadencePaused, startCadence, updateCadenceAction } from '../utils/cadenceTransitions';

export function QuoteCadencePanel({
  quote,
  onPrepareContact,
}: {
  quote: Quote;
  onPrepareContact?: (channel: 'call' | 'whatsapp') => void;
}) {
  const [actor, setActor] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [version, setVersion] = useState(0);
  const executions = loadCadenceExecutions().items;
  const execution = executions.find(
    (item) =>
      item.target.kind === 'sentQuote' &&
      item.target.quoteId === quote.id &&
      (item.status === 'active' || item.status === 'paused'),
  );
  const templates = loadCadenceTemplates().items.filter((item) => item.status === 'active');
  function refresh(message: string) {
    setMessage(message);
    setVersion((item) => item + 1);
  }
  function start(id: string) {
    try {
      const template = templates.find((item) => item.id === id);
      if (!template) throw new Error('Seleccioná una plantilla activa.');
      const next = startCadence(
        template,
        { kind: 'sentQuote', quoteId: quote.id },
        actor,
        new Date().toISOString(),
        executions,
      );
      if (!saveCadenceExecution(next)) throw new Error('No se pudo guardar la cadencia.');
      refresh('Cadencia iniciada.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo iniciar la cadencia.');
    }
  }
  function change(kind: 'pause' | 'resume' | 'cancel') {
    if (!execution) return;
    try {
      const now = new Date().toISOString();
      const next =
        kind === 'cancel'
          ? updateCadenceAction(execution, 'cancelled', actor, reason, now)
          : setCadencePaused(execution, kind === 'pause', actor, reason, now);
      if (!saveCadenceExecution(next)) throw new Error('No se pudo guardar el cambio.');
      refresh(kind === 'cancel' ? 'Cadencia cancelada.' : 'Cadencia actualizada.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar.');
    }
  }
  if (!['sent', 'followingUp'].includes(quote.commercialStatus)) return null;
  return (
    <section className="summary-panel" aria-label="Cadencia del presupuesto">
      <h2>Cadencia del presupuesto</h2>
      {execution ? (
        <>
          <p>
            {execution.templateSnapshot.name} · Paso {execution.stepExecutions.length} de{' '}
            {execution.templateSnapshot.steps.filter((step) => step.status === 'active').length}
          </p>
          <label className="field">
            <span>Registrado por</span>
            <input value={actor} onChange={(event) => setActor(event.target.value)} />
          </label>
          <label className="field">
            <span>Motivo</span>
            <input value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <div className="commercial-actions">
            {(execution.stepExecutions.at(-1)?.channel === 'call' ||
              execution.stepExecutions.at(-1)?.channel === 'whatsapp') && (
              <button
                className="button button-line"
                type="button"
                onClick={() =>
                  onPrepareContact?.(
                    execution.stepExecutions.at(-1)!.channel as 'call' | 'whatsapp',
                  )
                }
              >
                Preparar contacto
              </button>
            )}
            <button
              className="button button-line"
              type="button"
              onClick={() => change(execution.status === 'active' ? 'pause' : 'resume')}
            >
              {execution.status === 'active' ? 'Pausar' : 'Reanudar'}
            </button>
            <button className="button button-link" type="button" onClick={() => change('cancel')}>
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="field">
            <span>Iniciar con plantilla</span>
            <select
              key={version}
              defaultValue=""
              onChange={(event) => event.target.value && start(event.target.value)}
            >
              <option value="">Seleccionar plantilla</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Registrado por</span>
            <input value={actor} onChange={(event) => setActor(event.target.value)} />
          </label>
        </>
      )}
      {message && (
        <p className="commercial-note" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
