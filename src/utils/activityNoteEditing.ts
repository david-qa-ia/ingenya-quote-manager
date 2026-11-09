import type { Activity, ActivityNoteRevision } from '../types/activity';
import { primaryResponsibleName, type Responsible } from './responsibleStorage';

/**
 * Who is signing a note edit: the person picked in the note form, the primary responsible
 * while the form has not been opened, or the note's own author when there is no team list.
 */
export function currentNoteEditor(
  formAuthor: string,
  responsibles: readonly Responsible[],
  noteAuthor = '',
): string {
  return formAuthor.trim() || primaryResponsibleName(responsibles) || noteAuthor.trim();
}

/**
 * The team shares one user, so anyone can edit a note written by hand (product decision
 * 2026-11-09). Automatic entries are records of what the app did and are never editable.
 */
export function canEditActivityNote(activity: Activity): boolean {
  return activity.source === 'manual';
}

/**
 * The text a note shows now: the latest edit. Supabase keeps the first text in `note` and the
 * edits in `noteRevisions`, so the last revision wins over `note`.
 */
export function currentActivityNote(activity: Activity): string {
  return activity.noteRevisions.at(-1)?.note ?? activity.note;
}

/** The revision that replaces the current text, keeping that text in the note history. */
export function createNoteRevision(
  activity: Activity,
  note: string,
  editedBy: string,
  editedAt = new Date().toISOString(),
): ActivityNoteRevision {
  return { editedAt, editedBy, note: note.trim(), previousNote: currentActivityNote(activity) };
}

export interface PreviousNoteVersion {
  text: string;
  /** When and by whom this text was replaced. */
  replacedAt: string;
  replacedBy: string;
}

/**
 * Earlier texts of a note, newest first. Edits saved before the history kept the replaced
 * text do not record it, so they are left out.
 */
export function getPreviousNoteVersions(activity: Activity): PreviousNoteVersion[] {
  return activity.noteRevisions
    .filter((revision) => revision.previousNote !== undefined)
    .map((revision) => ({
      text: revision.previousNote!,
      replacedAt: revision.editedAt,
      replacedBy: revision.editedBy,
    }))
    .reverse();
}
