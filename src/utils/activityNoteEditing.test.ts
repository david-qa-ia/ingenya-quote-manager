import { describe, expect, it } from 'vitest';
import type { Activity } from '../types/activity';
import { canEditActivityNote, currentNoteEditor } from './activityNoteEditing';
import type { Responsible } from './responsibleStorage';

const team: Responsible[] = [
  { id: 'r1', name: 'Daniel', isPrimary: true, active: true },
  { id: 'r2', name: 'Lucía', isPrimary: false, active: true },
];

const note: Activity = {
  id: 'note-1',
  type: 'note',
  occurredAt: '2026-11-09T13:00:00.000Z',
  author: 'Daniel',
  result: 'Nota registrada',
  note: 'Visita técnica confirmada',
  subject: { kind: 'opportunity', opportunityId: 'opportunity' },
  source: 'manual',
  noteRevisions: [],
};

describe('note editing', () => {
  it('lets the primary responsible edit their notes before the note form is opened', () => {
    expect(canEditActivityNote(note, currentNoteEditor('', team))).toBe(true);
  });

  it('follows the person picked in the note form', () => {
    expect(canEditActivityNote(note, currentNoteEditor('Lucía', team))).toBe(false);
  });

  it('never offers to edit automatic entries or notes without a known editor', () => {
    expect(canEditActivityNote({ ...note, source: 'automatic' }, 'Daniel')).toBe(false);
    expect(canEditActivityNote(note, currentNoteEditor('', []))).toBe(false);
  });
});
