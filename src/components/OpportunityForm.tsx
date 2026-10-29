import { useState, type FormEvent } from 'react';
import type { Opportunity, OpportunityInput } from '../types/opportunity';
import {
  getOpportunityFormFieldErrors,
  getOpportunityValidationError,
  normalizeOpportunityInput,
  opportunityFormFieldOrder,
} from '../utils/opportunityValidation';
import { FieldError } from './FieldError';
import { useFieldValidation } from './useFieldValidation';

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
  const validation = useFieldValidation(
    `opportunity-${opportunity?.id ?? 'new'}`,
    getOpportunityFormFieldErrors(input),
    opportunityFormFieldOrder,
  );
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!validation.validateForSubmit()) return setError(null);
    setError(getOpportunityValidationError(input) ?? onSave(normalizeOpportunityInput(input)));
  }
  return (
    <form className="commercial-form" onSubmit={submit} noValidate>
      <h3>{opportunity ? 'Editar obra o trabajo' : 'Nueva obra o trabajo'}</h3>
      <label className="field">
        <span>Nombre de la obra o trabajo</span>
        <input
          value={input.name}
          onChange={(e) => setInput({ ...input, name: e.target.value })}
          required
          {...validation.fieldProps('name')}
        />
        <FieldError id={validation.errorId('name')} message={validation.visibleError('name')} />
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
          {...validation.fieldProps('estimatedStartDate')}
        />
        <FieldError
          id={validation.errorId('estimatedStartDate')}
          message={validation.visibleError('estimatedStartDate')}
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
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="commercial-actions">
        <button className="button button-line" type="submit">
          Guardar obra o trabajo
        </button>
        <button className="button button-line" type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
