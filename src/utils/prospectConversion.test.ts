import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prospect } from '../types/prospect';
import { loadClients, saveClient } from './clientStorage';
import { loadActivities } from './activityStorage';
import { loadOpportunities, OPPORTUNITIES_STORAGE_KEY } from './opportunityStorage';
import { deriveFollowUpInbox } from './followUpInbox';
import {
  canQualifyProspect,
  createPendingProspectConversion,
  getProspectConversionValidationError,
  resumeProspectConversion,
  withRemoteConversionIds,
} from './prospectConversion';
import { loadProspects, PROSPECTS_STORAGE_KEY, saveProspectWithResult } from './prospectStorage';
import { localDateTimeToIso } from './prospectFollowUp';
import { getDueGroup } from './prospectWorkflow';

const stored = new Map<string, string>();
const prospect: Prospect = {
  id: 'prospect',
  name: 'Ana',
  company: 'Sur',
  phone: '3415550101',
  email: 'ana@sur.com',
  source: '',
  potentialService: 'Pintura',
  notes: '',
  status: 'contacted',
  priority: 'medium',
  priorityReason: '',
  nextAction: 'Llamar',
  nextActionAt: '2026-10-20T10:00:00.000Z',
  responsible: 'Daniel',
  preferredChannel: 'whatsapp',
  activities: [
    {
      id: 'result',
      occurredAt: '2026-10-15T10:00:00.000Z',
      type: 'contactResult',
      description: 'Contactado',
      result: 'contacted',
    },
  ],
  createdAt: '2026-10-15T00:00:00.000Z',
  updatedAt: '2026-10-15T00:00:00.000Z',
};
const input = {
  opportunityName: 'Reforma cocina',
  serviceOfInterest: 'Pintura',
  interestLevel: 'high' as const,
  detectedNeed: 'Renovar cocina',
  estimatedValue: '0',
  nextStep: 'Coordinar visita',
  nextStepAt: '2026-10-20T10:30',
  nextStepChannel: 'whatsapp' as const,
  responsible: 'Daniel',
};
beforeEach(() => {
  stored.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('prospect conversion', () => {
  it('allows Contactado and Interesado, but not a converted prospect', () => {
    expect(canQualifyProspect(prospect)).toBe(true);
    expect(canQualifyProspect({ ...prospect, status: 'interested', activities: [] })).toBe(true);
    expect(canQualifyProspect({ ...prospect, status: 'converted' })).toBe(false);
  });
  it('requires qualification fields and accepts zero estimated value only when finite', () => {
    expect(getProspectConversionValidationError(input)).toBeNull();
    expect(getProspectConversionValidationError({ ...input, opportunityName: '' })).toBeTruthy();
    expect(getProspectConversionValidationError({ ...input, nextStepAt: 'invalid' })).toBeTruthy();
    expect(getProspectConversionValidationError({ ...input, estimatedValue: '-1' })).toBeTruthy();
    expect(
      getProspectConversionValidationError({ ...input, estimatedValue: 'Infinity' }),
    ).toBeTruthy();
  });
  it('accepts Instagram as the prospect channel and next commercial step', () => {
    const pending = createPendingProspectConversion(
      {
        ...prospect,
        instagram: '@ana.sur',
        preferredChannel: 'instagram',
      },
      { ...input, nextStepChannel: 'instagram' },
    );
    expect(saveProspectWithResult(pending)).toMatchObject({ ok: true });
  });
  it('converts with a persisted client, qualified opportunity, ISO next action and history', () => {
    const expectedDueAt = localDateTimeToIso(input.nextStepAt);
    if (!expectedDueAt.ok) throw new Error(expectedDueAt.error);
    const pending = createPendingProspectConversion(prospect, input, '2026-10-16T00:00:00.000Z');
    expect(saveProspectWithResult(pending).ok).toBe(true);
    const result = resumeProspectConversion(pending, '2026-10-16T01:00:00.000Z');
    expect(result.ok).toBe(true);
    expect(loadClients().items[0]).toMatchObject({
      name: 'Ana',
      company: 'Sur',
      contactConsent: false,
    });
    expect(loadOpportunities().items[0]).toMatchObject({
      name: 'Reforma cocina',
      qualification: { estimatedValue: 0 },
      nextAction: { dueAt: expectedDueAt.value, type: 'whatsapp' },
    });
    expect(loadProspects().items[0]).toMatchObject({
      status: 'converted',
      conversion: { state: 'completed' },
      nextAction: '',
    });
    expect(loadProspects().items[0].activities.at(-1)?.type).toBe('conversionCompleted');
    expect(loadActivities().items).toContainEqual(
      expect.objectContaining({
        id: `prospect-history:${pending.conversion!.draft.opportunityId}:result`,
        subject: { kind: 'opportunity', opportunityId: pending.conversion!.draft.opportunityId },
        occurredAt: prospect.activities[0].occurredAt,
      }),
    );
  });
  it('converts a prospect without company, which is optional for prospects', () => {
    const withoutCompany = { ...prospect, company: '' };
    const pending = createPendingProspectConversion(withoutCompany, input);
    expect(saveProspectWithResult(pending).ok).toBe(true);
    const result = resumeProspectConversion(pending);
    expect(result.ok).toBe(true);
    expect(loadClients().items[0].company).toBeUndefined();
    expect(loadOpportunities().items).toHaveLength(1);
  });
  it('reuses a matching contact and carries the prospect source into the opportunity', () => {
    expect(
      saveClient({
        id: 'existing-client',
        name: 'Ana existente',
        company: 'Sur existente',
        phone: '+54 341 555 0101',
        email: 'ana@sur.com',
        preferredChannel: 'whatsapp',
        contactConsent: false,
        createdAt: '2026-10-14T00:00:00.000Z',
        updatedAt: '2026-10-14T00:00:00.000Z',
      }),
    ).toBe(true);
    const pending = createPendingProspectConversion({ ...prospect, source: 'Referido' }, input);

    expect(pending.conversion?.draft.clientId).toBe('existing-client');
    expect(resumeProspectConversion(pending).ok).toBe(true);
    expect(loadClients().items).toHaveLength(1);
    expect(loadOpportunities().items[0]).toMatchObject({
      clientId: 'existing-client',
      origin: 'Referido',
    });
  });
  it('creates the local client and opportunity with the ids Supabase assigned', () => {
    const remote = {
      opportunityId: '9a4e167e-8f7b-4a6d-b87c-6a671d9b7613',
      contactId: '0b8f3f3e-2f8a-4d5c-9e1a-3c2b1a0f9e8d',
    };
    const pending = withRemoteConversionIds(
      createPendingProspectConversion(prospect, input),
      remote,
    );
    expect(saveProspectWithResult(pending).ok).toBe(true);
    const result = resumeProspectConversion(pending);
    expect(result.ok).toBe(true);
    expect(loadOpportunities().items.map((item) => item.id)).toEqual([remote.opportunityId]);
    expect(loadOpportunities().items[0].clientId).toBe(remote.contactId);
    expect(loadClients().items.map((item) => item.id)).toEqual([remote.contactId]);
    expect(loadProspects().items[0].conversion?.draft.opportunityId).toBe(remote.opportunityId);
  });
  it('keeps the local client id when Supabase does not return a contact id', () => {
    const pending = createPendingProspectConversion(prospect, input);
    const aligned = withRemoteConversionIds(pending, {
      opportunityId: '9a4e167e-8f7b-4a6d-b87c-6a671d9b7613',
    });
    expect(aligned.conversion?.draft.clientId).toBe(pending.conversion?.draft.clientId);
    expect(aligned.conversion?.draft.opportunityId).toBe('9a4e167e-8f7b-4a6d-b87c-6a671d9b7613');
  });
  it('requires explicit retry after reload and reuses target ids without duplicates', () => {
    const pending = createPendingProspectConversion(prospect, input);
    expect(saveProspectWithResult(pending).ok).toBe(true);
    const realSet = localStorage.setItem;
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key === OPPORTUNITIES_STORAGE_KEY) throw new Error('blocked');
        realSet(key, value);
      },
    });
    expect(resumeProspectConversion(pending).ok).toBe(false);
    const recovered = loadProspects().items[0];
    expect(recovered.conversion?.state).toBe('pending');
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    });
    expect(resumeProspectConversion(recovered).ok).toBe(true);
    expect(loadClients().items).toHaveLength(1);
    expect(loadOpportunities().items).toHaveLength(1);
  });
  it.each([
    ['client', 'ingenya.clients.v1'],
    ['opportunity', OPPORTUNITIES_STORAGE_KEY],
    ['final prospect', PROSPECTS_STORAGE_KEY],
  ])('leaves the conversion pending when the %s write fails', (_label, failedKey) => {
    const pending = createPendingProspectConversion(prospect, input);
    expect(saveProspectWithResult(pending).ok).toBe(true);
    const originalSet = localStorage.setItem;
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key === failedKey) throw new Error('blocked');
        originalSet(key, value);
      },
    });
    expect(resumeProspectConversion(pending).ok).toBe(false);
    expect(stored.get(PROSPECTS_STORAGE_KEY)).toContain('pending');
  });
  it('preserves prior history and removes the completed conversion from the daily inbox', () => {
    const pending = createPendingProspectConversion(prospect, input);
    saveProspectWithResult(pending);
    const result = resumeProspectConversion(pending);
    if (!result.ok) throw new Error(result.error);
    expect(result.prospect.activities).toHaveLength(prospect.activities.length + 1);
    expect(getDueGroup(result.prospect, new Date('2026-10-16T12:00:00Z'))).toBeNull();
  });
  it('removes the prospect action even when copying its history fails after the opportunity is saved', () => {
    const pending = createPendingProspectConversion(prospect, input);
    expect(saveProspectWithResult(pending).ok).toBe(true);
    const originalSet = localStorage.setItem;
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key === 'ingenya.activities.v1') throw new Error('blocked');
        originalSet(key, value);
      },
    });

    const result = resumeProspectConversion(pending);

    expect(result).toMatchObject({ ok: true, warning: expect.any(String) });
    expect(loadProspects().items[0]).toMatchObject({ status: 'converted', nextAction: '' });
    expect(
      deriveFollowUpInbox(
        loadOpportunities().items,
        loadClients().items,
        [],
        [],
        [],
        new Date('2026-10-16T12:00:00Z'),
        loadProspects().items,
      ).filter((item) => item.prospectId === prospect.id),
    ).toEqual([]);
  });
});
