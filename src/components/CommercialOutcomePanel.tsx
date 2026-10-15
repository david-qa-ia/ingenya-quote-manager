import { useState, type FormEvent } from 'react';
import type { CommercialOutcome, CommercialOutcomeType } from '../types/commercialOutcome';
import type { Opportunity } from '../types/opportunity';
import type { Quote, SavedQuote } from '../types/quote';
import { commercialOutcomeLabels, commercialReasonLabels } from '../utils/commercialOutcome';
import { loadCommercialOutcomes } from '../utils/commercialOutcomeStorage';

const labels = { open: 'Abierta', won: 'Ganada', lost: 'Perdida' } as const;

interface Props {
  opportunity: Opportunity;
  quote: Quote;
  savedQuotes: readonly SavedQuote[];
  onRecord: (outcome: CommercialOutcome, closeAsWon: boolean) => string | null;
}

export function CommercialOutcomePanel({ opportunity, quote, savedQuotes, onRecord }: Props) {
  const [type, setType] = useState<CommercialOutcomeType>('accepted');
  const [reasonCode, setReasonCode] = useState<keyof typeof commercialReasonLabels>('price');
  const [note, setNote] = useState('');
  const [author, setAuthor] = useState('');
  const [closeAsWon, setCloseAsWon] = useState(false);
  const [error, setError] = useState('');
  const outcomes = loadCommercialOutcomes()
    .items.filter((item) => item.opportunityId === opportunity.id)
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  const relatedQuotes = savedQuotes.filter((item) => item.opportunityId === opportunity.id);
  const isQuoteResult = type === 'accepted' || type === 'rejected';
  const needsReason = type !== 'reopened';

  function submit(event: FormEvent) {
    event.preventDefault();
    if (isQuoteResult && quote.status !== 'finalized') {
      setError('Solo los presupuestos finalizados pueden aceptarse o rechazarse.');
      return;
    }
    if (
      !author.trim() ||
      (needsReason && !reasonCode) ||
      (reasonCode === 'other' && !note.trim())
    ) {
      setError('Completá autor, motivo y una nota cuando el motivo sea “Otro”.');
      return;
    }
    if (
      type === 'reopened' &&
      opportunity.nextAction?.status !== 'pending' &&
      !opportunity.noNextActionException
    ) {
      setError('Antes de reabrir, programá una nueva próxima acción o registrá una excepción.');
      return;
    }
    const outcome: CommercialOutcome = {
      id: crypto.randomUUID(),
      type,
      ...(needsReason ? { reasonCode } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      occurredAt: new Date().toISOString(),
      author: author.trim(),
      origin: 'commercialPanel',
      opportunityId: opportunity.id,
      ...(isQuoteResult ? { quoteId: quote.id } : {}),
      ...(type === 'corrected' && outcomes[0] ? { supersedesOutcomeId: outcomes[0].id } : {}),
    };
    const message = onRecord(outcome, type === 'accepted' && closeAsWon);
    if (message) return setError(message);
    setError('');
    setNote('');
  }

  return (
    <section className="summary-panel" aria-label="Resultado comercial">
      <div className="summary-panel-heading">
        <p className="eyebrow">Seguimiento comercial</p>
        <h2>Resultado comercial</h2>
      </div>
      <p>
        Estado actual: <strong>{labels[opportunity.commercialState ?? 'open']}</strong>
      </p>
      {relatedQuotes.length > 1 && (
        <p className="commercial-warning">
          Hay {relatedQuotes.length} presupuestos asociados. Rechazar uno no cierra la obra o
          trabajo.
        </p>
      )}
      <form className="commercial-form" onSubmit={submit} noValidate>
        <label className="field">
          <span>Resultado</span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value as CommercialOutcomeType)}
          >
            <option value="accepted">Aceptar este presupuesto</option>
            <option value="rejected">Rechazar este presupuesto</option>
            <option value="lost">Marcar obra o trabajo como perdida</option>
            <option value="reopened">Reabrir obra o trabajo</option>
            <option value="corrected">Corregir último resultado</option>
          </select>
        </label>
        {needsReason && (
          <label className="field">
            <span>Motivo</span>
            <select
              value={reasonCode}
              onChange={(event) =>
                setReasonCode(event.target.value as keyof typeof commercialReasonLabels)
              }
            >
              {Object.entries(commercialReasonLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>{reasonCode === 'other' ? 'Nota (obligatoria)' : 'Nota (opcional)'}</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <label className="field">
          <span>Autor</span>
          <input value={author} onChange={(event) => setAuthor(event.target.value)} />
        </label>
        {type === 'accepted' && (
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={closeAsWon}
              onChange={(event) => setCloseAsWon(event.target.checked)}
            />
            <span>Cerrar obra o trabajo como ganada</span>
          </label>
        )}
        {error && (
          <p className="commercial-warning" role="alert">
            {error}
          </p>
        )}
        <button className="button button-primary" type="submit">
          Confirmar resultado
        </button>
      </form>
      <details>
        <summary>Historial de resultados ({outcomes.length})</summary>
        <ul>
          {outcomes.map((item) => (
            <li key={item.id}>
              <strong>{commercialOutcomeLabels[item.type]}</strong> ·{' '}
              {new Date(item.occurredAt).toLocaleString('es-AR')} · {item.author}
              {item.reasonCode ? ` · ${commercialReasonLabels[item.reasonCode]}` : ''}
              {item.note ? ` · ${item.note}` : ''}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
