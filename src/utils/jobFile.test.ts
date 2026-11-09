import { describe, expect, it } from 'vitest';
import type { Client } from '../types/client';
import type { Opportunity } from '../types/opportunity';
import type { Prospect, ProspectConversion } from '../types/prospect';
import { getJobFileHeading, getJobProjectName, resolveJobRef } from './jobFile';

const conversion = (state: ProspectConversion['state']): ProspectConversion => ({
  state,
  startedAt: '2026-11-03T12:00:00.000Z',
  ...(state === 'completed' ? { completedAt: '2026-11-03T12:00:01.000Z' } : {}),
  draft: {
    clientId: 'c1',
    clientName: 'Ana Paz',
    clientCompany: 'Consorcio Belgrano',
    clientPhone: '341 600-0001',
    clientEmail: '',
    clientPreferredChannel: 'whatsapp',
    opportunityId: 'o1',
    opportunityName: 'Pintura palier',
    serviceOfInterest: 'Pintura',
    interestLevel: 'high',
    detectedNeed: 'Pintar el palier',
    nextStep: 'Visitar la obra',
    nextStepAt: '2026-11-10T12:00:00.000Z',
    nextStepChannel: 'meeting',
    responsible: 'Daniel',
  },
});

const prospect = (overrides: Partial<Prospect> = {}): Prospect => ({
  id: 'p1',
  name: 'Ana Paz',
  company: 'Consorcio Belgrano',
  phone: '341 600-0001',
  email: '',
  source: 'Recomendación',
  potentialService: 'Pintura',
  notes: '',
  status: 'interested',
  priority: 'medium',
  priorityReason: '',
  nextAction: '',
  nextActionAt: '',
  responsible: 'Daniel',
  preferredChannel: '',
  activities: [],
  createdAt: '2026-11-01T12:00:00.000Z',
  updatedAt: '2026-11-01T12:00:00.000Z',
  ...overrides,
});

const client: Client = {
  id: 'c1',
  name: 'Ana Paz',
  company: 'Consorcio Belgrano',
  phone: '341 600-0001',
  email: '',
  preferredChannel: 'whatsapp',
  contactConsent: true,
  createdAt: '2026-11-03T12:00:00.000Z',
  updatedAt: '2026-11-03T12:00:00.000Z',
};

const opportunity: Opportunity = {
  id: 'o1',
  clientId: 'c1',
  name: 'Pintura palier',
  address: '',
  estimatedStartDate: '',
  responsibleSeller: 'Daniel',
  qualification: { serviceOfInterest: 'Pintura', interestLevel: 'high', detectedNeed: '' },
  createdAt: '2026-11-03T12:00:00.000Z',
  updatedAt: '2026-11-03T12:00:00.000Z',
};

describe('resolveJobRef', () => {
  it('opens a converted prospect as its opportunity, wherever it is opened from', () => {
    const converted = prospect({ status: 'converted', conversion: conversion('completed') });

    expect(
      resolveJobRef(
        { kind: 'prospect', id: 'p1' },
        { prospects: [converted], opportunities: [opportunity] },
      ),
    ).toEqual({ kind: 'opportunity', id: 'o1' });
  });

  it('keeps the prospect while its conversion is pending or its opportunity is missing here', () => {
    const pending = prospect({ conversion: conversion('pending') });
    const convertedElsewhere = prospect({ id: 'p2', conversion: conversion('completed') });
    const sources = { prospects: [pending, convertedElsewhere], opportunities: [] };

    expect(resolveJobRef({ kind: 'prospect', id: 'p1' }, sources)).toEqual({
      kind: 'prospect',
      id: 'p1',
    });
    expect(resolveJobRef({ kind: 'prospect', id: 'p2' }, sources)).toEqual({
      kind: 'prospect',
      id: 'p2',
    });
  });

  it('returns null for a record that is not in this browser', () => {
    const sources = { prospects: [], opportunities: [] };

    expect(resolveJobRef({ kind: 'prospect', id: 'gone' }, sources)).toBeNull();
    expect(resolveJobRef({ kind: 'opportunity', id: 'gone' }, sources)).toBeNull();
  });
});

describe('getJobFileHeading', () => {
  it('keeps the name and detail of the sale when the prospect becomes an opportunity', () => {
    const before = getJobFileHeading(
      { kind: 'prospect', id: 'p1' },
      { prospects: [prospect()], opportunities: [], clients: [], quotes: [] },
    );
    const after = getJobFileHeading(
      { kind: 'prospect', id: 'p1' },
      {
        prospects: [prospect({ status: 'converted', conversion: conversion('completed') })],
        opportunities: [opportunity],
        clients: [client],
        quotes: [],
      },
    );

    expect(before).toEqual({
      name: 'Ana Paz',
      detail: 'Consorcio Belgrano · Pintura',
      stage: 'contacted',
    });
    expect(after).toEqual({ ...before, stage: 'quoting' });
  });
});

describe('getJobProjectName', () => {
  it('shows a project name only when it says more than the service', () => {
    const named = (name: string) => getJobProjectName({ ...opportunity, name });

    expect(named('Edificio Mitre 450')).toBe('Edificio Mitre 450');
    expect(named('Consorcio Belgrano · Pintura')).toBe('');
    expect(named('pintura')).toBe('');
    expect(getJobProjectName({ ...opportunity, qualification: undefined })).toBe('');
  });
});
