import type { ProspectImportRecovery } from './prospectImportTransaction';

export interface SystemHealthCardState {
  label: string;
  title: string;
  detail: string;
  tone: 'good' | 'attention' | 'neutral';
}

export type SystemHealthOperationIcon = 'users' | 'document' | 'activity';

export interface SystemHealthOperation {
  icon: SystemHealthOperationIcon;
  title: string;
  detail: string;
  available: boolean;
}

interface SystemHealthInput {
  workspaceName: string;
  validWorkspace: boolean;
  backendConfigured: boolean;
  hasSession: boolean;
  recovery: ProspectImportRecovery | null;
}

export function getSystemHealthCards(input: SystemHealthInput): SystemHealthCardState[] {
  return [
    {
      label: 'Espacio activo',
      title: input.workspaceName,
      detail: input.validWorkspace
        ? 'Acceso confirmado · datos aislados'
        : 'No se pudo verificar el espacio.',
      tone: input.validWorkspace ? 'good' : 'attention',
    },
    {
      label: 'Backend',
      title: input.backendConfigured
        ? input.hasSession
          ? 'Sesión vigente'
          : 'Sesión pendiente'
        : 'Modo local',
      detail: input.backendConfigured
        ? input.hasSession
          ? 'El backend está configurado para este espacio.'
          : 'Volvé a iniciar sesión para conectarte.'
        : 'No se pudo verificar un backend remoto.',
      tone: input.backendConfigured && input.hasSession ? 'good' : 'attention',
    },
    {
      label: 'Última sincronización',
      title: 'No se pudo verificar',
      detail: 'Se confirmará después de una operación remota.',
      tone: 'neutral',
    },
    {
      label: 'Importaciones',
      title: input.recovery ? 'Necesita recuperación' : 'Sin recuperaciones',
      detail: input.recovery ? 'Hay un lote pendiente de revisar.' : 'No hay lotes pendientes.',
      tone: input.recovery ? 'attention' : 'good',
    },
  ];
}

export function getSystemHealthOperations(validWorkspace: boolean): SystemHealthOperation[] {
  const unavailableDetail = 'El espacio necesita atención.';
  return [
    {
      icon: 'users',
      title: 'Prospectos e importación CSV',
      detail: validWorkspace ? 'Podés importar y agendar primeros contactos.' : unavailableDetail,
      available: validWorkspace,
    },
    {
      icon: 'document',
      title: 'Presupuestos y envíos',
      detail: validWorkspace ? 'Podés registrar envíos y próximos pasos.' : unavailableDetail,
      available: validWorkspace,
    },
    {
      icon: 'activity',
      title: 'Archivos adjuntos',
      detail: 'La carga de archivos estará disponible próximamente.',
      available: false,
    },
  ];
}
