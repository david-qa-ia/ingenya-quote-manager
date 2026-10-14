import { useState, type FormEvent } from 'react';
import type { Opportunity, OpportunityInput } from '../types/opportunity';
import {
  getOpportunityValidationError,
  normalizeOpportunityInput,
} from '../utils/opportunityValidation';

interface Props {
  clientId: string;
  opportunity?: Opportunity;
  onSave: (input: OpportunityInput) => string | null;
  onCancel: () => void;
}

export function OpportunityForm({ clientId, opportunity, onSave, onCancel }: Props) {
  const [input, setInput] = useState<OpportunityInput>(
    opportunity ?? {
      clientId,
      name: '',
      address: '',
      estimatedStartDate: '',
      responsibleSeller: '',
    },
  );
  const [error, setError] = useState<string | null>(null);
  function submit(event: FormEvent) {
    event.preventDefault();
    setError(getOpportunityValidationError(input) ?? onSave(normalizeOpportunityInput(input)));
  }
  return (
    <form className="commercial-form" onSubmit={submit} noValidate>
      <h3>{opportunity ? 'Editar oportunidad' : 'Nueva oportunidad'}</h3>
      <label className="field">
        <span>Nombre de la oportunidad</span>
        <input
          value={input.name}
          onChange={(e) => setInput({ ...input, name: e.target.value })}
          required
        />
      </label>
      <label className="field">
        <span>Dirección (opcional)</span>
        <input
          value={input.address}
          onChange={(e) => setInput({ ...input, address: e.target.value })}
        />
      </label>
      <label className="field">
        <span>Fecha estimada de inicio (opcional)</span>
        <input
          type="date"
          value={input.estimatedStartDate}
          onChange={(e) => setInput({ ...input, estimatedStartDate: e.target.value })}
        />
      </label>
      <label className="field">
        <span>Vendedor responsable (opcional)</span>
        <input
          value={input.responsibleSeller}
          onChange={(e) => setInput({ ...input, responsibleSeller: e.target.value })}
        />
      </label>
      {error && (
        <p className="commercial-warning" role="alert">
          {error}
        </p>
      )}
      <div className="commercial-actions">
        <button className="button button-line" type="submit">
          Guardar oportunidad
        </button>
        <button className="button button-line" type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
