import { describe, expect, it } from 'vitest';
import type { Prospect } from '../types/prospect';
import { localDateTimeToIso } from './prospectFollowUp';
import {
  filterProspects,
  createProspectWhatsAppUrl,
  getProspectActionValidationError,
  getDueGroup,
  getProspectStatusFromContactResult,
  isDuplicateProspect,
  registerProspectAction,
  transitionProspect,
} from './prospectWorkflow';

const prospect: Prospect = {
  id: 'p1',
  name: 'Ana',
  company: 'Sur',
  phone: '3415550101',
  email: 'ana@sur.com',
  source: 'Referencia',
  potentialService: 'Pintura',
  notes: '',
  status: 'uncontacted',
  priority: 'high',
  priorityReason: 'Referencia',
  nextAction: 'Llamar',
  nextActionAt: '2026-10-15',
  responsible: 'Daniel',
  preferredChannel: 'phone',
  activities: [],
  createdAt: '2026-10-14T00:00:00Z',
  updatedAt: '2026-10-14T00:00:00Z',
};

describe('prospect workflow', () => {
  it('detects duplicates through normalized email, phone or name and company', () => {
    expect(isDuplicateProspect({ ...prospect, email: ' ANA@SUR.COM ' }, [prospect])).toBe(true);
    expect(isDuplicateProspect({ ...prospect, email: '', phone: '341 555-0101' }, [prospect])).toBe(
      true,
    );
    expect(
      isDuplicateProspect({ ...prospect, email: '', phone: '', name: ' ana ', company: 'SUR' }, [
        prospect,
      ]),
    ).toBe(true);
  });
  it('preserves data and adds an audit record when changing state', () => {
    const changed = transitionProspect(prospect, 'interested', 'Daniel');
    expect(changed).toMatchObject({ name: 'Ana', status: 'interested' });
    expect(changed.activities[0].description).toContain('Sin contactar');
  });
  it('filters independently and groups overdue, today and upcoming actions', () => {
    expect(
      filterProspects([prospect], {
        status: 'uncontacted',
        priority: 'high',
        channel: 'phone',
        service: 'Pintura',
      }),
    ).toEqual([prospect]);
    expect(
      getDueGroup({ ...prospect, nextActionAt: '2026-10-14' }, new Date('2026-10-15T12:00:00Z')),
    ).toBe('overdue');
    expect(getDueGroup(prospect, new Date('2026-10-15T12:00:00Z'))).toBe('today');
    expect(
      getDueGroup({ ...prospect, nextActionAt: '2026-10-16' }, new Date('2026-10-15T12:00:00Z')),
    ).toBe('upcoming');
  });
  it('derives the visible commercial state from the registered contact result', () => {
    expect(getProspectStatusFromContactResult('Interesado')).toBe('interested');
    expect(getProspectStatusFromContactResult('Sin respuesta')).toBe('noResponse');
    expect(getProspectStatusFromContactResult('Contacto realizado')).toBe('contacted');
  });
  it('records a rescheduled action with its channel, note and follow-up date', () => {
    const persistedFollowUp = localDateTimeToIso('2026-10-16T10:30');
    if (!persistedFollowUp.ok) throw new Error(persistedFollowUp.error);
    const updated = registerProspectAction(prospect, {
      result: 'reschedule',
      channel: 'whatsapp',
      note: 'Pide contacto el jueves.',
      followUpAt: '2026-10-16T10:30',
    });
    expect(updated.status).toBe('contacted');
    expect(updated.nextActionAt).toBe(persistedFollowUp.value);
    expect(updated.activities.at(-1)).toMatchObject({
      prospectId: 'p1',
      result: 'reschedule',
      channel: 'whatsapp',
      note: 'Pide contacto el jueves.',
      followUpAt: persistedFollowUp.value,
    });
  });
  it('keeps the recorded result when the next step schedules another contact', () => {
    const persistedFollowUp = localDateTimeToIso('2026-10-16T10:30');
    if (!persistedFollowUp.ok) throw new Error(persistedFollowUp.error);
    const updated = registerProspectAction(prospect, {
      result: 'contacted',
      channel: 'whatsapp',
      note: 'Enviar propuesta luego de confirmar medidas.',
      followUpAt: '2026-10-16T10:30',
    });
    expect(updated.activities.at(-1)).toMatchObject({
      result: 'contacted',
      followUpAt: persistedFollowUp.value,
    });
  });
  it('accepts the ISO date emitted by the unified result drawer', () => {
    const updated = registerProspectAction(prospect, {
      result: 'contacted',
      channel: 'phone',
      note: 'Seguimiento confirmado.',
      followUpAt: '2026-10-16T13:30:00.000Z',
    });
    expect(updated.nextActionAt).toBe('2026-10-16T13:30:00.000Z');
    expect(updated.activities.at(-1)).toMatchObject({
      result: 'contacted',
      followUpAt: '2026-10-16T13:30:00.000Z',
    });
  });
  it('builds a direct WhatsApp URL only for confirmed phones', () => {
    expect(createProspectWhatsAppUrl('341 555-0101')).toBe('https://wa.me/3415550101');
    expect(createProspectWhatsAppUrl('1111111111')).toBeNull();
  });
  it('groups only active prospects by the saved follow-up date', () => {
    const today = new Date('2026-10-15T12:00:00Z');
    expect(getDueGroup({ ...prospect, nextActionAt: '2026-10-15T10:00' }, today)).toBe('today');
    expect(getDueGroup({ ...prospect, status: 'notInterested' }, today)).toBeNull();
  });
  it('produces the same history, status and follow-up from every action entry point', () => {
    const input = {
      result: 'reschedule' as const,
      channel: 'whatsapp' as const,
      note: 'Retomar hoy.',
      followUpAt: '2026-10-15T14:00',
    };
    const persistedFollowUp = localDateTimeToIso(input.followUpAt);
    if (!persistedFollowUp.ok) throw new Error(persistedFollowUp.error);
    const fromList = registerProspectAction({ ...prospect, id: 'list' }, input);
    const fromPanel = registerProspectAction({ ...prospect, id: 'panel' }, input);
    const fromDetail = registerProspectAction({ ...prospect, id: 'detail' }, input);
    [fromList, fromPanel, fromDetail].forEach((updated) => {
      expect(updated.status).toBe('contacted');
      expect(updated.nextActionAt).toBe(persistedFollowUp.value);
      expect(updated.activities.at(-1)).toMatchObject({
        prospectId: updated.id,
        result: 'reschedule',
        channel: 'whatsapp',
        note: 'Retomar hoy.',
      });
    });
  });
  it('requires a date and time when rescheduling', () => {
    expect(
      getProspectActionValidationError({
        result: 'reschedule',
        channel: 'whatsapp',
        note: '',
      }),
    ).toContain('fecha y hora');
  });
});
