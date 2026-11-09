import type { ResultChannel } from '../components/RegisterResultDrawer';
import type { Activity, CallResult } from '../types/activity';
import type { WhatsAppResult } from '../types/contactScript';

type ContactResult =
  'effectiveContact' | 'interested' | 'noAnswer' | 'notInterested' | 'invalidNumber';

const contactResultLabels: Record<ContactResult, string> = {
  effectiveContact: 'Contactado',
  interested: 'Interesado',
  noAnswer: 'No respondió',
  notInterested: 'No interesado',
  invalidNumber: 'Dato inválido',
};

const callResults: Record<ContactResult, CallResult> = {
  effectiveContact: 'effectiveContact',
  interested: 'effectiveContact',
  noAnswer: 'noAnswer',
  notInterested: 'notInterested',
  invalidNumber: 'invalidNumber',
};

const whatsappResults: Record<ContactResult, WhatsAppResult> = {
  effectiveContact: 'responseReceived',
  interested: 'responseReceived',
  noAnswer: 'noResponse',
  notInterested: 'notInterested',
  invalidNumber: 'invalidNumber',
};

const untypedChannelLabels: Record<'instagram' | 'meeting', string> = {
  instagram: 'Instagram',
  meeting: 'Reunión',
};

export interface OpportunityContactInput {
  id: string;
  occurredAt: string;
  author: string;
  opportunityId: string;
  channel?: ResultChannel;
  result: string;
  note: string;
}

function isContactResult(result: string): result is ContactResult {
  return Object.hasOwn(contactResultLabels, result);
}

/**
 * A result registered on an opportunity is a contact: it keeps its channel and outcome so the
 * timeline and "Indicadores" count it, instead of collapsing into a plain note.
 */
export function buildOpportunityContactActivity(input: OpportunityContactInput): Activity | null {
  const note = input.note.trim();
  const base = {
    id: input.id,
    occurredAt: input.occurredAt,
    author: input.author.trim(),
    note,
    subject: { kind: 'opportunity' as const, opportunityId: input.opportunityId },
    source: 'manual' as const,
    noteRevisions: [],
  };
  // Without a channel and a known outcome there is no contact to record: only the user's note.
  const result = input.result;
  if (!input.channel || !isContactResult(result))
    return note ? { ...base, type: 'note', result: 'Nota registrada' } : null;
  if (input.channel === 'call') return { ...base, type: 'call', result: callResults[result] };
  if (input.channel === 'whatsapp')
    return { ...base, type: 'whatsapp', result: whatsappResults[result] };
  if (input.channel === 'email') return { ...base, type: 'email', result: callResults[result] };
  // Instagram and meetings have no activity type yet: the history still says how it went.
  const summary = `${untypedChannelLabels[input.channel]}: ${contactResultLabels[result]}.`;
  return {
    ...base,
    type: 'note',
    result: summary,
    note: note ? `${summary} ${note}` : summary,
  };
}
