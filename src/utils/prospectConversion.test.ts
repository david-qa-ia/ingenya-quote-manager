import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prospect } from '../types/prospect';
import { loadClients } from './clientStorage';
import { loadOpportunities, OPPORTUNITIES_STORAGE_KEY } from './opportunityStorage';
import {
  canQualifyProspect,
  createPendingProspectConversion,
  getProspectConversionValidationError,
  resumeProspectConversion,
} from './prospectConversion';
import { loadProspects, PROSPECTS_STORAGE_KEY, saveProspectWithResult } from './prospectStorage';
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
  it('converts with a persisted client, qualified opportunity, ISO next action and history', () => {
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
      nextAction: { dueAt: '2026-10-20T13:30:00.000Z', type: 'whatsapp' },
    });
    expect(loadProspects().items[0]).toMatchObject({
      status: 'converted',
      conversion: { state: 'completed' },
      nextAction: '',
    });
    expect(loadProspects().items[0].activities.at(-1)?.type).toBe('conversionCompleted');
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
});
