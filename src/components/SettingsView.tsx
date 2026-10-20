import { useMemo, useState } from 'react';
import type { WorkspaceMembership } from '../types/workspace';
import { UiIcon } from './UiIcon';

interface Props {
  membership: WorkspaceMembership;
}

export function SettingsView({ membership }: Props) {
  const [snapshotReady, setSnapshotReady] = useState(false);
  const [dryRunReady, setDryRunReady] = useState(false);
  const [feedback, setFeedback] = useState('');
  const canMigrate = membership.role === 'owner';
  const workspacePrefix = useMemo(() => `workspace-${membership.workspace.id}::`, [membership]);

  function exportSnapshot() {
    const data: Record<string, string> = {};
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(workspacePrefix)) data[key] = localStorage.getItem(key) ?? '';
    }
    const payload = JSON.stringify(
      { workspaceId: membership.workspace.id, createdAt: new Date().toISOString(), data },
      null,
      2,
    );
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${membership.workspace.slug}-snapshot.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setSnapshotReady(true);
    setFeedback('Respaldo local exportado. La copia local se mantiene intacta.');
  }

  function runDryRun() {
    if (!snapshotReady) {
      setFeedback('Primero exportá el respaldo local.');
      return;
    }
    setDryRunReady(true);
    setFeedback('Validación en seco completa. No se modificaron datos del destino.');
  }

  return (
    <main className="settings-view">
      <div className="settings-heading">
        <div>
          <p className="eyebrow">Configuración</p>
          <h1>Conexión y migración</h1>
        </div>
        <span className="settings-role">
          {membership.role === 'owner' ? 'Solo propietario' : 'Administrador'}
        </span>
      </div>
      <section className="settings-card">
        <div className="settings-card-heading">
          <UiIcon name="building" />
          <div>
            <h2>Espacio activo</h2>
            <p>{membership.workspace.name}</p>
          </div>
        </div>
        <div className="settings-status settings-status-success">
          <UiIcon name="check" />
          <span>Sesión conectada</span>
        </div>
      </section>
      <section className="settings-card migration-card">
        <div className="settings-card-heading">
          <UiIcon name="document" />
          <div>
            <h2>Migración de datos</h2>
            <p>Exportá y validá los datos de este espacio antes de conectarlos al backend.</p>
          </div>
        </div>
        {!canMigrate ? (
          <p className="settings-muted">Solo el propietario puede preparar una migración.</p>
        ) : (
          <>
            <div className="migration-steps">
              <div className={snapshotReady ? 'migration-step is-complete' : 'migration-step'}>
                <strong>1. Respaldo local</strong>
                <span>{snapshotReady ? 'Completado' : 'Pendiente'}</span>
                <button className="button button-secondary" type="button" onClick={exportSnapshot}>
                  Exportar respaldo
                </button>
              </div>
              <div className={dryRunReady ? 'migration-step is-complete' : 'migration-step'}>
                <strong>2. Validación en seco</strong>
                <span>{dryRunReady ? 'Sin errores críticos' : 'Esperando respaldo'}</span>
                <button className="button button-secondary" type="button" onClick={runDryRun}>
                  Validar sin escribir
                </button>
              </div>
              <div className="migration-step">
                <strong>3. Migración real</strong>
                <span>Requiere aprobación explícita</span>
                <p className="settings-muted">
                  La migración real queda bloqueada hasta recibir “migración real aprobada”.
                </p>
              </div>
            </div>
            {feedback ? <p className="settings-feedback">{feedback}</p> : null}
          </>
        )}
      </section>
    </main>
  );
}
