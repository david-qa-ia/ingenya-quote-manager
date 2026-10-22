import { useState } from 'react';
import type { WorkspaceMembership } from '../types/workspace';
import { isAuthConfigured, loadAuthSession } from '../utils/authService';
import {
  clearProspectImportRecovery,
  loadProspectImportRecovery,
  savePreparedProspectImport,
} from '../utils/prospectImportTransaction';
import { isWorkspaceUuid } from '../utils/workspaceStorage';
import { getSystemHealthCards, getSystemHealthOperations } from '../utils/systemHealth';
import { UiIcon, type UiIconName } from './UiIcon';

interface Props {
  membership: WorkspaceMembership;
  onRetryConnection(): void;
}

interface CardProps {
  icon: UiIconName;
  label: string;
  title: string;
  detail: string;
  tone?: 'good' | 'attention' | 'neutral';
}

function Card({ icon, label, title, detail, tone = 'neutral' }: CardProps) {
  return (
    <article className={`system-health-card system-health-${tone}`}>
      <UiIcon name={icon} />
      <div>
        <span>{label}</span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

export function SettingsView({ membership, onRetryConnection }: Props) {
  const [recovery, setRecovery] = useState(loadProspectImportRecovery);
  const [feedback, setFeedback] = useState('');
  const backendConfigured = isAuthConfigured();
  const session = loadAuthSession();
  const validWorkspace = isWorkspaceUuid(membership.workspace.id);
  const cards = getSystemHealthCards({
    workspaceName: membership.workspace.name,
    validWorkspace,
    backendConfigured,
    hasSession: Boolean(session),
    recovery,
  });
  const operations = getSystemHealthOperations(validWorkspace);

  function recover() {
    if (!recovery) return;

    if (!savePreparedProspectImport(recovery.prepared)) {
      setFeedback(
        'No se pudo completar la recuperación. El lote sigue disponible para reintentar.',
      );
      return;
    }

    clearProspectImportRecovery();
    setRecovery(null);
    setFeedback('La importación se recuperó correctamente.');
  }

  return (
    <main className="settings-view system-health-view">
      <header className="settings-heading">
        <div>
          <p className="eyebrow">Configuración</p>
          <h1>Salud del sistema</h1>
          <p>Comprobá que tu espacio de trabajo pueda guardar y recuperar información comercial.</p>
        </div>
      </header>

      <section className="system-health-grid" aria-label="Estado del sistema">
        <Card icon="building" {...cards[0]} />
        <Card icon="activity" {...cards[1]} />
        <Card icon="clock" {...cards[2]} />
        <Card icon="document" {...cards[3]} />
      </section>

      <section className="settings-card system-health-operations">
        <h2>Operaciones comerciales</h2>
        {operations.map((operation) => (
          <div className="system-health-operation" key={operation.title}>
            <UiIcon
              name={
                operation.title === 'Prospectos e importación CSV'
                  ? 'users'
                  : operation.title === 'Presupuestos y envíos'
                    ? 'document'
                    : 'activity'
              }
            />
            <div>
              <strong>{operation.title}</strong>
              <span>{operation.detail}</span>
            </div>
            <b className={operation.available ? 'system-health-badge good' : 'system-health-badge'}>
              {operation.available ? 'Disponible' : 'Próximamente'}
            </b>
          </div>
        ))}
      </section>

      <section className="settings-card system-health-attention">
        <h2>Si algo necesita atención</h2>
        {recovery?.phase === 'remoteConfirmed' ? (
          <div className="system-health-recovery">
            <div>
              <strong>Una importación necesita recuperación</strong>
              <span>El backend confirmó el lote, pero falta actualizar la vista local.</span>
            </div>
            <button className="button button-primary" type="button" onClick={recover}>
              Recuperar importación
            </button>
          </div>
        ) : (
          <p className="settings-muted">No hay recuperaciones pendientes.</p>
        )}
        <button className="button button-line" type="button" onClick={onRetryConnection}>
          <UiIcon name="activity" /> Volver a intentar conexión
        </button>
        {feedback && (
          <p className="settings-feedback" role="status">
            {feedback}
          </p>
        )}
      </section>
    </main>
  );
}
