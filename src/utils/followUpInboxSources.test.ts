import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ACTIVITIES_STORAGE_KEY } from './activityStorage';
import { CLIENTS_STORAGE_KEY } from './clientStorage';
import { loadFollowUpInbox } from './followUpInboxSources';
import { OPPORTUNITIES_STORAGE_KEY } from './opportunityStorage';

const stored = new Map<string, string>();
const at = '2026-11-09T12:00:00.000Z';

beforeEach(() => {
  stored.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  });
  stored.set(
    CLIENTS_STORAGE_KEY,
    JSON.stringify([
      {
        id: 'client',
        name: 'Ana',
        phone: '3415550101',
        email: 'ana@example.com',
        preferredChannel: '',
        contactConsent: true,
        createdAt: at,
        updatedAt: at,
      },
    ]),
  );
  stored.set(
    OPPORTUNITIES_STORAGE_KEY,
    JSON.stringify([
      {
        id: 'opportunity',
        clientId: 'client',
        name: 'Obra Norte',
        address: '',
        estimatedStartDate: '',
        responsibleSeller: 'Daniel',
        status: 'active',
        createdAt: at,
        updatedAt: at,
      },
    ]),
  );
});

describe('loadFollowUpInbox', () => {
  it('lists the jobs to contact from the browser copy', () => {
    const inbox = loadFollowUpInbox([], [], new Date(at));
    expect(inbox.items.map((item) => item.opportunityName)).toEqual(['Obra Norte']);
    expect(inbox.issues).toEqual([]);
  });

  it('reports a store that cannot be read and still shows the valid jobs', () => {
    stored.set(ACTIVITIES_STORAGE_KEY, '{not json');
    const inbox = loadFollowUpInbox([], [], new Date(at));
    expect(inbox.items).toHaveLength(1);
    expect(inbox.issues).toHaveLength(1);
  });
});
