import type { Activity } from '../types/activity';
import { primaryResponsibleName, type Responsible } from './responsibleStorage';

/**
 * Who is editing notes right now: the person picked in the note form, or the primary
 * responsible while the form has not been opened yet (the form picks the same default).
 */
export function currentNoteEditor(
  formAuthor: string,
  responsibles: readonly Responsible[],
): string {
  return formAuthor.trim() || primaryResponsibleName(responsibles);
}

/** A person can edit the notes they wrote by hand; automatic entries are never editable. */
export function canEditActivityNote(activity: Activity, editor: string): boolean {
  return activity.source === 'manual' && editor.trim() !== '' && activity.author === editor.trim();
}
