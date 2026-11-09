import { describe, expect, it } from 'vitest';
import type { Activity } from '../types/activity';
import {
  canEditActivityNote,
  createNoteRevision,
  currentActivityNote,
  currentNoteEditor,
  getPreviousNoteVersions,
} from './activityNoteEditing';
import type { Responsible } from './responsibleStorage';

const team: Responsible[] = [
  { id: 'r1', name: 'Daniel', isPrimary: true, active: true },
  { id: 'r2', name: 'Lucía', isPrimary: false, active: true },
];

const note: Activity = {
  id: 'note-1',
  type: 'note',
  occurredAt: '2026-11-09T13:00:00.000Z',
  author: 'Lucía',
  result: 'Nota registrada',
  note: 'Visita técnica confirmada',
  subject: { kind: 'opportunity', opportunityId: 'opportunity' },
  source: 'manual',
  noteRevisions: [],
};

describe('note editing', () => {
  it('lets anyone edit a note written by hand, but never an automatic entry', () => {
    expect(canEditActivityNote(note)).toBe(true);
    expect(canEditActivityNote({ ...note, source: 'automatic' })).toBe(false);
  });

  it('signs the edit with the form author, the primary responsible or the note author', () => {
    expect(currentNoteEditor('Lucía', team, 'Daniel')).toBe('Lucía');
    expect(currentNoteEditor('', team, 'Lucía')).toBe('Daniel');
    expect(currentNoteEditor('', [], 'Lucía')).toBe('Lucía');
  });

  it('keeps every replaced text in the note history, newest first', () => {
    const first = createNoteRevision(note, ' Visita el martes ', 'Daniel', '2026-11-09T14:00:00Z');
    const once = { ...note, note: first.note, noteRevisions: [first] };
    const second = createNoteRevision(once, 'Visita el jueves', 'Lucía', '2026-11-09T15:00:00Z');
    const twice = { ...once, note: second.note, noteRevisions: [first, second] };

    expect(currentActivityNote(twice)).toBe('Visita el jueves');
    expect(getPreviousNoteVersions(twice)).toEqual([
      { text: 'Visita el martes', replacedAt: '2026-11-09T15:00:00Z', replacedBy: 'Lucía' },
      {
        text: 'Visita técnica confirmada',
        replacedAt: '2026-11-09T14:00:00Z',
        replacedBy: 'Daniel',
      },
    ]);
  });

  it('shows the latest edit when the stored note still has the first text (Supabase)', () => {
    const fromSupabase: Activity = {
      ...note,
      noteRevisions: [
        { editedAt: '2026-11-09T14:00:00Z', editedBy: 'Daniel', note: 'Visita el martes' },
      ],
    };

    expect(currentActivityNote(fromSupabase)).toBe('Visita el martes');
    // An edit saved before the history kept the replaced text has no earlier version to show.
    expect(getPreviousNoteVersions(fromSupabase)).toEqual([]);
  });
});
