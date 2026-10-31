import type { Activity } from '../types/activity';
import type { Client } from '../types/client';
import type { Opportunity } from '../types/opportunity';
import { ACTIVITIES_STORAGE_KEY, isActivity } from './activityStorage';
import { isAuthConfigured } from './authService';
import { CLIENTS_STORAGE_KEY } from './clientStorage';
import { OPPORTUNITIES_STORAGE_KEY } from './opportunityStorage';
import {
  loadRemoteCommercialActivities,
  loadRemoteOpportunities,
  mapRemoteCommercialActivity,
  mapRemoteOpportunity,
  syncRemoteCommercialRecords,
} from './supabaseRepository';
import { isOpportunity } from './opportunityValidation';
import { isClient } from './clientValidation';
import { getActiveWorkspaceId, isWorkspaceUuid, workspaceStorageKey } from './workspaceStorage';

/**
 * SCRUM-114: keeps opportunities and contact/opportunity activity in Supabase.
 *
 * The app writes these records to the browser copy from many places. After each write this
 * module compares the copy with the last state confirmed by Supabase and sends the changed
 * records in one atomic call. If Supabase rejects them or cannot be reached, the browser copy is
 * restored to the confirmed state and `ingenya:remote-sync-failed` is dispatched, so nothing
 * stays saved without Supabase (decision of 30/10/2026: no offline queue).
 */

export const REMOTE_VERSIONS_STORAGE_KEY = 'ingenya.remoteVersions.v1';
export const REMOTE_SYNC_FAILED_EVENT = 'ingenya:remote-sync-failed';
export const REMOTE_SYNC_APPLIED_EVENT = 'ingenya:remote-sync-applied';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string | undefined): value is string =>
  typeof value === 'string' && uuidPattern.test(value);

type Snapshot = { opportunities: Map<string, string>; activities: Map<string, string> };

let workspace: string | null = null;
let confirmed: Snapshot | null = null;
let applying = false;
let scheduled = false;
let inFlight: Promise<void> | null = null;

function readRaw(key: string): unknown[] {
  try {
    const raw = localStorage.getItem(workspaceStorageKey(key));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function writeRaw(key: string, records: unknown[]): void {
  applying = true;
  try {
    localStorage.setItem(workspaceStorageKey(key), JSON.stringify(records));
  } finally {
    applying = false;
  }
}
const idOf = (value: unknown) =>
  value && typeof value === 'object' && 'id' in value ? String((value as { id: unknown }).id) : '';

/** Records that can live in Supabase today: UUID ids and, for activity, a client/opportunity subject. */
function isSyncableOpportunity(value: unknown): value is Opportunity {
  return isOpportunity(value) && isUuid(value.id) && isUuid(value.clientId);
}
function isSyncableActivity(value: unknown): value is Activity {
  if (!isActivity(value) || !isUuid(value.id)) return false;
  if (value.subject.kind === 'client') return isUuid(value.subject.clientId);
  if (value.subject.kind === 'opportunity') return isUuid(value.subject.opportunityId);
  return false; // Quote activity moves with quotes (SCRUM-115).
}

function takeSnapshot(): Snapshot {
  return {
    opportunities: new Map(
      readRaw(OPPORTUNITIES_STORAGE_KEY)
        .filter(isSyncableOpportunity)
        .map((item) => [item.id, JSON.stringify(item)]),
    ),
    activities: new Map(
      readRaw(ACTIVITIES_STORAGE_KEY)
        .filter(isSyncableActivity)
        .map((item) => [item.id, JSON.stringify(item)]),
    ),
  };
}

function readVersions(): Record<string, number> {
  try {
    const raw = localStorage.getItem(workspaceStorageKey(REMOTE_VERSIONS_STORAGE_KEY));
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, number>)
      : {};
  } catch {
    return {};
  }
}
function writeVersions(versions: Record<string, number>): void {
  try {
    localStorage.setItem(
      workspaceStorageKey(REMOTE_VERSIONS_STORAGE_KEY),
      JSON.stringify(versions),
    );
  } catch {
    // Versions are recovered from Supabase on the next sign-in.
  }
}

function isActive(): boolean {
  return (
    isAuthConfigured() &&
    confirmed !== null &&
    workspace !== null &&
    workspace === getActiveWorkspaceId()
  );
}

/** Called by every write to the browser copy of commercial collections. */
export function notifyLocalCommercialWrite(): void {
  if (applying || !isActive() || scheduled) return;
  scheduled = true;
  // Let the whole user operation (several writes in the same tick) finish first.
  setTimeout(() => {
    scheduled = false;
    void flushRemoteCommercialChanges();
  }, 0);
}

function restore(changedOpportunities: string[], changedActivities: string[]): void {
  const snapshot = confirmed!;
  const restoreCollection = (key: string, ids: string[], previous: Map<string, string>) => {
    const changed = new Set(ids);
    const records = readRaw(key)
      .filter((value) => !changed.has(idOf(value)) || previous.has(idOf(value)))
      .map((value) =>
        changed.has(idOf(value)) ? (JSON.parse(previous.get(idOf(value))!) as unknown) : value,
      );
    writeRaw(key, records);
  };
  restoreCollection(OPPORTUNITIES_STORAGE_KEY, changedOpportunities, snapshot.opportunities);
  restoreCollection(ACTIVITIES_STORAGE_KEY, changedActivities, snapshot.activities);
}

function dispatch(event: Event): void {
  if (typeof window !== 'undefined') window.dispatchEvent(event);
}

function failureMessage(code: string): string {
  if (code === 'CONFLICT')
    return 'No se guardó el último cambio: otra persona modificó esta oportunidad. Recargá la página para ver la versión actual.';
  if (code === 'MISSING_REFERENCE')
    return 'No se guardó el último cambio: el contacto o la oportunidad todavía no existe en Supabase. Recargá la página.';
  return 'No se guardó el último cambio porque no hay conexión con Supabase. Revisá la conexión y volvé a intentar.';
}

export async function flushRemoteCommercialChanges(): Promise<void> {
  if (inFlight) {
    await inFlight;
    if (scheduled) return;
  }
  if (!isActive()) return;
  inFlight = (async () => {
    const before = confirmed!;
    const current = takeSnapshot();
    const changedOpportunities = [...current.opportunities]
      .filter(([id, json]) => before.opportunities.get(id) !== json)
      .map(([id]) => id);
    const changedActivities = [...current.activities]
      .filter(([id, json]) => before.activities.get(id) !== json)
      .map(([id]) => id);
    if (!changedOpportunities.length && !changedActivities.length) return;

    const versions = readVersions();
    const opportunities = changedOpportunities.map(
      (id) => JSON.parse(current.opportunities.get(id)!) as Opportunity,
    );
    const activities = changedActivities.map(
      (id) => JSON.parse(current.activities.get(id)!) as Activity,
    );
    // Contacts created in the browser together with these records (e.g. a direct client).
    const neededClientIds = new Set([
      ...opportunities.map((item) => item.clientId),
      ...activities.flatMap((item) =>
        item.subject.kind === 'client' ? [item.subject.clientId] : [],
      ),
    ]);
    const contacts = readRaw(CLIENTS_STORAGE_KEY).filter(
      (value): value is Client =>
        isClient(value) && neededClientIds.has(value.id) && value.version === undefined,
    );
    let code: string;
    try {
      const result = await syncRemoteCommercialRecords({
        workspaceId: workspace!,
        contacts,
        opportunities: opportunities.map((item) => ({
          expectedVersion: versions[item.id] ?? null,
          data: item,
        })),
        activities,
      });
      if (result.ok) {
        writeVersions({ ...versions, ...result.versions });
        // The confirmed state now includes these records.
        for (const id of changedOpportunities)
          before.opportunities.set(id, current.opportunities.get(id)!);
        for (const id of changedActivities) before.activities.set(id, current.activities.get(id)!);
        dispatch(new Event(REMOTE_SYNC_APPLIED_EVENT));
        return;
      }
      code = result.code;
    } catch {
      code = 'NETWORK';
    }
    restore(changedOpportunities, changedActivities);
    dispatch(new CustomEvent(REMOTE_SYNC_FAILED_EVENT, { detail: failureMessage(code) }));
    dispatch(new Event('activitiesupdated'));
  })();
  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}

/**
 * Loads opportunities and their activity from Supabase into the browser copy and starts
 * syncing. Remote records replace their local copy; records that cannot exist in Supabase yet
 * (quote activity, legacy ids) stay as they are.
 */
export async function startRemoteCommercialSync(workspaceId: string): Promise<void> {
  confirmed = null;
  workspace = workspaceId;
  if (!isAuthConfigured() || !isWorkspaceUuid(workspaceId)) return;
  try {
    const [opportunityRows, activityRows] = await Promise.all([
      loadRemoteOpportunities(workspaceId),
      loadRemoteCommercialActivities(workspaceId),
    ]);
    if (workspace !== workspaceId) return;
    const remoteOpportunities = opportunityRows.map(mapRemoteOpportunity).filter(isOpportunity);
    const remoteActivities = activityRows.map(mapRemoteCommercialActivity).filter(isActivity);
    const merge = (key: string, remote: { id: string }[]) => {
      const byId = new Map(remote.map((item) => [item.id, item as unknown]));
      const kept = readRaw(key).filter((value) => !byId.has(idOf(value)));
      writeRaw(key, [...kept, ...byId.values()]);
    };
    merge(OPPORTUNITIES_STORAGE_KEY, remoteOpportunities);
    merge(ACTIVITIES_STORAGE_KEY, remoteActivities);
    writeVersions({
      ...readVersions(),
      ...Object.fromEntries(opportunityRows.map((row) => [row.id, row.version])),
    });
  } catch {
    // Offline at sign-in: keep the browser copy; writes still require Supabase.
  }
  if (workspace === workspaceId) confirmed = takeSnapshot();
}

/** Test helper: forget the sync state. */
export function resetRemoteCommercialSync(): void {
  workspace = null;
  confirmed = null;
  scheduled = false;
  inFlight = null;
}
