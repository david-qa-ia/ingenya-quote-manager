import { describe, expect, it } from 'vitest';
import { describeScheduledNextStep, suggestNextStep } from './resultNextStep';

// Monday 9 November 2026, 15:00 in Argentina.
const monday = new Date('2026-11-09T18:00:00.000Z');
const friday = new Date('2026-11-13T18:00:00.000Z');

describe('suggestNextStep', () => {
  it('retries the same channel the next working day when there was no answer', () => {
    expect(
      suggestNextStep({ result: 'noAnswer', channel: 'whatsapp', hasQuote: false, now: monday }),
    ).toMatchObject({ nextStep: 'whatsapp', dueAt: '2026-11-10T10:00' });
    // Friday's retry goes to Monday, and a meeting is followed up by phone.
    expect(
      suggestNextStep({ result: 'noAnswer', channel: 'meeting', hasQuote: false, now: friday }),
    ).toMatchObject({ nextStep: 'call', dueAt: '2026-11-16T10:00' });
  });

  it('moves an interested contact to the quote, or follows up the quote already sent', () => {
    expect(
      suggestNextStep({ result: 'interested', channel: 'call', hasQuote: false, now: monday }),
    ).toMatchObject({ nextStep: 'sendQuote', dueAt: '2026-11-10T10:00' });
    expect(
      suggestNextStep({
        result: 'effectiveContact',
        channel: 'call',
        hasQuote: false,
        now: monday,
      }),
    ).toMatchObject({ nextStep: 'sendQuote', dueAt: '2026-11-11T10:00' });
    expect(
      suggestNextStep({
        result: 'effectiveContact',
        channel: 'email',
        hasQuote: true,
        now: monday,
      }),
    ).toMatchObject({ nextStep: 'email', dueAt: '2026-11-12T10:00' });
  });

  it('falls back to a channel the contact has', () => {
    expect(
      suggestNextStep({
        result: 'noAnswer',
        channel: 'email',
        hasQuote: false,
        isUnavailable: (step) => step === 'email' || step === 'call',
        now: monday,
      }),
    ).toMatchObject({ nextStep: 'whatsapp' });
  });

  it('suggests nothing when discarding', () => {
    for (const result of ['notInterested', 'invalidNumber'])
      expect(suggestNextStep({ result, channel: 'call', hasQuote: false, now: monday })).toBeNull();
  });
});

describe('describeScheduledNextStep', () => {
  const action = { description: 'Dar seguimiento', responsible: 'Daniel' };

  it('does not name the responsible when the team has a single person', () => {
    expect(describeScheduledNextStep(action, '10 nov 2026, 10:00', true)).toBe(
      'Próximo paso agendado: Dar seguimiento para 10 nov 2026, 10:00.',
    );
  });

  it('names the responsible when the team has several people', () => {
    expect(describeScheduledNextStep(action, '10 nov 2026, 10:00', false)).toBe(
      'Próximo paso agendado: Dar seguimiento para 10 nov 2026, 10:00, responsable Daniel.',
    );
  });
});
