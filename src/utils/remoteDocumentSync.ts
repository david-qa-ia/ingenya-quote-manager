import { isActivity, ACTIVITIES_STORAGE_KEY } from './activityStorage';
import { isAuthConfigured } from './authService';
import { CADENCE_EXECUTIONS_STORAGE_KEY, CADENCE_TEMPLATES_STORAGE_KEY } from './cadenceStorage';
import { COMMERCIAL_OUTCOMES_STORAGE_KEY } from './commercialOutcomeStorage';
import { CONTACT_SCRIPTS_STORAGE_KEY } from './contactScriptStorage';
import { LABOR_CATALOG_STORAGE_KEY } from './jobCatalogStorage';
import { SAVED_QUOTES_STORAGE_KEY } from './quoteDraftStorage';
import { REMOTE_SYNC_APPLIED_EVENT, REMOTE_SYNC_FAILED_EVENT } from './remoteCommercialSync';
import {
  loadRemoteDocuments,
  syncRemoteDocuments,
  type DocumentCollection,
  type RemoteDocumentChange,
} from './supabaseRepository';
import { getActiveWorkspaceId, isWorkspaceUuid, workspaceStorageKey } from './workspaceStorage';

/**
 * SCRUM-123: quotes, the catalog, contact scripts, cadences, commercial outcomes and quote
 * activity live in Supabase (`workspace_documents`), so every member of the workspace sees the
 * same data from any browser.
 *
 * Same model as opportunities (SCRUM-114): the browser keeps a copy; after each write the
 * changed records are compared with the state Supabase confirmed and sent in one atomic call.
 * If Supabase rejects them or cannot be reached, the copy goes back to the confirmed state and
 * `ventro:remote-sync-failed` is shown. Records that only existed in this browser are uploaded
 * the first time the workspace is opened.
 */

export const DOCUMENT_VERSIONS_STORAGE_KEY = 'ingenya.documentVersions.v1';
export const REMOTE_DOCUMENTS_LOADED_EVENT = 'ventro:remote-documents-loaded';
const MAX_CHANGES_PER_CALL = 400;
const SAFETY_CHECK_MS = 4000;

interface CollectionSpec {
  collection: DocumentCollection;
  storageKey: string;
  /** Which records of the stored array belong to this collection. */
  accepts: (value: unknown) => boolean;
}

const hasId = (value: unknown): value is { id: string } =>
  typeof value === 'object' &&
  value !== null &&
  'id' in value &&
  typeof (value as { id: unknown }).id === 'string' &&
  (value as { id: string }).id.length > 0 &&
  (value as { id: string }).id.length <= 120;

const specs: readonly CollectionSpec[] = [
  { collection: 'savedQuotes', storageKey: SAVED_QUOTES_STORAGE_KEY, accepts: hasId },
  { collection: 'laborCatalog', storageKey: LABOR_CATALOG_STORAGE_KEY, accepts: hasId },
  { collection: 'contactScripts', storageKey: CONTACT_SCRIPTS_STORAGE_KEY, accepts: hasId },
  { collection: 'cadenceTemplates', storageKey: CADENCE_TEMPLATES_STORAGE_KEY, accepts: hasId },
  { collection: 'cadenceExecutions', storageKey: CADENCE_EXECUTIONS_STORAGE_KEY, accepts: hasId },
  {
    collection: 'commercialOutcomes',
    storageKey: COMMERCIAL_OUTCOMES_STORAGE_KEY,
    accepts: hasId,
  },
  // Contact and opportunity activity already sync with opportunities (SCRUM-114).
  {
    collection: 'quoteActivities',
    storageKey: ACTIVITIES_STORAGE_KEY,
    accepts: (value) => hasId(value) && isActivity(value) && value.subject.kind === 'quote',
  },
];

const docKey = (collection: DocumentCollection, id: string) => `${collection}:${id}`;

type Snapshot = Map<string, string>;

let workspace: string | null = null;
let confirmed: Snapshot | null = null;
let applying = false;
let scheduled = false;
let inFlight: Promise<void> | null = null;
let safetyTimer: ReturnType<typeof setInterval> | null = null;

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

function takeSnapshot(): Snapshot {
  const snapshot: Snapshot = new Map();
  for (const spec of specs)
    for (const value of readRaw(spec.storageKey))
      if (spec.accepts(value))
        snapshot.set(docKey(spec.collection, (value as { id: string }).id), JSON.stringify(value));
  return snapshot;
}

function readVersions(): Record<string, number> {
  try {
    const raw = localStorage.getItem(workspaceStorageKey(DOCUMENT_VERSIONS_STORAGE_KEY));
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
      workspaceStorageKey(DOCUMENT_VERSIONS_STORAGE_KEY),
      JSON.stringify(versions),
    );
  } catch {
    // Versions are read again from Supabase the next time the workspace opens.
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

function dispatch(event: Event): void {
  if (typeof window !== 'undefined') window.dispatchEvent(event);
}

/** Called after every write to the browser copy (and periodically as a safety net). */
export function notifyLocalDocumentWrite(): void {
  if (applying || !isActive() || scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    void flushRemoteDocumentChanges();
  }, 0);
}

/** Puts the given documents back to the state Supabase confirmed. */
function restore(keys: string[]): void {
  const previous = confirmed!;
  const pending = new Set(keys);
  for (const spec of specs) {
    const prefix = `${spec.collection}:`;
    const touched = keys.filter((key) => key.startsWith(prefix));
    if (!touched.length) continue;
    const present = new Set<string>();
    const records = readRaw(spec.storageKey).flatMap((value) => {
      if (!spec.accepts(value)) return [value];
      const key = docKey(spec.collection, (value as { id: string }).id);
      if (!pending.has(key)) return [value];
      present.add(key);
      const before = previous.get(key);
      return before ? [JSON.parse(before) as unknown] : [];
    });
    // Records deleted locally but still confirmed come back.
    for (const key of touched)
      if (!present.has(key) && previous.has(key))
        records.push(JSON.parse(previous.get(key)!) as unknown);
    writeRaw(spec.storageKey, records);
  }
}

function failureMessage(code: string): string {
  if (code === 'CONFLICT')
    return 'No se guardó el último cambio: otra persona modificó el mismo presupuesto o registro. Recargá la página para ver la versión actual.';
  if (code === 'VALIDATION')
    return 'No se guardó el último cambio porque Supabase lo rechazó. Recargá la página y volvé a intentar.';
  return 'No se guardó el último cambio porque no hay conexión con Supabase. Revisá la conexión y volvé a intentar.';
}

export async function flushRemoteDocumentChanges(): Promise<void> {
  if (inFlight) {
    await inFlight;
    if (scheduled) return;
  }
  if (!isActive()) return;
  inFlight = (async () => {
    const before = confirmed!;
    const current = takeSnapshot();
    const changed = [...current].filter(([key, json]) => before.get(key) !== json).map(([k]) => k);
    const deleted = [...before.keys()].filter((key) => !current.has(key));
    const keys = [...changed, ...deleted];
    if (!keys.length) return;
    const versions = readVersions();
    for (let start = 0; start < keys.length; start += MAX_CHANGES_PER_CALL) {
      const batch = keys.slice(start, start + MAX_CHANGES_PER_CALL);
      const changes: RemoteDocumentChange[] = batch.map((key) => {
        const separator = key.indexOf(':');
        const json = current.get(key);
        return {
          collection: key.slice(0, separator) as DocumentCollection,
          id: key.slice(separator + 1),
          expectedVersion: versions[key] ?? null,
          data: json === undefined ? null : (JSON.parse(json) as unknown),
        };
      });
      let code: string;
      try {
        const result = await syncRemoteDocuments(workspace!, changes);
        if (result.ok) {
          Object.assign(versions, result.versions);
          writeVersions(versions);
          for (const key of batch) {
            const json = current.get(key);
            if (json === undefined) before.delete(key);
            else before.set(key, json);
          }
          continue;
        }
        code = result.code;
      } catch {
        code = 'NETWORK';
      }
      // This batch and the ones not sent yet go back to what Supabase has.
      restore(keys.slice(start));
      dispatch(new CustomEvent(REMOTE_SYNC_FAILED_EVENT, { detail: failureMessage(code) }));
      dispatch(new Event(REMOTE_DOCUMENTS_LOADED_EVENT));
      dispatch(new Event('activitiesupdated'));
      return;
    }
    dispatch(new Event(REMOTE_SYNC_APPLIED_EVENT));
  })();
  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}

/**
 * Loads the workspace documents from Supabase into the browser copy and starts syncing.
 * Remote records replace their local copy, deleted ones leave the browser, and records that
 * only exist in this browser are uploaded right after (first use of SCRUM-123).
 */
export async function startRemoteDocumentSync(workspaceId: string): Promise<void> {
  confirmed = null;
  workspace = workspaceId;
  if (!isAuthConfigured() || !isWorkspaceUuid(workspaceId)) return;
  let remoteSnapshot: Snapshot;
  try {
    const rows = await loadRemoteDocuments(workspaceId);
    if (workspace !== workspaceId) return;
    remoteSnapshot = new Map();
    const versions: Record<string, number> = {};
    for (const spec of specs) {
      const live = new Map<string, unknown>();
      const gone = new Set<string>();
      for (const row of rows) {
        if (row.collection !== spec.collection) continue;
        versions[docKey(row.collection, row.id)] = row.version;
        if (row.deleted_at || !spec.accepts(row.data)) gone.add(row.id);
        else live.set(row.id, row.data);
      }
      const kept: unknown[] = [];
      for (const value of readRaw(spec.storageKey)) {
        if (!spec.accepts(value)) {
          kept.push(value);
          continue;
        }
        const id = (value as { id: string }).id;
        if (!live.has(id) && !gone.has(id)) kept.push(value); // Only in this browser: upload.
      }
      for (const [id, data] of live)
        remoteSnapshot.set(docKey(spec.collection, id), JSON.stringify(data));
      // A collection never used in this browser nor in Supabase stays unwritten, so its own
      // first load still applies defaults (e.g. the starter catalog), which are uploaded later.
      const stored = localStorage.getItem(workspaceStorageKey(spec.storageKey)) !== null;
      if (stored || live.size || gone.size) writeRaw(spec.storageKey, [...kept, ...live.values()]);
    }
    writeVersions(versions);
  } catch {
    // Offline when opening: keep working on the browser copy; it is compared with Supabase and
    // uploaded the next time the workspace opens with a connection.
    return;
  }
  if (workspace !== workspaceId) return;
  confirmed = remoteSnapshot;
  dispatch(new Event(REMOTE_DOCUMENTS_LOADED_EVENT));
  if (safetyTimer === null && typeof window !== 'undefined')
    safetyTimer = setInterval(notifyLocalDocumentWrite, SAFETY_CHECK_MS);
  await flushRemoteDocumentChanges();
}

/** True while some change is not confirmed by Supabase yet (used before signing out). */
export function hasPendingDocumentChanges(): boolean {
  if (!isActive()) return false;
  const current = takeSnapshot();
  const before = confirmed!;
  if (current.size !== before.size) return true;
  for (const [key, json] of current) if (before.get(key) !== json) return true;
  return false;
}

/** Stops syncing (sign-out, tests). */
export function resetRemoteDocumentSync(): void {
  workspace = null;
  confirmed = null;
  scheduled = false;
  inFlight = null;
  if (safetyTimer !== null) clearInterval(safetyTimer);
  safetyTimer = null;
}
