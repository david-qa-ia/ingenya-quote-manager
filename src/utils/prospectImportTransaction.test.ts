import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { previewProspectCsv } from './prospectImport';
import {
  clearProspectImportRecovery,
  loadProspectImportRecovery,
  prepareProspectImport,
  savePreparedProspectImport,
  saveProspectImportRecovery,
} from './prospectImportTransaction';
import { loadProspects } from './prospectStorage';
import { deriveFollowUpInbox } from './followUpInbox';

const stored = new Map<string, string>();
const session = new Map<string, string>();
let failWrites = false;
beforeEach(() => {
  stored.clear();
  session.clear();
  failWrites = false;
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (failWrites) throw new Error('blocked');
      stored.set(key, value);
    },
    removeItem: (key: string) => stored.delete(key),
  });
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => session.get(key) ?? null,
    setItem: (key: string, value: string) => session.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());

const rows = previewProspectCsv(
  'name,company,phone,email,source,potentialService,notes\nAna,Sur,3415550101,ana@sur.com,Web,Pintura,\nBea,Norte,,bea@norte.com,Web,Obra,',
  [],
);

describe('prospect import transaction', () => {
  it.each(['phone', 'whatsapp', 'email'] as const)(
    'schedules only compatible %s contacts',
    (channel) => {
      const prepared = prepareProspectImport(
        rows,
        {
          schedule: true,
          channel,
          dueAt: '2026-10-21T13:00:00.000Z',
          responsible: 'David',
          note: 'Primer contacto',
        },
        `import-${channel}`,
        '2026-10-20T10:00:00.000Z',
      );
      expect(prepared.prospects).toHaveLength(2);
      expect(prepared.scheduledCount).toBe(channel === 'email' ? 2 : 1);
    },
  );
  it('imports without scheduling and refuses to duplicate a retry with the same prepared batch', () => {
    const prepared = prepareProspectImport(
      rows,
      {
        schedule: false,
        channel: 'whatsapp',
        dueAt: '',
        responsible: '',
        note: '',
      },
      'import-without-schedule',
      '2026-10-20T10:00:00.000Z',
    );
    expect(savePreparedProspectImport(prepared)).toBe(true);
    expect(savePreparedProspectImport(prepared)).toBe(false);
    expect(loadProspects().items).toHaveLength(2);
    expect(loadProspects().items.every((prospect) => !prospect.nextActionAt)).toBe(true);
  });
  it('keeps recovery data across refresh and clears it only after recovery', () => {
    const prepared = prepareProspectImport(
      rows,
      {
        schedule: true,
        channel: 'whatsapp',
        dueAt: '2026-10-21T13:00:00.000Z',
        responsible: 'David',
        note: '',
      },
      'recoverable-import',
      '2026-10-20T10:00:00.000Z',
    );
    expect(
      saveProspectImportRecovery({
        importKey: prepared.importKey,
        fileName: 'prospectos.csv',
        csv: 'csv',
        config: {
          schedule: true,
          channel: 'whatsapp',
          dueAt: '2026-10-21T13:00:00.000Z',
          responsible: 'David',
          note: '',
        },
        prepared,
        phase: 'remoteConfirmed',
      }),
    ).toBe(true);
    expect(loadProspectImportRecovery()?.importKey).toBe('recoverable-import');
    clearProspectImportRecovery();
    expect(loadProspectImportRecovery()).toBeNull();
  });
  it('does not leave prospects or first actions when local persistence fails', () => {
    const prepared = prepareProspectImport(
      rows,
      {
        schedule: true,
        channel: 'whatsapp',
        dueAt: '2026-10-21T13:00:00.000Z',
        responsible: 'David',
        note: '',
      },
      'failed-import',
      '2026-10-20T10:00:00.000Z',
    );
    failWrites = true;
    expect(savePreparedProspectImport(prepared)).toBe(false);
    failWrites = false;
    expect(loadProspects().items).toEqual([]);
  });
  it('isolates a prepared import by active workspace', () => {
    const prepared = prepareProspectImport(
      rows,
      { schedule: false, channel: 'whatsapp', dueAt: '', responsible: '', note: '' },
      'workspace-import',
      '2026-10-20T10:00:00.000Z',
    );
    session.set('ingenya.activeWorkspace.v1', 'workspace-a');
    expect(savePreparedProspectImport(prepared)).toBe(true);
    session.set('ingenya.activeWorkspace.v1', 'workspace-b');
    expect(loadProspects().items).toEqual([]);
  });
  it('derives each scheduled import once for the shared inboxes', () => {
    const prepared = prepareProspectImport(
      rows,
      {
        schedule: true,
        channel: 'whatsapp',
        dueAt: '2026-10-21T13:00:00.000Z',
        responsible: 'David',
        note: '',
      },
      'inbox-import',
      '2026-10-20T10:00:00.000Z',
    );
    const inbox = deriveFollowUpInbox(
      [],
      [],
      [],
      [],
      [],
      new Date('2026-10-20T12:00:00.000Z'),
      prepared.prospects,
    );
    expect(inbox).toHaveLength(1);
    expect(inbox[0].subjectType).toBe('prospect');
  });
});
