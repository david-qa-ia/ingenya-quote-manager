import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { commitLocalQuoteSend } from './quoteSendTransaction';
import { SAVED_QUOTES_STORAGE_KEY } from './quoteDraftStorage';
import { ACTIVITIES_STORAGE_KEY } from './activityStorage';
import { OPPORTUNITIES_STORAGE_KEY } from './opportunityStorage';
const memory = new Map<string, string>();
beforeEach(() =>
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  }),
);
afterEach(() => {
  memory.clear();
  vi.unstubAllGlobals();
});
const quote = {
  id: 'quote-1',
  status: 'finalized' as const,
  commercialStatus: 'prepared' as const,
  commercialStatusAudit: {
    changedAt: '2026-10-20T10:00:00.000Z',
    changedBy: 'David',
    reason: 'Preparado',
  },
  clientName: 'Cliente',
  projectName: 'Obra',
  lines: [
    {
      id: 'line-1',
      name: 'Servicio',
      unit: 'unit' as const,
      quantity: 1,
      unitPrice: 1,
      source: 'manual' as const,
    },
  ],
  savedAt: '2026-10-20T10:00:00.000Z',
  opportunityId: 'opp-1',
};
describe('quote send transaction', () => {
  it('records quote, activity and next step together', () => {
    memory.set(SAVED_QUOTES_STORAGE_KEY, JSON.stringify([quote]));
    memory.set(ACTIVITIES_STORAGE_KEY, '[]');
    memory.set(
      OPPORTUNITIES_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'opp-1',
          clientId: 'client',
          name: 'Obra',
          address: '',
          estimatedStartDate: '',
          responsibleSeller: 'David',
          createdAt: '2026-10-20T10:00:00.000Z',
          updatedAt: '2026-10-20T10:00:00.000Z',
        },
      ]),
    );
    const result = commitLocalQuoteSend({
      quote,
      audit: {
        changedAt: '2026-10-21T10:00:00.000Z',
        changedBy: 'David',
        reason: 'Enviado',
        channel: 'whatsapp',
        recipient: '3415550101',
      },
      nextStep: { type: 'call', dueAt: '2026-10-22T10:00:00.000Z' },
    });
    expect(result.ok).toBe(true);
    expect(JSON.parse(memory.get(SAVED_QUOTES_STORAGE_KEY)!)[0].commercialStatus).toBe('sent');
    expect(JSON.parse(memory.get(ACTIVITIES_STORAGE_KEY)!).length).toBe(1);
    expect(JSON.parse(memory.get(OPPORTUNITIES_STORAGE_KEY)!)[0].nextAction.type).toBe('call');
  });
  it('does not register a second send for the same version', () => {
    memory.set(SAVED_QUOTES_STORAGE_KEY, JSON.stringify([{ ...quote, commercialStatus: 'sent' }]));
    memory.set(ACTIVITIES_STORAGE_KEY, '[]');
    memory.set(OPPORTUNITIES_STORAGE_KEY, '[]');
    expect(
      commitLocalQuoteSend({
        quote,
        audit: { changedAt: '2026-10-21T10:00:00.000Z', changedBy: 'David', reason: 'Enviado' },
      }).ok,
    ).toBe(false);
  });
});
