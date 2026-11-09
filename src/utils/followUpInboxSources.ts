import type { FollowUpInboxItem } from '../types/followUpInbox';
import type { Prospect } from '../types/prospect';
import type { SavedQuote } from '../types/quote';
import { loadActivities } from './activityStorage';
import { loadCadenceExecutions } from './cadenceStorage';
import { loadClients } from './clientStorage';
import { deriveFollowUpInbox } from './followUpInbox';
import { loadOpportunities } from './opportunityStorage';

/**
 * Everything to contact (Hoy), read from the browser copy. `issues` lists the stores that
 * could not be read completely; the valid records are still returned.
 */
export function loadFollowUpInbox(
  quotes: readonly SavedQuote[],
  prospects: readonly Prospect[],
  now = new Date(),
): { items: FollowUpInboxItem[]; issues: string[] } {
  const clients = loadClients();
  const executions = loadCadenceExecutions();
  const activities = loadActivities();
  return {
    items: deriveFollowUpInbox(
      loadOpportunities().items,
      clients.items,
      quotes,
      executions.items,
      activities.items,
      now,
      prospects,
    ),
    issues: [clients.issue, executions.issue, activities.issue].filter(
      (issue) => issue !== null,
    ) as string[],
  };
}
