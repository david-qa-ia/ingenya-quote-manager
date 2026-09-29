import { describe, expect, it } from 'vitest';
import type { QuoteDraft } from '../types/quote';
import { parseQuoteDraft } from './quoteDraftStorage';

const validDraft: QuoteDraft = {
  id: 'PRES-2026-0001',
  status: 'draft',
  clientName: 'Ana Pérez',
  projectName: 'Reforma cocina',
  lines: [
    {
      id: 'line-1',
      catalogJobId: 'paint-wall',
      name: 'Pintar pared',
      unit: 'squareMeter',
      quantity: 12.5,
      unitPrice: 15000,
      source: 'catalog',
    },
  ],
};

describe('parseQuoteDraft', () => {
  it('returns a valid stored quote draft', () => {
    expect(parseQuoteDraft(JSON.stringify(validDraft))).toEqual(validDraft);
  });

  it('returns null when no stored draft exists', () => {
    expect(parseQuoteDraft(null)).toBeNull();
  });

  it('returns null when the stored value is malformed JSON', () => {
    expect(parseQuoteDraft('{not-valid-json')).toBeNull();
  });

  it('returns null when the draft does not have the expected shape', () => {
    expect(parseQuoteDraft(JSON.stringify({ ...validDraft, status: 'sent' }))).toBeNull();
  });

  it('returns null when any quote line contains invalid data', () => {
    const invalidDraft = {
      ...validDraft,
      lines: [{ ...validDraft.lines[0], quantity: -1 }],
    };

    expect(parseQuoteDraft(JSON.stringify(invalidDraft))).toBeNull();
  });

  it('accepts an empty draft with optional client and project data omitted', () => {
    const emptyDraft: QuoteDraft = {
      id: 'PRES-2026-0001',
      status: 'draft',
      clientName: '',
      projectName: '',
      lines: [],
    };

    expect(parseQuoteDraft(JSON.stringify(emptyDraft))).toEqual(emptyDraft);
  });
});
