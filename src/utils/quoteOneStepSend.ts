/**
 * "Enviar" finalizes a draft and registers its send in one confirmation (roadmap, Stage 2).
 * It is offered for a draft with services and a client to send it to. A draft for a new direct
 * client is finalized first, because that is when the client is created; a quick quote without
 * a client has nobody to send to and is only finalized.
 */
export function canSendDraftInOneStep(draft: {
  status: 'draft' | 'finalized';
  clientId?: string;
  lineCount: number;
  hasPendingDirectClient: boolean;
}): boolean {
  return (
    draft.status === 'draft' &&
    Boolean(draft.clientId?.trim()) &&
    !draft.hasPendingDirectClient &&
    draft.lineCount > 0
  );
}
