import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prospect } from '../types/prospect';
import {
  createNewProspect,
  isProspectContactAvailable,
  loadProspects,
  mergeRemoteProspectsWithLocal,
  saveProspect,
  saveProspectWithResult,
  PROSPECTS_STORAGE_KEY,
} from './prospectStorage';

const prospect: Prospect = {
  id: 'prospect',
  name: 'Ana',
  company: '',
  phone: '1111111111',
  email: 'none',
  source: '',
  potentialService: '',
  notes: '',
  status: 'uncontacted',
  priority: 'medium',
  priorityReason: 'Manual',
  nextAction: '',
  nextActionAt: '',
  responsible: '',
  preferredChannel: '',
  activities: [],
  createdAt: '2026-10-15T00:00:00Z',
  updatedAt: '2026-10-15T00:00:00Z',
};
const stored = new Map<string, string>();
describe('prospect storage', () => {
  beforeEach(() => {
    stored.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it('persists an independent prospect collection and treats pending values as unavailable', () => {
    expect(saveProspect(prospect)).toBe(true);
    expect(loadProspects().items).toEqual([{ ...prospect, instagram: '', address: '' }]);
    expect(isProspectContactAvailable(prospect, 'phone')).toBe(false);
    expect(isProspectContactAvailable(prospect, 'email')).toBe(false);
    expect(isProspectContactAvailable({ ...prospect, instagram: '@ingenya' }, 'instagram')).toBe(
      true,
    );
    expect(stored.get(PROSPECTS_STORAGE_KEY)).toContain('prospect');
  });
  it('creates a clean manual prospect with the automatic initial state', () => {
    const created = createNewProspect();
    expect(created).toMatchObject({ status: 'uncontacted', activities: [], priority: 'medium' });
    expect(loadProspects().items).toEqual([]);
  });
  it('keeps persisted prospect actions after loading the collection again', () => {
    const withAction: Prospect = {
      ...prospect,
      activities: [
        {
          id: 'action-1',
          prospectId: prospect.id,
          occurredAt: '2026-10-15T10:00:00Z',
          createdAt: '2026-10-15T10:00:00Z',
          type: 'contactResult',
          description: 'WhatsApp: Contactado.',
          result: 'contacted',
          channel: 'whatsapp',
        },
      ],
    };
    expect(saveProspect(withAction)).toBe(true);
    expect(loadProspects().items[0].activities).toHaveLength(1);
    expect(loadProspects().items[0].activities[0]).toMatchObject({
      prospectId: prospect.id,
      channel: 'whatsapp',
      result: 'contacted',
    });
  });
  it('reports a persistence error instead of reporting a false save', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('Storage blocked');
      },
    });
    expect(saveProspectWithResult(prospect)).toMatchObject({
      ok: false,
      reason: 'storage_write_failed',
    });
  });

  it('keeps local-only prospects visible when a remote snapshot is incomplete', () => {
    const remoteProspect: Prospect = { ...prospect, name: 'Ana remota', version: 2 };
    const localOnly: Prospect = { ...prospect, id: 'local-only', name: 'Camila QA' };

    expect(mergeRemoteProspectsWithLocal([remoteProspect], [prospect, localOnly])).toEqual([
      remoteProspect,
      localOnly,
    ]);
  });
});
