import { describe, expect, it } from 'vitest';
import { canSendDraftInOneStep } from './quoteOneStepSend';

const draft = {
  status: 'draft' as const,
  clientId: 'client-1',
  lineCount: 2,
  hasPendingDirectClient: false,
};

describe('canSendDraftInOneStep', () => {
  it('offers "Enviar" for a draft with services and a client', () => {
    expect(canSendDraftInOneStep(draft)).toBe(true);
  });

  it('only finalizes quick quotes, new direct clients, empty drafts and finalized quotes', () => {
    expect(canSendDraftInOneStep({ ...draft, clientId: undefined })).toBe(false);
    expect(canSendDraftInOneStep({ ...draft, hasPendingDirectClient: true })).toBe(false);
    expect(canSendDraftInOneStep({ ...draft, lineCount: 0 })).toBe(false);
    expect(canSendDraftInOneStep({ ...draft, status: 'finalized' })).toBe(false);
  });
});
