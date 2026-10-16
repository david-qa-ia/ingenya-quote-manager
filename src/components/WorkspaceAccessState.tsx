import type { WorkspaceAccessError } from '../types/workspace';
import { UiIcon } from './UiIcon';

interface Props {
  error: WorkspaceAccessError;
  onRetry: () => void;
}

const copy: Record<WorkspaceAccessError, { title: string; message: string }> = {
  'no-workspaces': {
    title: 'No tenés un espacio de trabajo disponible',
    message: 'Pedí acceso a un administrador para continuar.',
  },
  denied: {
    title: 'No tenés acceso a este espacio',
    message: 'El espacio seleccionado ya no está disponible para tu usuario.',
  },
  network: {
    title: 'No pudimos conectar con el servidor',
    message: 'Tus datos no se modificaron. Revisá la conexión e intentá nuevamente.',
  },
  'session-expired': {
    title: 'Tu sesión venció',
    message: 'Volvé a iniciar sesión para recuperar tus espacios de trabajo.',
  },
};

export function WorkspaceAccessState({ error, onRetry }: Props) {
  const content = copy[error];
  return (
    <main className="workspace-access-state">
      <div className="workspace-access-card">
        <UiIcon name="building" />
        <h1>{content.title}</h1>
        <p>{content.message}</p>
        <button className="button button-primary" type="button" onClick={onRetry}>
          Volver a intentar
        </button>
      </div>
    </main>
  );
}
