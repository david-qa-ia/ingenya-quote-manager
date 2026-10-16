import type { CommercialStatus, CommercialStatusAudit, QuoteDocumentStatus } from '../types/quote';

export const commercialStatusLabels: Record<CommercialStatus, string> = {
  prepared: 'Preparado',
  sent: 'Enviado',
  followingUp: 'En seguimiento',
  accepted: 'Aceptado',
  rejected: 'Rechazado',
  expired: 'Vencido',
  paused: 'Pausado',
};

const transitions: Record<CommercialStatus, readonly CommercialStatus[]> = {
  prepared: ['sent', 'paused'],
  sent: ['followingUp', 'accepted', 'rejected', 'expired', 'paused'],
  followingUp: ['followingUp', 'accepted', 'rejected', 'expired', 'paused'],
  accepted: [],
  rejected: [],
  expired: [],
  paused: ['prepared', 'followingUp'],
};

export function createPreparedCommercialAudit(changedAt: string): CommercialStatusAudit {
  return {
    changedAt,
    changedBy: 'Sistema local',
    reason: 'Estado comercial inicial al crear el presupuesto.',
  };
}

export function createMigratedPreparedCommercialAudit(savedAt: string): CommercialStatusAudit {
  return {
    changedAt: savedAt,
    changedBy: 'Migración local',
    reason: 'Estado comercial inicial asignado por compatibilidad.',
  };
}

export function isCommercialStatus(value: unknown): value is CommercialStatus {
  return typeof value === 'string' && value in commercialStatusLabels;
}

export function isCommercialStatusAudit(value: unknown): value is CommercialStatusAudit {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const audit = value as Record<string, unknown>;
  return (
    typeof audit.changedAt === 'string' &&
    Number.isFinite(Date.parse(audit.changedAt)) &&
    typeof audit.changedBy === 'string' &&
    audit.changedBy.trim().length > 0 &&
    typeof audit.reason === 'string' &&
    audit.reason.trim().length > 0 &&
    (audit.channel === undefined || audit.channel === 'whatsapp' || audit.channel === 'email') &&
    (audit.recipient === undefined ||
      (typeof audit.recipient === 'string' && audit.recipient.trim().length > 0))
  );
}

export function getCommercialTransitionTargets(
  status: CommercialStatus,
  documentStatus: QuoteDocumentStatus,
): CommercialStatus[] {
  return transitions[status].filter(
    (target) =>
      !['sent', 'accepted', 'rejected'].includes(target) || documentStatus === 'finalized',
  );
}

export function assertCommercialTransition(
  currentStatus: CommercialStatus,
  nextStatus: CommercialStatus,
  documentStatus: QuoteDocumentStatus,
): void {
  if (!getCommercialTransitionTargets(currentStatus, documentStatus).includes(nextStatus)) {
    throw new Error('La transición comercial no está permitida para este presupuesto.');
  }
}

export function applyCommercialTransition(
  currentStatus: CommercialStatus,
  nextStatus: CommercialStatus,
  documentStatus: QuoteDocumentStatus,
  audit: CommercialStatusAudit,
  sentAudit?: CommercialStatusAudit,
): {
  commercialStatus: CommercialStatus;
  commercialStatusAudit: CommercialStatusAudit;
  sentAudit?: CommercialStatusAudit;
} {
  assertCommercialTransition(currentStatus, nextStatus, documentStatus);
  if (!isCommercialStatusAudit(audit)) {
    throw new Error('Ingresá quién registró el cambio y su motivo.');
  }
  return {
    commercialStatus: nextStatus,
    commercialStatusAudit: { ...audit },
    ...(nextStatus === 'sent' ? { sentAudit: { ...audit } } : sentAudit ? { sentAudit } : {}),
  };
}
