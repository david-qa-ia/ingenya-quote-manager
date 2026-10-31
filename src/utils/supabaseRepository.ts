import type { Prospect, ProspectActivity, ProspectChannel } from '../types/prospect';
import type { Activity } from '../types/activity';
import type { Client } from '../types/client';
import type { Opportunity } from '../types/opportunity';
import type { SavedQuote } from '../types/quote';
import type { PreparedProspectImport } from './prospectImportTransaction';
import { getSupabaseConfig, getValidAuthSession, refreshAuthSession } from './authService';

export type RemoteQuoteSendResult =
  | {
      ok: true;
      idempotent: boolean;
      version: number;
    }
  | {
      ok: false;
      reason: 'conflict';
      message: string;
    };

export async function registerRemoteQuoteSend(input: {
  workspaceId: string;
  quoteVersionId: string;
  expectedVersion: number;
  channel: string;
  recipient: string;
  sentAt: string;
  note: string;
  nextAction?: {
    type: 'call' | 'whatsapp' | 'email' | 'meeting';
    dueAt: string;
    responsible: string;
  };
  nextActionDecision: 'preserve' | 'replace';
  idempotencyKey: string;
}): Promise<RemoteQuoteSendResult> {
  const result = await request<{ code?: string; version?: number; idempotent?: boolean }>(
    '/rest/v1/rpc/register_quote_send_with_next_action',
    {
      method: 'POST',
      body: JSON.stringify({
        p_workspace_id: input.workspaceId,
        p_quote_version_id: input.quoteVersionId,
        p_expected_version: input.expectedVersion,
        p_channel: input.channel,
        p_recipient: input.recipient,
        p_sent_at: input.sentAt,
        p_note: input.note,
        p_next_action: input.nextAction
          ? {
              kind: 'followUp',
              type: input.nextAction.type,
              description: 'Dar seguimiento al presupuesto enviado',
              dueAt: input.nextAction.dueAt,
              responsible: input.nextAction.responsible,
              priority: 'medium',
            }
          : null,
        p_next_action_decision: input.nextActionDecision,
        p_idempotency_key: input.idempotencyKey,
        p_request_id: crypto.randomUUID(),
      }),
    },
  );
  if (result.code === 'CONFLICT')
    return {
      ok: false,
      reason: 'conflict',
      message: 'La versión cambió antes de registrar el envío.',
    };
  if (result.code !== 'OK')
    throw new SupabaseRepositoryError('server', 'Supabase no confirmó el envío del presupuesto.');
  return {
    ok: true,
    idempotent: Boolean(result.idempotent),
    version: result.version ?? input.expectedVersion + 1,
  };
}

export async function syncAndRegisterRemoteLocalQuoteSend(input: {
  workspaceId: string;
  quote: SavedQuote;
  client: Client;
  opportunity?: Opportunity;
  channel: string;
  recipient: string;
  sentAt: string;
  note: string;
  nextAction?: {
    type: 'call' | 'whatsapp' | 'email' | 'meeting';
    dueAt: string;
    responsible: string;
  };
  idempotencyKey: string;
}): Promise<RemoteQuoteSendResult> {
  const result = await request<{ code?: string; version?: number; idempotent?: boolean }>(
    '/rest/v1/rpc/sync_and_register_local_quote_send',
    {
      method: 'POST',
      body: JSON.stringify({
        p_workspace_id: input.workspaceId,
        p_payload: {
          client: input.client,
          ...(input.opportunity ? { opportunity: input.opportunity } : {}),
          quote: {
            localId: input.quote.id,
            clientName: input.quote.clientName,
            projectName: input.quote.projectName,
            lines: input.quote.lines,
          },
        },
        p_channel: input.channel,
        p_recipient: input.recipient,
        p_sent_at: input.sentAt,
        p_note: input.note,
        p_next_action: input.nextAction
          ? {
              kind: 'followUp',
              type: input.nextAction.type,
              description: 'Dar seguimiento al presupuesto enviado',
              dueAt: input.nextAction.dueAt,
              responsible: input.nextAction.responsible,
              priority: 'medium',
            }
          : null,
        p_idempotency_key: input.idempotencyKey,
        p_request_id: crypto.randomUUID(),
      }),
    },
  );
  if (result.code === 'CONFLICT')
    return {
      ok: false,
      reason: 'conflict',
      message: 'El presupuesto cambió antes de sincronizarse.',
    };
  if (result.code !== 'OK')
    throw new SupabaseRepositoryError(
      'server',
      'Supabase no confirmó la sincronización del presupuesto.',
    );
  return {
    ok: true,
    idempotent: Boolean(result.idempotent),
    version: result.version ?? 1,
  };
}

export type RemoteProspectResult =
  | { ok: true; idempotent: boolean; version: number }
  | { ok: false; reason: 'conflict'; message: string; version?: number };

export async function registerRemoteProspectResult(input: {
  workspaceId: string;
  prospectId: string;
  expectedVersion: number;
  result: string;
  channel: 'phone' | 'whatsapp' | 'email' | 'instagram';
  note: string;
  followUpAt?: string;
  responsible: string;
  idempotencyKey: string;
}): Promise<RemoteProspectResult> {
  const result = await request<{ code?: string; version?: number; idempotent?: boolean }>(
    '/rest/v1/rpc/register_prospect_result',
    {
      method: 'POST',
      body: JSON.stringify({
        p_workspace_id: input.workspaceId,
        p_prospect_id: input.prospectId,
        p_expected_version: input.expectedVersion,
        p_result: input.result,
        p_channel: toSupabaseProspectChannel(input.channel),
        p_note: input.note,
        p_follow_up_at: input.followUpAt || null,
        p_responsible: input.responsible,
        p_idempotency_key: input.idempotencyKey,
        p_request_id: crypto.randomUUID(),
      }),
    },
  );
  if (result.code === 'CONFLICT')
    return {
      ok: false,
      reason: 'conflict',
      version: result.version,
      message: 'El prospecto cambió antes de guardar el resultado. Recargá y revisá los datos.',
    };
  if (result.code !== 'OK' || !Number.isInteger(result.version))
    throw new SupabaseRepositoryError(
      'server',
      'Supabase no confirmó el resultado y próximo paso del prospecto.',
    );
  return { ok: true, idempotent: Boolean(result.idempotent), version: result.version as number };
}

export type RemoteProspectConversionResult =
  | { ok: true; idempotent: boolean; version: number; opportunityId: string; contactId?: string }
  | { ok: false; reason: 'conflict'; message: string; version?: number };

export async function convertRemoteProspectToOpportunity(input: {
  workspaceId: string;
  prospectId: string;
  expectedVersion: number;
  idempotencyKey: string;
}): Promise<RemoteProspectConversionResult> {
  const result = await request<{
    code?: string;
    version?: number;
    opportunityId?: string;
    contactId?: string;
    idempotent?: boolean;
    currentVersion?: number;
  }>('/rest/v1/rpc/convert_prospect_to_opportunity', {
    method: 'POST',
    body: JSON.stringify({
      p_workspace_id: input.workspaceId,
      p_prospect_id: input.prospectId,
      p_expected_version: input.expectedVersion,
      p_idempotency_key: input.idempotencyKey,
      p_request_id: crypto.randomUUID(),
    }),
  });
  if (result.code === 'CONFLICT') {
    return {
      ok: false,
      reason: 'conflict',
      version: result.currentVersion,
      message: 'El prospecto cambió antes de crear la oportunidad. Recargá y revisá los datos.',
    };
  }
  if (result.code !== 'OK' || !Number.isInteger(result.version) || !result.opportunityId) {
    throw new SupabaseRepositoryError(
      'server',
      'Supabase no confirmó la conversión del prospecto.',
    );
  }
  return {
    ok: true,
    idempotent: Boolean(result.idempotent),
    version: result.version as number,
    opportunityId: result.opportunityId,
    ...(result.contactId ? { contactId: result.contactId } : {}),
  };
}

export class SupabaseRepositoryError extends Error {
  readonly code: 'not-configured' | 'session-expired' | 'network' | 'conflict' | 'server';

  constructor(code: SupabaseRepositoryError['code'], message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SupabaseRepositoryError';
    this.code = code;
  }
}

async function getSupabaseErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown; details?: unknown };
    const detail = typeof body.message === 'string' ? body.message : body.details;
    if (typeof detail !== 'string') return 'Supabase rechazó la operación.';
    if (detail.includes('invalid input syntax for type uuid'))
      return 'Este presupuesto todavía es local y no tiene una versión migrada en Supabase. Registralo localmente o migrá el presupuesto antes de enviarlo.';
    if (detail.includes('quote-version-not-sendable'))
      return 'La versión del presupuesto no está disponible para envío en Supabase. Recargá los datos o migrá el presupuesto antes de enviarlo.';
    return `Supabase rechazó la operación: ${detail}`;
  } catch {
    return 'Supabase rechazó la operación.';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getSupabaseConfig();
  let session = await getValidAuthSession();
  if (!config) throw new SupabaseRepositoryError('not-configured', 'Supabase no está configurado.');
  if (!session) throw new SupabaseRepositoryError('session-expired', 'La sesión venció.');
  const send = async (activeSession: NonNullable<typeof session>) => {
    const headers = new Headers(init?.headers);
    headers.set('apikey', config.anonKey);
    headers.set('Authorization', `Bearer ${activeSession.accessToken}`);
    if (init?.body) headers.set('Content-Type', 'application/json');
    try {
      return await fetch(`${config.url}${path}`, { ...init, headers });
    } catch (error) {
      throw new SupabaseRepositoryError('network', 'No se pudo conectar con Supabase.', {
        cause: error,
      });
    }
  };
  let response = await send(session);
  if (response.status === 401) {
    session = await refreshAuthSession();
    if (!session) throw new SupabaseRepositoryError('session-expired', 'La sesión venció.');
    response = await send(session);
  }
  if (response.status === 401)
    throw new SupabaseRepositoryError('session-expired', 'La sesión venció.');
  if (response.status === 409)
    throw new SupabaseRepositoryError('conflict', 'Conflicto de actualización.');
  if (response.status === 404)
    throw new SupabaseRepositoryError(
      'server',
      'La función requerida no está disponible en Supabase.',
    );
  if (!response.ok)
    throw new SupabaseRepositoryError('server', await getSupabaseErrorMessage(response));
  return (await response.json()) as T;
}

export interface SupabaseProspectRow {
  id: string;
  workspace_id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  instagram?: string | null;
  address?: string | null;
  source: string;
  potential_service: string;
  notes: string;
  status: Prospect['status'];
  priority: Prospect['priority'];
  priority_reason: string;
  next_action: string;
  next_action_at: string | null;
  responsible: string;
  preferred_channel: SupabaseProspectChannel | null;
  conversion?: SupabaseProspectConversion | null;
  archived_at?: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export type SupabaseProspectChannel = 'call' | 'phone' | 'whatsapp' | 'email' | 'instagram';

export interface SupabaseProspectConversion {
  contactId?: string;
  opportunityId?: string;
}

/** Keeps the database's call label at the remote boundary only. */
export function fromSupabaseProspectChannel(value: unknown): ProspectChannel | '' {
  if (value === 'call' || value === 'phone') return 'phone';
  if (value === 'whatsapp' || value === 'email' || value === 'instagram') return value;
  return '';
}

export function toSupabaseProspectChannel(
  channel: ProspectChannel | '',
): 'call' | 'whatsapp' | 'email' | 'instagram' | '' {
  return channel === 'phone' ? 'call' : channel;
}

function mapRemoteConversion(row: SupabaseProspectRow): Prospect['conversion'] | undefined {
  const contactId = row.conversion?.contactId;
  const opportunityId = row.conversion?.opportunityId;
  if (!contactId || !opportunityId) return undefined;

  const completedAt = row.updated_at;
  const service = row.potential_service.trim() || 'Oportunidad convertida';
  return {
    state: 'completed',
    startedAt: completedAt,
    completedAt,
    draft: {
      clientId: contactId,
      clientName: row.name,
      clientCompany: row.company.trim() || 'Sin empresa registrada',
      clientPhone: row.phone.trim() || '1111111111',
      clientEmail: row.email.trim() || 'none',
      clientPreferredChannel: fromSupabaseProspectChannel(row.preferred_channel),
      address: row.address ?? '',
      opportunityId,
      opportunityName: service,
      serviceOfInterest: service,
      detectedNeed: row.notes.trim() || service,
      nextStep: row.next_action.trim() || 'Seguimiento de oportunidad convertida',
      nextStepAt: row.next_action_at ?? completedAt,
      nextStepChannel:
        toSupabaseProspectChannel(fromSupabaseProspectChannel(row.preferred_channel)) || 'other',
      responsible: row.responsible.trim() || 'Sin asignar',
      interestLevel: row.priority,
    },
  };
}

/** Maps a persisted Supabase row into the strict local mirror shape. */
export function mapRemoteProspect(
  row: SupabaseProspectRow,
  activities: Prospect['activities'] = [],
): Prospect {
  const conversion = mapRemoteConversion(row);
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    phone: row.phone,
    email: row.email,
    instagram: row.instagram ?? '',
    address: row.address ?? '',
    source: row.source,
    potentialService: row.potential_service,
    notes: row.notes,
    status: row.status,
    priority: row.priority,
    priorityReason: row.priority_reason,
    nextAction: row.next_action,
    nextActionAt: row.next_action_at ?? '',
    responsible: row.responsible,
    preferredChannel: fromSupabaseProspectChannel(row.preferred_channel),
    ...(conversion ? { conversion } : {}),
    ...(row.archived_at ? { archivedAt: row.archived_at } : {}),
    activities,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

export async function loadRemoteProspects(workspaceId: string): Promise<SupabaseProspectRow[]> {
  const query = new URLSearchParams({
    select: '*',
    workspace_id: `eq.${workspaceId}`,
    // Archived prospects are loaded too, for the "Archivados" view (SCRUM-111).
    order: 'updated_at.desc',
  });
  return request<SupabaseProspectRow[]>(`/rest/v1/prospects?${query.toString()}`);
}

export interface SupabaseProspectActivityRow {
  id: string;
  workspace_id: string;
  prospect_id: string;
  type: ProspectActivity['type'];
  occurred_at: string;
  created_at: string;
  result: ProspectActivity['result'] | '';
  note: string;
  communication: {
    channel?: SupabaseProspectChannel;
    followUpAt?: string;
    previousFollowUpAt?: string;
    responsible?: string;
  } | null;
}

export async function loadRemoteProspectActivities(
  workspaceId: string,
): Promise<SupabaseProspectActivityRow[]> {
  const query = new URLSearchParams({
    select: 'id,workspace_id,prospect_id,type,occurred_at,created_at,result,note,communication',
    workspace_id: `eq.${workspaceId}`,
    prospect_id: 'not.is.null',
    order: 'occurred_at.asc',
  });
  return request<SupabaseProspectActivityRow[]>(`/rest/v1/activities?${query.toString()}`);
}

export function mapRemoteProspectActivity(row: SupabaseProspectActivityRow): ProspectActivity {
  const channel = fromSupabaseProspectChannel(row.communication?.channel);
  const result = row.result || undefined;
  return {
    id: row.id,
    prospectId: row.prospect_id,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
    type: row.type,
    description: row.note || `${channel ? `${channel}: ` : ''}${result ?? 'Actividad registrada.'}`,
    ...(result ? { result } : {}),
    ...(channel ? { channel } : {}),
    ...(row.note ? { note: row.note } : {}),
    ...(row.communication?.followUpAt ? { followUpAt: row.communication.followUpAt } : {}),
    ...(row.communication?.previousFollowUpAt
      ? { previousFollowUpAt: row.communication.previousFollowUpAt }
      : {}),
    ...(row.communication?.responsible ? { author: row.communication.responsible } : {}),
  };
}

export type RemoteProspectProfileResult =
  | { ok: true; version: number; idempotent: boolean }
  | { ok: false; reason: 'conflict'; message: string; version?: number };

export async function updateRemoteProspectProfile(input: {
  workspaceId: string;
  prospect: Prospect;
  idempotencyKey: string;
  /** History entry describing the edited fields (SCRUM-103); stored by the RPC as an activity. */
  changeSummary?: string;
  changeAuthor?: string;
}): Promise<RemoteProspectProfileResult> {
  const { workspaceId, prospect, idempotencyKey, changeSummary, changeAuthor } = input;
  const result = await request<{ code?: string; version?: number; idempotent?: boolean }>(
    '/rest/v1/rpc/update_prospect_profile',
    {
      method: 'POST',
      body: JSON.stringify({
        p_workspace_id: workspaceId,
        p_prospect_id: prospect.id,
        p_expected_version: prospect.version ?? 1,
        p_payload: {
          name: prospect.name,
          company: prospect.company,
          phone: prospect.phone,
          email: prospect.email,
          instagram: prospect.instagram ?? '',
          address: prospect.address ?? '',
          source: prospect.source,
          potentialService: prospect.potentialService,
          notes: prospect.notes,
          priority: prospect.priority,
          priorityReason: prospect.priorityReason,
          responsible: prospect.responsible,
          preferredChannel: toSupabaseProspectChannel(prospect.preferredChannel),
          ...(changeSummary ? { changeSummary, changeAuthor: changeAuthor ?? '' } : {}),
        },
        p_idempotency_key: idempotencyKey,
        p_request_id: crypto.randomUUID(),
      }),
    },
  );
  if (result.code === 'CONFLICT')
    return {
      ok: false,
      reason: 'conflict',
      version: result.version,
      message: 'El prospecto cambió en otro lugar. Recargá antes de volver a guardar.',
    };
  if (result.code !== 'OK' || !Number.isInteger(result.version))
    throw new SupabaseRepositoryError('server', 'Supabase no confirmó los datos del prospecto.');
  return { ok: true, version: result.version as number, idempotent: Boolean(result.idempotent) };
}

export type RemoteProspectArchiveResult =
  | { ok: true; version: number; archivedAt?: string }
  | { ok: false; reason: 'conflict' | 'notFound'; message: string; version?: number };

/** Archives or restores a prospect (SCRUM-111); the RPC also writes the history entry. */
export async function setRemoteProspectArchived(input: {
  workspaceId: string;
  prospect: Prospect;
  archived: boolean;
  reason: string;
  author: string;
}): Promise<RemoteProspectArchiveResult> {
  const { workspaceId, prospect, archived, reason, author } = input;
  const version = prospect.version ?? 1;
  const result = await request<{
    code?: string;
    version?: number;
    archivedAt?: string | null;
  }>('/rest/v1/rpc/set_prospect_archived', {
    method: 'POST',
    body: JSON.stringify({
      p_workspace_id: workspaceId,
      p_prospect_id: prospect.id,
      p_expected_version: version,
      p_archived: archived,
      p_reason: reason,
      p_author: author,
      p_idempotency_key: `${archived ? 'archive' : 'restore'}-prospect:${prospect.id}:${version}`,
      p_request_id: crypto.randomUUID(),
    }),
  });
  if (result.code === 'CONFLICT')
    return {
      ok: false,
      reason: 'conflict',
      version: result.version,
      message: 'El prospecto cambió en otro lugar. Recargá y volvé a intentar.',
    };
  if (result.code === 'NOT_FOUND')
    return {
      ok: false,
      reason: 'notFound',
      message: archived
        ? 'El prospecto ya estaba archivado o no existe. Recargá la lista.'
        : 'El prospecto ya estaba activo o no existe. Recargá la lista.',
    };
  if (result.code !== 'OK' || !Number.isInteger(result.version))
    throw new SupabaseRepositoryError(
      'server',
      archived ? 'Supabase no confirmó el archivado.' : 'Supabase no confirmó la restauración.',
    );
  return {
    ok: true,
    version: result.version as number,
    ...(result.archivedAt ? { archivedAt: result.archivedAt } : {}),
  };
}

/** Contact row as stored in Supabase (SCRUM-113). */
export interface SupabaseContactRow {
  id: string;
  workspace_id: string;
  name: string;
  company: string | null;
  phone: string;
  email: string;
  preferred_channel: string | null;
  contact_consent: boolean;
  do_not_contact: Client['doNotContact'] | null;
  version: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

const clientChannels = ['phone', 'whatsapp', 'email'] as const;

/** Maps a Supabase contact into the local client mirror shape. */
export function mapRemoteContact(row: SupabaseContactRow): Client {
  const channel = (clientChannels as readonly string[]).includes(row.preferred_channel ?? '')
    ? (row.preferred_channel as Client['preferredChannel'])
    : '';
  return {
    id: row.id,
    name: row.name,
    ...(row.company?.trim() ? { company: row.company } : {}),
    phone: row.phone,
    email: row.email,
    preferredChannel: channel,
    contactConsent: row.contact_consent,
    ...(row.do_not_contact ? { doNotContact: row.do_not_contact } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

export async function loadRemoteContacts(workspaceId: string): Promise<SupabaseContactRow[]> {
  const query = new URLSearchParams({
    select: '*',
    workspace_id: `eq.${workspaceId}`,
    archived_at: 'is.null',
    order: 'created_at.asc',
  });
  return request<SupabaseContactRow[]>(`/rest/v1/contacts?${query.toString()}`);
}

export type RemoteContactSaveResult =
  | { ok: true; version: number; updatedAt?: string }
  | {
      ok: false;
      reason: 'duplicate' | 'conflict' | 'notFound' | 'validation';
      message: string;
      duplicateId?: string;
    };

/** Creates (no version) or updates (with version) a contact in Supabase (SCRUM-113). */
export async function saveRemoteContact(input: {
  workspaceId: string;
  client: Client;
  isNew: boolean;
}): Promise<RemoteContactSaveResult> {
  const { workspaceId, client, isNew } = input;
  const result = await request<{
    code?: string;
    version?: number;
    updatedAt?: string;
    contactId?: string;
    name?: string;
  }>('/rest/v1/rpc/save_contact', {
    method: 'POST',
    body: JSON.stringify({
      p_workspace_id: workspaceId,
      p_contact_id: client.id,
      p_expected_version: isNew ? null : (client.version ?? 1),
      p_payload: {
        name: client.name,
        company: client.company ?? '',
        phone: client.phone,
        email: client.email,
        preferredChannel: client.preferredChannel,
        contactConsent: client.contactConsent,
        doNotContact: client.doNotContact ?? null,
      },
      p_idempotency_key: `save-contact:${client.id}:${isNew ? 'new' : (client.version ?? 1)}:${client.updatedAt}`,
      p_request_id: crypto.randomUUID(),
    }),
  });
  if (result.code === 'DUPLICATE')
    return {
      ok: false,
      reason: 'duplicate',
      duplicateId: result.contactId,
      message: `Ya existe un contacto con ese email o teléfono${result.name ? `: ${result.name}` : ''}. Buscalo y usá ese contacto.`,
    };
  if (result.code === 'CONFLICT')
    return {
      ok: false,
      reason: 'conflict',
      message: 'El contacto cambió en otro lugar. Recargá la página antes de volver a guardar.',
    };
  if (result.code === 'NOT_FOUND')
    return {
      ok: false,
      reason: 'notFound',
      message: 'El contacto no existe en el espacio de trabajo. Recargá la página.',
    };
  if (result.code === 'VALIDATION')
    return {
      ok: false,
      reason: 'validation',
      message: 'Ingresá el nombre o la empresa del cliente.',
    };
  if (result.code !== 'OK' || !Number.isInteger(result.version))
    throw new SupabaseRepositoryError('server', 'Supabase no confirmó el contacto.');
  return {
    ok: true,
    version: result.version as number,
    ...(result.updatedAt ? { updatedAt: result.updatedAt } : {}),
  };
}

/** Opportunity row (SCRUM-114). `document` holds the app aggregate once written by the app. */
export interface SupabaseOpportunityRow {
  id: string;
  workspace_id: string;
  contact_id: string;
  name: string;
  address: string;
  estimated_start_date: string | null;
  responsible_seller: string;
  origin: string | null;
  status: string;
  commercial_state: string;
  pipeline_stage: string;
  document: Partial<Opportunity> | null;
  version: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function loadRemoteOpportunities(
  workspaceId: string,
): Promise<SupabaseOpportunityRow[]> {
  const query = new URLSearchParams({
    select: '*',
    workspace_id: `eq.${workspaceId}`,
    archived_at: 'is.null',
    order: 'created_at.asc',
  });
  return request<SupabaseOpportunityRow[]>(`/rest/v1/opportunities?${query.toString()}`);
}

/**
 * Uses the stored app document when present. Rows created by server flows (prospect conversion,
 * quote send) have no document yet and are rebuilt from their columns.
 */
export function mapRemoteOpportunity(row: SupabaseOpportunityRow): Opportunity {
  const columns = {
    id: row.id,
    clientId: row.contact_id,
    name: row.name,
    address: row.address,
    estimatedStartDate: row.estimated_start_date ?? '',
    responsibleSeller: row.responsible_seller,
    ...(row.origin ? { origin: row.origin } : {}),
    status: row.status as Opportunity['status'],
    commercialState: row.commercial_state as Opportunity['commercialState'],
    pipelineStage: row.pipeline_stage as Opportunity['pipelineStage'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  return row.document ? ({ ...row.document, ...columns } as Opportunity) : columns;
}

export interface SupabaseCommercialActivityRow {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  opportunity_id: string | null;
  type: Activity['type'];
  occurred_at: string;
  author_name: string | null;
  result: string;
  note: string;
  source: Activity['source'];
  event: Activity['event'] | null;
  communication: Activity['communication'] | null;
  note_revisions: Activity['noteRevisions'];
}

export async function loadRemoteCommercialActivities(
  workspaceId: string,
): Promise<SupabaseCommercialActivityRow[]> {
  const query = new URLSearchParams({
    select:
      'id,workspace_id,contact_id,opportunity_id,type,occurred_at,author_name,result,note,source,event,communication,note_revisions',
    workspace_id: `eq.${workspaceId}`,
    or: '(contact_id.not.is.null,opportunity_id.not.is.null)',
    order: 'occurred_at.asc',
  });
  return request<SupabaseCommercialActivityRow[]>(`/rest/v1/activities?${query.toString()}`);
}

export function mapRemoteCommercialActivity(row: SupabaseCommercialActivityRow): Activity {
  return {
    id: row.id,
    type: row.type,
    occurredAt: row.occurred_at,
    author: row.author_name?.trim() || 'Sistema',
    result: row.result,
    note: row.note,
    subject: row.opportunity_id
      ? { kind: 'opportunity', opportunityId: row.opportunity_id }
      : { kind: 'client', clientId: row.contact_id ?? '' },
    source: row.source,
    ...(row.event ? { event: row.event } : {}),
    noteRevisions: row.note_revisions ?? [],
    ...(row.communication ? { communication: row.communication } : {}),
  };
}

export type RemoteCommercialSyncResult =
  | { ok: true; versions: Record<string, number> }
  | { ok: false; code: 'CONFLICT' | 'MISSING_REFERENCE' };

/** Sends changed contacts, opportunities and activity in one atomic call (SCRUM-114). */
export async function syncRemoteCommercialRecords(input: {
  workspaceId: string;
  contacts: Client[];
  opportunities: { expectedVersion: number | null; data: Opportunity }[];
  activities: Activity[];
}): Promise<RemoteCommercialSyncResult> {
  const requestId = crypto.randomUUID();
  const result = await request<{ code?: string; versions?: Record<string, number> }>(
    '/rest/v1/rpc/sync_commercial_records',
    {
      method: 'POST',
      body: JSON.stringify({
        p_workspace_id: input.workspaceId,
        p_contacts: input.contacts.map((client) => ({
          id: client.id,
          name: client.name,
          company: client.company ?? '',
          phone: client.phone,
          email: client.email,
          preferredChannel: client.preferredChannel,
          contactConsent: client.contactConsent,
          doNotContact: client.doNotContact ?? null,
        })),
        p_opportunities: input.opportunities,
        p_activities: input.activities,
        p_idempotency_key: `sync-commercial:${requestId}`,
        p_request_id: requestId,
      }),
    },
  );
  if (result.code === 'CONFLICT' || result.code === 'MISSING_REFERENCE')
    return { ok: false, code: result.code };
  if (result.code !== 'OK')
    throw new SupabaseRepositoryError('server', 'Supabase no confirmó los cambios.');
  return { ok: true, versions: result.versions ?? {} };
}

export async function createRemoteProspect(workspaceId: string, prospect: Prospect): Promise<void> {
  await request('/rest/v1/rpc/create_prospect', {
    method: 'POST',
    body: JSON.stringify({
      p_workspace_id: workspaceId,
      p_prospect_id: prospect.id,
      p_payload: {
        name: prospect.name,
        company: prospect.company,
        phone: prospect.phone,
        email: prospect.email,
        instagram: prospect.instagram,
        address: prospect.address ?? '',
        source: prospect.source,
        potentialService: prospect.potentialService,
        notes: prospect.notes,
        status: prospect.status,
        priority: prospect.priority,
        priorityReason: prospect.priorityReason,
        nextAction: prospect.nextAction,
        nextActionAt: prospect.nextActionAt,
        responsible: prospect.responsible,
        preferredChannel: toSupabaseProspectChannel(prospect.preferredChannel),
      },
      p_idempotency_key: `create-prospect:${prospect.id}`,
      p_request_id: crypto.randomUUID(),
    }),
  });
}

export async function importRemoteProspects(
  workspaceId: string,
  prepared: PreparedProspectImport,
): Promise<{ importedCount: number; idempotent: boolean }> {
  const result = await request<{ code?: string; importedCount?: number; idempotent?: boolean }>(
    '/rest/v1/rpc/import_prospects_with_first_contact',
    {
      method: 'POST',
      body: JSON.stringify({
        p_workspace_id: workspaceId,
        p_prospects: prepared.prospects.map((prospect) => ({
          id: prospect.id,
          name: prospect.name,
          company: prospect.company,
          phone: prospect.phone,
          email: prospect.email,
          instagram: prospect.instagram,
          address: prospect.address ?? '',
          source: prospect.source,
          potentialService: prospect.potentialService,
          notes: prospect.notes,
          status: prospect.status,
          priority: prospect.priority,
          priorityReason: prospect.priorityReason,
          nextAction: prospect.nextAction,
          nextActionAt: prospect.nextActionAt,
          responsible: prospect.responsible,
          preferredChannel: toSupabaseProspectChannel(prospect.preferredChannel),
          activities: prospect.activities.map((activity) => ({
            id: activity.id,
            occurredAt: activity.occurredAt,
            type: activity.type,
            description: activity.description,
            note: activity.note,
            channel: activity.channel ? toSupabaseProspectChannel(activity.channel) : undefined,
          })),
        })),
        p_idempotency_key: `import-prospects:${prepared.importKey}`,
        p_request_id: crypto.randomUUID(),
      }),
    },
  );
  if (result.code !== 'OK' || !Number.isInteger(result.importedCount))
    throw new SupabaseRepositoryError(
      'server',
      'Supabase no confirmó el resultado de la importación.',
    );
  if (result.importedCount !== prepared.prospects.length)
    throw new SupabaseRepositoryError(
      'server',
      'Supabase confirmó un conteo distinto al lote preparado. No se completó la importación.',
    );
  return { importedCount: result.importedCount, idempotent: Boolean(result.idempotent) };
}
