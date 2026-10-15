import { describe, expect, it } from 'vitest';
import { getContactActionTransition } from './contactResultTransition';

describe('contact result transitions', () => {
  it('completes effective call and received WhatsApp responses', () => {
    expect(getContactActionTransition('call', 'effectiveContact')).toBe('completed');
    expect(getContactActionTransition('whatsapp', 'responseReceived')).toBe('completed');
  });
  it('keeps unanswered and copied messages pending', () => {
    expect(getContactActionTransition('call', 'noAnswer')).toBe('none');
    expect(getContactActionTransition('whatsapp', 'messageCopied')).toBe('none');
  });
  it('reprograms callbacks and cancels non-interest', () => {
    expect(getContactActionTransition('call', 'callBack')).toBe('rescheduled');
    expect(getContactActionTransition('whatsapp', 'notInterested')).toBe('cancelled');
  });
});
