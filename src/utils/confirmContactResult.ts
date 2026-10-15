import type { Activity } from '../types/activity';
import type { ContactContext } from './contactAssistant';
import { loadActivities, saveActivity } from './activityStorage';
import { getContactActionTransition } from './contactResultTransition';
import { loadCadenceExecutions, saveCadenceExecution } from './cadenceStorage';
import { completeCadenceAction, updateCadenceAction } from './cadenceTransitions';
import { transitionNextAction } from './opportunityNextAction';
import { saveOpportunity } from './opportunityStorage';

export interface ConfirmContactResultInput {
  context: ContactContext;
  activity: Activity;
  rescheduleAt: string;
}
export interface ConfirmContactResultOutput {
  activitySaved: boolean;
  transitionApplied: boolean;
  error?: string;
}

export function confirmContactResult({
  context,
  activity,
  rescheduleAt,
}: ConfirmContactResultInput): ConfirmContactResultOutput {
  const activityExists = loadActivities().items.some((item) => item.id === activity.id);
  if (!activityExists && !saveActivity(activity))
    return {
      activitySaved: false,
      transitionApplied: false,
      error: 'No se pudo guardar la actividad.',
    };
  const kind = getContactActionTransition(
    activity.communication!.channel,
    activity.result as never,
  );
  if (kind === 'none') return { activitySaved: true, transitionApplied: true };
  const now = new Date().toISOString();
  try {
    const executions = loadCadenceExecutions().items;
    const execution = executions.find(
      (item) =>
        item.status === 'active' &&
        ((item.target.kind === 'opportunity' &&
          item.target.opportunityId === context.opportunity?.id) ||
          (item.target.kind === 'sentQuote' && item.target.quoteId === context.quote?.id)) &&
        item.currentStepExecutionId,
    );
    if (execution) {
      const current = execution.stepExecutions.find(
        (item) => item.id === execution.currentStepExecutionId,
      );
      if (!current?.nextAction || current.nextAction.status !== 'pending')
        return { activitySaved: true, transitionApplied: true };
      const updated =
        kind === 'completed'
          ? completeCadenceAction(execution, activity.author, activity.result, now)
          : updateCadenceAction(
              execution,
              kind === 'rescheduled' ? 'rescheduled' : 'cancelled',
              activity.author,
              activity.note || activity.result,
              now,
              kind === 'rescheduled' ? rescheduleAt : undefined,
            );
      if (!saveCadenceExecution(updated)) throw new Error('No se pudo guardar la cadencia.');
      if (context.opportunity) {
        const nextAction = updated.stepExecutions.find(
          (item) => item.id === updated.currentStepExecutionId,
        )?.nextAction;
        if (!saveOpportunity({ ...context.opportunity, nextAction, updatedAt: now }))
          throw new Error('No se pudo actualizar la obra o trabajo.');
      }
      return { activitySaved: true, transitionApplied: true };
    }
    const action = context.opportunity?.nextAction;
    if (!context.opportunity || !action || action.status !== 'pending')
      return { activitySaved: true, transitionApplied: true };
    const next = transitionNextAction(
      context.opportunity,
      kind === 'completed' ? 'completed' : kind === 'rescheduled' ? 'rescheduled' : 'cancelled',
      activity.author,
      activity.note || activity.result,
      now,
      {
        dueAt: kind === 'rescheduled' ? rescheduleAt : undefined,
        result: kind === 'completed' ? activity.result : undefined,
      },
    );
    if (!saveOpportunity(next)) throw new Error('No se pudo actualizar la acción.');
    return { activitySaved: true, transitionApplied: true };
  } catch (error) {
    return {
      activitySaved: true,
      transitionApplied: false,
      error: error instanceof Error ? error.message : 'No se pudo actualizar la acción.',
    };
  }
}
