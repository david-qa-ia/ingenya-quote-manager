import type { Activity } from '../types/activity';

const SYSTEM_AUTHOR = 'Sistema local';

/**
 * SCRUM-120: who did it. A person's name is always shown, also for activity the app copied or
 * derived (a prospect contact shown in its opportunity, for example). Only events the app made
 * on its own, with no person behind them, read "Automático".
 */
export function activityAuthorLabel(activity: Pick<Activity, 'author'>): string {
  const author = activity.author?.trim();
  return author && author !== SYSTEM_AUTHOR ? author : 'Automático';
}
