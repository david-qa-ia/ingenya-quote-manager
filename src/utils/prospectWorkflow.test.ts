import { describe, expect, it } from 'vitest';
import type { Prospect } from '../types/prospect';
import { localDateTimeToIso } from './prospectFollowUp';
import { isProspect } from './prospectStorage';
import {
  filterProspects,
  createProspectInstagramUrl,
  createProspectWhatsAppUrl,
  getProspectActionValidationError,
  getDueGroup,
  getProspectStatusFromContactResult,
  isDuplicateProspect,
  describeProspectProfileChanges,
  getProspectActivityDisplay,
  registerProspectAction,
  withProspectProfileChangeActivity,
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
    expect(updated.status).toBe('uncontacted');
    expect(updated.nextActionAt).toBe(persistedFollowUp.value);
    expect(updated.activities.at(-1)).toMatchObject({
      prospectId: 'p1',
      result: 'reschedule',
      channel: 'whatsapp',
      note: 'Pide contacto el jueves.',
      followUpAt: persistedFollowUp.value,
    });
  });
  it('reflects the contact result in the status even when a next step is scheduled', () => {
    const persistedFollowUp = localDateTimeToIso('2026-10-16T10:30');
    if (!persistedFollowUp.ok) throw new Error(persistedFollowUp.error);
    const updated = registerProspectAction(prospect, {
      result: 'contacted',
      channel: 'whatsapp',
      note: 'Enviar propuesta luego de confirmar medidas.',
      followUpAt: '2026-10-16T10:30',
    });
    expect(updated.status).toBe('contacted');
    expect(updated.nextActionAt).toBe(persistedFollowUp.value);
    // The follow-up inbox depends on the next step, not on the "uncontacted" status.
    expect(getDueGroup(updated, new Date('2026-10-16T12:00:00Z'))).toBe('today');
    expect(updated.activities.at(-1)).toMatchObject({
      result: 'contacted',
      followUpAt: persistedFollowUp.value,
    });
  });
  it('moves an unanswered first contact to "Sin respuesta" and keeps the follow-up', () => {
    const updated = registerProspectAction(prospect, {
      result: 'noResponse',
      channel: 'phone',
      note: '',
      followUpAt: '2026-10-16T10:30',
    });
    expect(updated.status).toBe('noResponse');
    expect(updated.nextActionAt).not.toBe('');
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
  it('shows channel, result and note together in the history (SCRUM-102)', () => {
    const base = {
      id: 'a1',
      occurredAt: '2026-10-28T15:37:57.000Z',
      type: 'contactResult' as const,
    };
    // Remote activities used the note as description, hiding channel and result.
    expect(
      getProspectActivityDisplay({
        ...base,
        description: 'QA nota',
        channel: 'whatsapp',
        result: 'contacted',
        note: 'QA nota',
      }),
    ).toEqual({ title: 'WhatsApp: Contactado.', note: 'QA nota' });
    // Older entries stored the internal result code as the note.
    expect(
      getProspectActivityDisplay({
        ...base,
        description: 'effectiveContact',
        channel: 'phone',
        result: 'contacted',
        note: 'effectiveContact',
      }),
    ).toEqual({ title: 'Llamada: Contactado.' });
    expect(
      getProspectActivityDisplay({
        ...base,
        type: 'note',
        description: 'Llamar después de las 18',
      }),
    ).toEqual({ title: 'Llamar después de las 18' });
  });
  it('keeps the replaced date when a next step is rescheduled (SCRUM-103)', () => {
    const scheduled = { ...prospect, nextActionAt: '2026-11-02T18:00:00.000Z' };
    const updated = registerProspectAction(scheduled, {
      result: 'noResponse',
      channel: 'phone',
      note: '',
      followUpAt: '2026-11-04T13:00:00.000Z',
    });
    const entry = updated.activities.at(-1)!;
    expect(entry).toMatchObject({
      previousFollowUpAt: '2026-11-02T18:00:00.000Z',
      followUpAt: '2026-11-04T13:00:00.000Z',
    });
    expect(getProspectActivityDisplay(entry).followUp).toBe(
      'Próximo paso reprogramado: 02/11/2026, 15:00 → 04/11/2026, 10:00',
    );
    expect(isProspect(updated)).toBe(true);
  });
  it('records which profile fields changed, by whom and when (SCRUM-103)', () => {
    const edited = { ...prospect, source: 'Web', instagram: '@ana.sur' };
    expect(describeProspectProfileChanges(prospect, edited)).toEqual([
      'Instagram: (vacío) → @ana.sur',
      'Origen: Referencia → Web',
    ]);
    const saved = withProspectProfileChangeActivity(prospect, edited, 'qa@example.test');
    const entry = saved.activities.at(-1)!;
    expect(entry).toMatchObject({
      type: 'note',
      author: 'qa@example.test',
      description: 'Datos actualizados: Instagram: (vacío) → @ana.sur; Origen: Referencia → Web.',
    });
    expect(getProspectActivityDisplay(entry).kindLabel).toBe('Cambio de datos');
    // Stored with an existing activity type so the prospect stays valid for every client.
    expect(isProspect(saved)).toBe(true);
    expect(withProspectProfileChangeActivity(prospect, { ...prospect }, 'qa')).toEqual(prospect);
  });
  it('builds a direct WhatsApp URL only for confirmed phones', () => {
    expect(createProspectWhatsAppUrl('341 555-0101')).toBe('https://wa.me/3415550101');
    expect(createProspectWhatsAppUrl('1111111111')).toBeNull();
    expect(createProspectInstagramUrl('@ingenya')).toBe('https://www.instagram.com/ingenya/');
    expect(createProspectInstagramUrl('not a profile')).toBeNull();
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
      expect(updated.status).toBe('uncontacted');
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
