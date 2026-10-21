import type { Prospect } from '../types/prospect';
import type { PreparedProspectImport } from './prospectImportTransaction';
import { getSupabaseConfig, loadAuthSession } from './authService';

export class SupabaseRepositoryError extends Error {
  readonly code: 'not-configured' | 'session-expired' | 'network' | 'conflict' | 'server';

  constructor(code: SupabaseRepositoryError['code'], message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SupabaseRepositoryError';
    this.code = code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getSupabaseConfig();
  const session = loadAuthSession();
  if (!config) throw new SupabaseRepositoryError('not-configured', 'Supabase no está configurado.');
  if (!session) throw new SupabaseRepositoryError('session-expired', 'La sesión venció.');
  const headers = new Headers(init?.headers);
  headers.set('apikey', config.anonKey);
  headers.set('Authorization', `Bearer ${session.accessToken}`);
  if (init?.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${config.url}${path}`, { ...init, headers });
  if (response.status === 401)
    throw new SupabaseRepositoryError('session-expired', 'La sesión venció.');
  if (response.status === 409)
    throw new SupabaseRepositoryError('conflict', 'Conflicto de actualización.');
  if (!response.ok) throw new SupabaseRepositoryError('server', 'Supabase rechazó la operación.');
  return (await response.json()) as T;
}

export interface SupabaseProspectRow {
  id: string;
  workspace_id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  source: string;
  potential_service: string;
  notes: string;
  status: Prospect['status'];
  priority: Prospect['priority'];
  priority_reason: string;
  next_action: string;
  next_action_at: string | null;
  responsible: string;
  preferred_channel: Prospect['preferredChannel'] | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export async function loadRemoteProspects(workspaceId: string): Promise<SupabaseProspectRow[]> {
  const query = new URLSearchParams({
    select: '*',
    workspace_id: `eq.${workspaceId}`,
    archived_at: 'is.null',
    order: 'updated_at.desc',
  });
  return request<SupabaseProspectRow[]>(`/rest/v1/prospects?${query.toString()}`);
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
        source: prospect.source,
        potentialService: prospect.potentialService,
        notes: prospect.notes,
        status: prospect.status,
        priority: prospect.priority,
        priorityReason: prospect.priorityReason,
        nextAction: prospect.nextAction,
        nextActionAt: prospect.nextActionAt,
        responsible: prospect.responsible,
        preferredChannel: prospect.preferredChannel,
      },
      p_idempotency_key: `create-prospect:${prospect.id}`,
      p_request_id: crypto.randomUUID(),
    }),
  });
}

export async function importRemoteProspects(
  workspaceId: string,
  prepared: PreparedProspectImport,
): Promise<void> {
  await request('/rest/v1/rpc/import_prospects_with_first_contact', {
    method: 'POST',
    body: JSON.stringify({
      p_workspace_id: workspaceId,
      p_prospects: prepared.prospects.map((prospect) => ({
        id: prospect.id,
        name: prospect.name,
        company: prospect.company,
        phone: prospect.phone,
        email: prospect.email,
        source: prospect.source,
        potentialService: prospect.potentialService,
        notes: prospect.notes,
        status: prospect.status,
        priority: prospect.priority,
        priorityReason: prospect.priorityReason,
        nextAction: prospect.nextAction,
        nextActionAt: prospect.nextActionAt,
        responsible: prospect.responsible,
        preferredChannel: prospect.preferredChannel,
        activities: prospect.activities.map((activity) => ({
          id: activity.id,
          occurredAt: activity.occurredAt,
          type: activity.type,
          description: activity.description,
          note: activity.note,
          channel: activity.channel,
        })),
      })),
      p_idempotency_key: `import-prospects:${prepared.importKey}`,
      p_request_id: crypto.randomUUID(),
    }),
  });
}
