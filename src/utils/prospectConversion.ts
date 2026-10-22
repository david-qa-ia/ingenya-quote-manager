import type { Client } from '../types/client';
import type { Activity, ActivityType } from '../types/activity';
import type { NextActionType, Opportunity } from '../types/opportunity';
import type { Prospect, ProspectConversionDraft } from '../types/prospect';
import { saveClient } from './clientStorage';
import { localDateTimeToIso } from './prospectFollowUp';
import { saveOpportunity } from './opportunityStorage';
import { saveProspectWithResult } from './prospectStorage';
import { loadActivities, saveActivity } from './activityStorage';

export interface ProspectConversionInput {
  opportunityName: string;
  serviceOfInterest: string;
  interestLevel: 'high' | 'medium' | 'low';
  detectedNeed: string;
  estimatedValue: string;
  nextStep: string;
  nextStepAt: string;
  nextStepChannel: NextActionType | '';
  responsible: string;
}

export function canQualifyProspect(prospect: Prospect): boolean {
  const latestResult = [...prospect.activities]
    .reverse()
    .find((item) => item.type === 'contactResult');
  return (
    !prospect.conversion &&
    prospect.status !== 'converted' &&
    (prospect.status === 'interested' || latestResult?.result === 'contacted')
  );
}

export function getProspectConversionValidationError(
  input: ProspectConversionInput,
): string | null {
  if (!input.opportunityName.trim()) return 'Ingresá el nombre de la oportunidad u obra.';
  if (!input.serviceOfInterest.trim()) return 'Ingresá el servicio de interés.';
  if (!['high', 'medium', 'low'].includes(input.interestLevel)) return 'Elegí el nivel de interés.';
  if (!input.detectedNeed.trim()) return 'Ingresá la necesidad detectada.';
  if (input.estimatedValue.trim()) {
    const value = Number(input.estimatedValue);
    if (!Number.isFinite(value) || value < 0) return 'Ingresá un valor estimado válido.';
  }
  if (!input.nextStep.trim()) return 'Ingresá el próximo paso.';
  if (
    !['call', 'whatsapp', 'email', 'instagram', 'meeting', 'waitForResponse', 'other'].includes(
      input.nextStepChannel,
    )
  )
    return 'Elegí el canal del próximo paso.';
  if (!localDateTimeToIso(input.nextStepAt).ok)
    return 'Ingresá una fecha y hora válidas para el próximo paso.';
  if (!input.responsible.trim()) return 'Ingresá el responsable.';
  return null;
}

export function createPendingProspectConversion(
  prospect: Prospect,
  input: ProspectConversionInput,
  now = new Date().toISOString(),
): Prospect {
  if (!canQualifyProspect(prospect))
    throw new Error('El prospecto no está disponible para convertir.');
  const error = getProspectConversionValidationError(input);
  if (error) throw new Error(error);
  const dueAt = localDateTimeToIso(input.nextStepAt);
  if (!dueAt.ok) throw new Error(dueAt.error);
  const estimatedValue = input.estimatedValue.trim() ? Number(input.estimatedValue) : undefined;
  const draft: ProspectConversionDraft = {
    clientId: crypto.randomUUID(),
    clientName: prospect.name.trim(),
    clientCompany: prospect.company.trim(),
    clientPhone: prospect.phone.trim() || '1111111111',
    clientEmail: prospect.email.trim() || 'none',
    clientPreferredChannel: prospect.preferredChannel,
    opportunityId: crypto.randomUUID(),
    opportunityName: input.opportunityName.trim(),
    serviceOfInterest: input.serviceOfInterest.trim(),
    interestLevel: input.interestLevel,
    detectedNeed: input.detectedNeed.trim(),
    ...(estimatedValue === undefined ? {} : { estimatedValue }),
    nextStep: input.nextStep.trim(),
    nextStepAt: dueAt.value,
    nextStepChannel: input.nextStepChannel as Exclude<NextActionType, ''>,
    responsible: input.responsible.trim(),
  };
  return { ...prospect, conversion: { state: 'pending', startedAt: now, draft }, updatedAt: now };
}

function buildClient(draft: ProspectConversionDraft, now: string): Client {
  return {
    id: draft.clientId,
    name: draft.clientName,
    ...(draft.clientCompany ? { company: draft.clientCompany } : {}),
    phone: draft.clientPhone,
    email: draft.clientEmail,
    preferredChannel:
      draft.clientPreferredChannel === 'instagram' ? '' : draft.clientPreferredChannel,
    contactConsent: false,
    createdAt: now,
    updatedAt: now,
  };
}

function buildOpportunity(draft: ProspectConversionDraft, now: string): Opportunity {
  return {
    id: draft.opportunityId,
    clientId: draft.clientId,
    name: draft.opportunityName,
    address: '',
    estimatedStartDate: '',
    responsibleSeller: draft.responsible,
    qualification: {
      serviceOfInterest: draft.serviceOfInterest,
      interestLevel: draft.interestLevel,
      detectedNeed: draft.detectedNeed,
      ...(draft.estimatedValue === undefined ? {} : { estimatedValue: draft.estimatedValue }),
    },
    nextAction: {
      id: `${draft.opportunityId}:next-action`,
      type: draft.nextStepChannel,
      description: draft.nextStep,
      dueAt: draft.nextStepAt,
      responsible: draft.responsible,
      priority: draft.interestLevel,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      history: [
        {
          id: `${draft.opportunityId}:next-action:created`,
          occurredAt: now,
          actor: draft.responsible,
          event: 'created',
          reason: 'Próximo paso creado al convertir el prospecto.',
        },
      ],
    },
    createdAt: now,
    updatedAt: now,
  };
}

function toOpportunityActivity(
  prospect: Prospect,
  draft: ProspectConversionDraft,
  activity: Prospect['activities'][number],
): Activity {
  const channel = activity.channel;
  const type: ActivityType =
    activity.type === 'contactResult' && channel === 'phone'
      ? 'call'
      : channel === 'whatsapp'
        ? 'whatsapp'
        : channel === 'email'
          ? 'email'
          : 'relevantChange';
  const callResult =
    activity.result === 'contacted'
      ? 'effectiveContact'
      : activity.result === 'noResponse'
        ? 'noAnswer'
        : activity.result === 'reschedule'
          ? 'callBack'
          : 'notInterested';
  const result =
    type === 'call'
      ? callResult
      : activity.result === 'contacted'
        ? 'Contacto registrado'
        : activity.result === 'noResponse'
          ? 'Sin respuesta'
          : activity.result === 'reschedule'
            ? 'Seguimiento reprogramado'
            : activity.result === 'discarded'
              ? 'Contacto descartado'
              : activity.type === 'conversionCompleted'
                ? 'Conversión completada'
                : 'Actividad de prospecto';
  const channelLabel =
    channel === 'phone'
      ? 'Llamada'
      : channel === 'whatsapp'
        ? 'WhatsApp'
        : channel === 'email'
          ? 'Email'
          : channel === 'instagram'
            ? 'Instagram'
            : '';
  return {
    id: `prospect-history:${draft.opportunityId}:${activity.id}`,
    type,
    occurredAt: activity.occurredAt,
    author: activity.author?.trim() || prospect.responsible || draft.responsible,
    result,
    note: [channelLabel, activity.description, activity.note].filter(Boolean).join(' · '),
    subject: { kind: 'opportunity', opportunityId: draft.opportunityId },
    source: 'automatic',
    noteRevisions: [],
  };
}

export function mirrorProspectActivitiesToOpportunity(
  prospect: Prospect,
  draft: ProspectConversionDraft,
): boolean {
  const existing = new Set(loadActivities().items.map((activity) => activity.id));
  return prospect.activities.every((activity) => {
    const target = toOpportunityActivity(prospect, draft, activity);
    return existing.has(target.id) || saveActivity(target);
  });
}

export type ProspectConversionResult =
  { ok: true; prospect: Prospect } | { ok: false; error: string };

export function startProspectConversion(
  prospect: Prospect,
  input: ProspectConversionInput,
): ProspectConversionResult {
  try {
    const pending = createPendingProspectConversion(prospect, input);
    const saved = saveProspectWithResult(pending);
    if (!saved.ok)
      return {
        ok: false,
        error: 'No se pudo iniciar la conversión. No se creó cliente ni oportunidad.',
      };
    return resumeProspectConversion(pending);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'No se pudo iniciar la conversión.',
    };
  }
}

export function resumeProspectConversion(
  prospect: Prospect,
  now = new Date().toISOString(),
): ProspectConversionResult {
  if (prospect.conversion?.state !== 'pending')
    return { ok: false, error: 'No hay una conversión pendiente para reintentar.' };
  const { draft } = prospect.conversion;
  if (!saveClient(buildClient(draft, now)))
    return {
      ok: false,
      error: 'No se pudo guardar el cliente. La conversión quedó pendiente para reintentar.',
    };
  if (!saveOpportunity(buildOpportunity(draft, now)))
    return {
      ok: false,
      error: 'No se pudo guardar la oportunidad. La conversión quedó pendiente para reintentar.',
    };
  if (!mirrorProspectActivitiesToOpportunity(prospect, draft))
    return {
      ok: false,
      error:
        'La oportunidad fue guardada, pero no se pudo trasladar el historial. Reintentá la conversión.',
    };
  const completed: Prospect = {
    ...prospect,
    status: 'converted',
    nextAction: '',
    nextActionAt: '',
    updatedAt: now,
    conversion: { ...prospect.conversion, state: 'completed', completedAt: now },
    activities: [
      ...prospect.activities,
      {
        id: crypto.randomUUID(),
        occurredAt: now,
        prospectId: prospect.id,
        createdAt: now,
        type: 'conversionCompleted',
        description: `Convertido en oportunidad: ${draft.opportunityName}.`,
      },
    ],
  };
  const saved = saveProspectWithResult(completed);
  return saved.ok
    ? { ok: true, prospect: completed }
    : {
        ok: false,
        error:
          'Cliente y oportunidad guardados; falta confirmar la conversión del prospecto. Reintentá la conversión.',
      };
}
