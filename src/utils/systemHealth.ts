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
  // SCRUM-119: without Supabase the app works in this browser on purpose; that is not a fault.
  if (!input.backendConfigured)
    return [
      {
        label: 'Espacio activo',
        title: input.workspaceName,
        detail: 'Modo local: los datos quedan en este navegador.',
        tone: 'good',
      },
      {
        label: 'Backend',
        title: 'Modo local',
        detail: 'Sin Supabase configurado. Funciona todo, pero solo en este dispositivo.',
        tone: 'neutral',
      },
      {
        label: 'Sincronización',
        title: 'No aplica',
        detail: 'En modo local no hay datos para sincronizar con otros dispositivos.',
        tone: 'neutral',
      },
      {
        label: 'Importaciones',
        title: input.recovery ? 'Necesita recuperación' : 'Sin recuperaciones',
        detail: input.recovery ? 'Hay un lote pendiente de revisar.' : 'No hay lotes pendientes.',
        tone: input.recovery ? 'attention' : 'good',
      },
    ];
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

export function getSystemHealthOperations(
  validWorkspace: boolean,
  backendConfigured = true,
): SystemHealthOperation[] {
  const unavailableDetail = 'El espacio necesita atención.';
  // SCRUM-119: in local mode these operations work in this browser.
  if (!backendConfigured)
    return [
      {
        icon: 'users',
        title: 'Prospectos e importación CSV',
        detail: 'Disponible en este navegador.',
        available: true,
      },
      {
        icon: 'document',
        title: 'Presupuestos y envíos',
        detail: 'Disponible en este navegador.',
        available: true,
      },
      {
        icon: 'activity',
        title: 'Archivos adjuntos',
        detail: 'La carga de archivos estará disponible próximamente.',
        available: false,
      },
    ];
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
