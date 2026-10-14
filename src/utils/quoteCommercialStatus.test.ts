import { describe, expect, it } from 'vitest';
import {
  applyCommercialTransition,
  createPreparedCommercialAudit,
  getCommercialTransitionTargets,
} from './quoteCommercialStatus';

const audit = {
  changedAt: '2026-10-14T12:00:00.000Z',
  changedBy: 'Daniel',
  reason: 'Registro manual confirmado.',
};

describe('commercial quote statuses', () => {
  it('starts prepared and only enables sent after document finalization', () => {
    expect(createPreparedCommercialAudit('2026-10-14T00:00:00.000Z')).toMatchObject({
      changedBy: 'Sistema local',
    });
    expect(getCommercialTransitionTargets('prepared', 'draft')).toEqual(['paused']);
    expect(getCommercialTransitionTargets('prepared', 'finalized')).toEqual(['sent', 'paused']);
  });

  it('requires finalized documents for sent, accepted and rejected', () => {
    expect(() => applyCommercialTransition('prepared', 'sent', 'draft', audit)).toThrow();
    expect(() => applyCommercialTransition('sent', 'accepted', 'draft', audit)).toThrow();
    expect(() => applyCommercialTransition('sent', 'rejected', 'draft', audit)).toThrow();
  });

  it('preserves the sent audit when a client requests changes during follow-up', () => {
    const sent = applyCommercialTransition('prepared', 'sent', 'finalized', audit);
    const followingUp = applyCommercialTransition(
      'sent',
      'followingUp',
      'finalized',
      { ...audit, reason: 'El cliente solicita cambios.' },
      sent.sentAudit,
    );

    expect(followingUp.commercialStatus).toBe('followingUp');
    expect(followingUp.sentAudit).toEqual(audit);
  });

  it('allows a follow-up self-transition and does not offer reopening closed states', () => {
    expect(getCommercialTransitionTargets('followingUp', 'finalized')).toContain('followingUp');
    expect(getCommercialTransitionTargets('accepted', 'finalized')).toEqual([]);
    expect(getCommercialTransitionTargets('rejected', 'finalized')).toEqual([]);
    expect(getCommercialTransitionTargets('expired', 'finalized')).toEqual([]);
  });

  it('requires a non-empty actor and reason for every registered change', () => {
    expect(() =>
      applyCommercialTransition('prepared', 'sent', 'finalized', { ...audit, changedBy: ' ' }),
    ).toThrow('Ingresá quién registró el cambio y su motivo.');
    expect(() =>
      applyCommercialTransition('prepared', 'sent', 'finalized', { ...audit, reason: '' }),
    ).toThrow('Ingresá quién registró el cambio y su motivo.');
  });
});
