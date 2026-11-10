import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Activity, ActivitySubject } from '../types/activity';
import type { Client } from '../types/client';
import type { Opportunity } from '../types/opportunity';
import { appendActivityNoteRevision, loadActivities, saveActivity } from './activityStorage';
import { getTimelineActivities } from './activityTimeline';
import {
  createNoteRevision,
  currentActivityNote,
  getPreviousNoteVersions,
} from './activityNoteEditing';
import { saveClient } from './clientStorage';
import { saveOpportunity } from './opportunityStorage';
import {
  flushRemoteCommercialChanges,
  REMOTE_SYNC_FAILED_EVENT,
  resetRemoteCommercialSync,
  startRemoteCommercialSync,
} from './remoteCommercialSync';
import {
  flushRemoteDocumentChanges,
  resetRemoteDocumentSync,
  startRemoteDocumentSync,
} from './remoteDocumentSync';

/**
 * Notes must survive a reload and be the same in every browser of the workspace.
 *
 * The fake Supabase below keeps what the migrations keep (checked against the real SQL on
 * 2026-11-10): `sync_commercial_records` inserts an activity once and afterwards only replaces
 * `note_revisions`, so the `note` column keeps the first text; `sync_workspace_documents`
 * stores quote activity as a versioned document and rejects a stale version.
 */

const WS = '2c90217f-f297-4a5f-a91e-20e4962a8df2';
const now = '2026-11-10T12:00:00.000Z';
const client: Client = {
  id: 'a0000000-0000-4000-8000-000000000001',
  name: 'Cliente QA',
  phone: '3415550111',
  email: 'none',
  preferredChannel: '',
  contactConsent: false,
  createdAt: now,
  updatedAt: now,
};
const opportunity: Opportunity = {
  id: 'b0000000-0000-4000-8000-000000000001',
  clientId: client.id,
  name: 'Obra QA',
  address: '',
  estimatedStartDate: '',
  responsibleSeller: 'Daniel',
  createdAt: now,
  updatedAt: now,
};
const opportunitySubject: ActivitySubject = { kind: 'opportunity', opportunityId: opportunity.id };
const quoteSubject: ActivitySubject = { kind: 'quote', quoteId: 'PRES-2026-0001' };

function note(id: string, subject: ActivitySubject, text: string): Activity {
  return {
    id,
    type: 'note',
    occurredAt: now,
    author: 'Daniel',
    result: 'Nota registrada',
    note: text,
    subject,
    source: 'manual',
    noteRevisions: [],
  };
}

/** Postgres returns timestamps as "+00:00", not ".000Z"; the app must accept both. */
const pgTime = (iso: string) => iso.replace('.000Z', '+00:00');

type ActivityRow = Record<string, unknown> & { id: string; note_revisions: unknown[] };
type DocumentRow = { collection: string; id: string; data: unknown; version: number };

let activityRows: Map<string, ActivityRow>;
let opportunityRows: Map<string, Record<string, unknown>>;
let documentRows: Map<string, DocumentRow>;
let offline: boolean;
const local = new Map<string, string>();
const session = new Map<string, string>();
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

function fakeSupabase(url: string, init?: RequestInit): Promise<Response> {
  if (offline) return Promise.reject(new TypeError('Failed to fetch'));
  const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
  if (url.includes('/rpc/sync_commercial_records')) {
    const versions: Record<string, number> = {};
    for (const { data } of body.p_opportunities as { data: Opportunity }[]) {
      const version = Number(opportunityRows.get(data.id)?.version ?? 0) + 1;
      opportunityRows.set(data.id, {
        id: data.id,
        workspace_id: WS,
        contact_id: data.clientId,
        name: data.name,
        address: data.address,
        estimated_start_date: null,
        responsible_seller: data.responsibleSeller,
        origin: null,
        status: 'active',
        commercial_state: 'open',
        pipeline_stage: 'opportunity',
        document: data,
        version,
        archived_at: null,
        created_at: pgTime(data.createdAt),
        updated_at: pgTime(data.updatedAt),
      });
      versions[data.id] = version;
    }
    for (const item of body.p_activities as Activity[]) {
      const existing = activityRows.get(item.id);
      if (existing) {
        existing.note_revisions = item.noteRevisions; // `on conflict do update set note_revisions`
        continue;
      }
      activityRows.set(item.id, {
        id: item.id,
        workspace_id: WS,
        contact_id: item.subject.kind === 'client' ? item.subject.clientId : null,
        opportunity_id: item.subject.kind === 'opportunity' ? item.subject.opportunityId : null,
        type: item.type,
        occurred_at: pgTime(item.occurredAt),
        author_name: item.author,
        result: item.result,
        note: item.note,
        source: item.source,
        event: item.event ?? null,
        communication: item.communication ?? null,
        note_revisions: item.noteRevisions,
      });
    }
    return Promise.resolve(json({ code: 'OK', versions }));
  }
  if (url.includes('/rpc/sync_workspace_documents')) {
    const changes = body.p_changes as {
      collection: string;
      id: string;
      expectedVersion: number | null;
      data: unknown;
    }[];
    const versions: Record<string, number> = {};
    for (const change of changes) {
      const key = `${change.collection}:${change.id}`;
      if ((change.expectedVersion ?? 0) !== (documentRows.get(key)?.version ?? 0))
        return Promise.resolve(json({ code: 'CONFLICT' }));
    }
    for (const change of changes) {
      const key = `${change.collection}:${change.id}`;
      const version = (documentRows.get(key)?.version ?? 0) + 1;
      documentRows.set(key, { ...change, version });
      versions[key] = version;
    }
    return Promise.resolve(json({ code: 'OK', versions }));
  }
  if (url.includes('/rest/v1/activities')) return Promise.resolve(json([...activityRows.values()]));
  if (url.includes('/rest/v1/opportunities'))
    return Promise.resolve(json([...opportunityRows.values()]));
  if (url.includes('/rest/v1/workspace_documents'))
    return Promise.resolve(
      json([...documentRows.values()].map((row) => ({ ...row, deleted_at: null }))),
    );
  return Promise.resolve(json([]));
}

/** A different browser (or the same one after clearing its data) signs in to the workspace. */
async function openInAnotherBrowser(): Promise<void> {
  local.clear();
  resetRemoteCommercialSync();
  resetRemoteDocumentSync();
  await startRemoteCommercialSync(WS);
  await startRemoteDocumentSync(WS);
}

function editNote(id: string, text: string, editor: string, editedAt: string): boolean {
  const activity = loadActivities().items.find((item) => item.id === id)!;
  return appendActivityNoteRevision(id, createNoteRevision(activity, text, editor, editedAt));
}

const shownNotes = (subject: ActivitySubject) =>
  getTimelineActivities(loadActivities().items, subject, 'note').map(currentActivityNote);

beforeEach(() => {
  activityRows = new Map();
  opportunityRows = new Map();
  documentRows = new Map();
  offline = false;
  local.clear();
  session.clear();
  resetRemoteCommercialSync();
  resetRemoteDocumentSync();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon');
  vi.stubGlobal('fetch', vi.fn(fakeSupabase));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => local.get(key) ?? null,
    setItem: (key: string, value: string) => local.set(key, value),
    removeItem: (key: string) => local.delete(key),
  });
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => session.get(key) ?? null,
    setItem: (key: string, value: string) => session.set(key, value),
    removeItem: (key: string) => session.delete(key),
  });
  vi.stubGlobal('window', new EventTarget());
  session.set('ingenya.activeWorkspace.v1', WS);
  session.set(
    'ingenya.auth.session.v1',
    JSON.stringify({ accessToken: 't', expiresAt: Date.now() + 60_000, userId: 'u', email: '' }),
  );
});
afterEach(() => {
  resetRemoteCommercialSync();
  resetRemoteDocumentSync();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('note persistence across browsers', () => {
  it('keeps an opportunity note and its edits from another browser after reloading', async () => {
    await startRemoteCommercialSync(WS);
    saveClient(client);
    saveOpportunity(opportunity);
    const text = 'Pidió cotizar también el baño 🛁 — «urgente»\nSegunda línea';
    saveActivity(note('c0000000-0000-4000-8000-000000000001', opportunitySubject, text));
    await flushRemoteCommercialChanges();

    await openInAnotherBrowser();
    expect(shownNotes(opportunitySubject)).toEqual([text]);

    // Edited in the second browser, after its copy came from Supabase.
    editNote(
      'c0000000-0000-4000-8000-000000000001',
      'Baño para marzo',
      'Lucía',
      '2026-11-10T13:00:00.000Z',
    );
    await flushRemoteCommercialChanges();
    editNote(
      'c0000000-0000-4000-8000-000000000001',
      'Baño para abril',
      'Daniel',
      '2026-11-10T14:00:00.000Z',
    );
    await flushRemoteCommercialChanges();

    await openInAnotherBrowser();
    const [stored] = getTimelineActivities(loadActivities().items, opportunitySubject, 'note');
    expect(currentActivityNote(stored)).toBe('Baño para abril');
    expect(getPreviousNoteVersions(stored)).toEqual([
      { text: 'Baño para marzo', replacedAt: '2026-11-10T14:00:00.000Z', replacedBy: 'Daniel' },
      { text, replacedAt: '2026-11-10T13:00:00.000Z', replacedBy: 'Lucía' },
    ]);
    // Supabase still has the first text in `note`; only the edits moved.
    expect(activityRows.get(stored.id)?.note).toBe(text);
  });

  it('keeps a client note after reloading', async () => {
    await startRemoteCommercialSync(WS);
    saveClient(client);
    const clientSubject: ActivitySubject = { kind: 'client', clientId: client.id };
    saveActivity(
      note('c0000000-0000-4000-8000-000000000002', clientSubject, 'Llamar después de las 18'),
    );
    await flushRemoteCommercialChanges();

    await openInAnotherBrowser();
    expect(shownNotes(clientSubject)).toEqual(['Llamar después de las 18']);
  });

  it('does not keep a note edit that Supabase did not receive', async () => {
    await startRemoteCommercialSync(WS);
    saveClient(client);
    saveOpportunity(opportunity);
    saveActivity(
      note('c0000000-0000-4000-8000-000000000003', opportunitySubject, 'Texto guardado'),
    );
    await flushRemoteCommercialChanges();
    const messages: string[] = [];
    window.addEventListener(REMOTE_SYNC_FAILED_EVENT, (event) =>
      messages.push((event as CustomEvent<string>).detail),
    );

    offline = true;
    editNote(
      'c0000000-0000-4000-8000-000000000003',
      'Edición sin conexión',
      'Daniel',
      '2026-11-10T13:00:00.000Z',
    );
    await flushRemoteCommercialChanges();

    expect(shownNotes(opportunitySubject)).toEqual(['Texto guardado']);
    expect(messages).toEqual([expect.stringMatching(/no hay conexión con Supabase/)]);
    offline = false;
    await openInAnotherBrowser();
    expect(shownNotes(opportunitySubject)).toEqual(['Texto guardado']);
  });

  it('keeps a quote note and its edit after reloading', async () => {
    await startRemoteDocumentSync(WS);
    saveActivity(
      note('c0000000-0000-4000-8000-000000000004', quoteSubject, 'Pidió 10% de descuento'),
    );
    await flushRemoteDocumentChanges();
    editNote(
      'c0000000-0000-4000-8000-000000000004',
      'Se aprobó 5%',
      'Daniel',
      '2026-11-10T13:00:00.000Z',
    );
    await flushRemoteDocumentChanges();

    await openInAnotherBrowser();
    const [stored] = getTimelineActivities(loadActivities().items, quoteSubject, 'note');
    expect(currentActivityNote(stored)).toBe('Se aprobó 5%');
    expect(getPreviousNoteVersions(stored).map((version) => version.text)).toEqual([
      'Pidió 10% de descuento',
    ]);
  });
});
