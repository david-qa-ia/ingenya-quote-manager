import { useState } from 'react';
import type { Opportunity } from '../types/opportunity';
import {
  loadCadenceExecutions,
  loadCadenceTemplates,
  saveCadenceExecution,
} from '../utils/cadenceStorage';
import { setCadencePaused, startCadence, updateCadenceAction } from '../utils/cadenceTransitions';
import { saveOpportunity } from '../utils/opportunityStorage';
import { recordCadenceActivity } from '../utils/activityStorage';

export function CadencePanel({
  opportunity,
  onChange,
}: {
  opportunity: Opportunity;
  onChange: () => void;
}) {
  const [actor, setActor] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const templates = loadCadenceTemplates().items.filter((item) => item.status === 'active');
  const executions = loadCadenceExecutions().items;
  const execution = executions.find(
    (item) =>
      item.target.kind === 'opportunity' &&
      item.target.opportunityId === opportunity.id &&
      (item.status === 'active' || item.status === 'paused'),
  );
  function start(templateId: string) {
    try {
      if (opportunity.nextAction?.status === 'pending')
        throw new Error('Resolvé la próxima acción manual antes de iniciar una cadencia.');
      const template = templates.find((item) => item.id === templateId);
      if (!template) throw new Error('Seleccioná una plantilla activa.');
      const next = startCadence(
        template,
        { kind: 'opportunity', opportunityId: opportunity.id },
        actor,
        new Date().toISOString(),
        executions,
      );
      if (
        !saveCadenceExecution(next) ||
        !saveOpportunity({
          ...opportunity,
          nextAction: next.stepExecutions[0].nextAction,
          updatedAt: new Date().toISOString(),
        })
      )
        throw new Error('No se pudo guardar la cadencia.');
      const activitySaved = recordCadenceActivity(
        { kind: 'opportunity', opportunityId: opportunity.id },
        `${next.id}:started`,
        'Cadencia iniciada.',
      );
      setMessage(
        activitySaved
          ? 'Cadencia iniciada.'
          : 'Cadencia iniciada, pero no se pudo registrar su actividad.',
      );
      onChange();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo iniciar la cadencia.');
    }
  }
  function transition(kind: 'pause' | 'resume' | 'cancel') {
    if (!execution) return;
    try {
      const now = new Date().toISOString();
      const next =
        kind === 'cancel'
          ? updateCadenceAction(execution, 'cancelled', actor, reason, now)
          : setCadencePaused(execution, kind === 'pause', actor, reason, now);
      const action = next.stepExecutions.find(
        (item) => item.id === next.currentStepExecutionId,
      )?.nextAction;
      if (
        !saveCadenceExecution(next) ||
        (kind === 'cancel' &&
          !saveOpportunity({ ...opportunity, nextAction: action, updatedAt: now }))
      )
        throw new Error('No se pudo guardar el cambio.');
      const activitySaved = recordCadenceActivity(
        { kind: 'opportunity', opportunityId: opportunity.id },
        `${next.id}:${kind}:${now}`,
        `Cadencia ${kind === 'cancel' ? 'cancelada' : kind === 'pause' ? 'pausada' : 'reanudada'}.`,
      );
      setMessage(
        activitySaved
          ? kind === 'cancel'
            ? 'Cadencia cancelada.'
            : kind === 'pause'
              ? 'Cadencia pausada.'
              : 'Cadencia reanudada.'
          : 'El cambio se guardó, pero no se pudo registrar su actividad.',
      );
      onChange();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar la cadencia.');
    }
  }
  return (
    <section className="summary-panel" aria-label="Cadencia comercial">
      <div className="summary-panel-heading">
        <p className="eyebrow">Seguimiento</p>
        <h2>Cadencia</h2>
      </div>
      {execution ? (
        <>
          <p>
            <strong>{execution.templateSnapshot.name}</strong> ·{' '}
            {execution.status === 'active' ? 'Activa' : 'Pausada'}
          </p>
          <p className="commercial-note">
            Paso {execution.stepExecutions.length} de{' '}
            {execution.templateSnapshot.steps.filter((step) => step.status === 'active').length}:{' '}
            {execution.stepExecutions.at(-1)?.description}
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
            <button
              className="button button-line"
              type="button"
              onClick={() => transition(execution.status === 'active' ? 'pause' : 'resume')}
            >
              {execution.status === 'active' ? 'Pausar' : 'Reanudar'}
            </button>
            <button
              className="button button-link"
              type="button"
              onClick={() => transition('cancel')}
            >
              Cancelar
            </button>
          </div>
          <details>
            <summary>Historial</summary>
            <ul>
              {execution.history.map((item) => (
                <li key={item.id}>
                  {item.type} · {new Date(item.occurredAt).toLocaleString('es-AR')} · {item.reason}
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : (
        <>
          <label className="field">
            <span>Iniciar con plantilla</span>
            <select
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
