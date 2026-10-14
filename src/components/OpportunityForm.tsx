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
      nextAction: undefined,
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
      <fieldset className="commercial-form">
        <legend>Próxima acción (opcional)</legend>
        <label className="field">
          <span>Descripción</span>
          <input
            value={input.nextAction?.description ?? ''}
            onChange={(e) =>
              setInput({
                ...input,
                nextAction: {
                  description: e.target.value,
                  dueDate: input.nextAction?.dueDate ?? '',
                  responsible: input.nextAction?.responsible ?? '',
                  status: input.nextAction?.status ?? 'pending',
                },
              })
            }
          />
        </label>
        <label className="field">
          <span>Fecha</span>
          <input
            type="date"
            value={input.nextAction?.dueDate ?? ''}
            onChange={(e) =>
              setInput({
                ...input,
                nextAction: {
                  description: input.nextAction?.description ?? '',
                  dueDate: e.target.value,
                  responsible: input.nextAction?.responsible ?? '',
                  status: input.nextAction?.status ?? 'pending',
                },
              })
            }
          />
        </label>
        <label className="field">
          <span>Responsable</span>
          <input
            value={input.nextAction?.responsible ?? ''}
            onChange={(e) =>
              setInput({
                ...input,
                nextAction: {
                  description: input.nextAction?.description ?? '',
                  dueDate: input.nextAction?.dueDate ?? '',
                  responsible: e.target.value,
                  status: input.nextAction?.status ?? 'pending',
                },
              })
            }
          />
        </label>
        <label className="field">
          <span>Estado</span>
          <select
            value={input.nextAction?.status ?? 'pending'}
            onChange={(e) =>
              setInput({
                ...input,
                nextAction: {
                  description: input.nextAction?.description ?? '',
                  dueDate: input.nextAction?.dueDate ?? '',
                  responsible: input.nextAction?.responsible ?? '',
                  status: e.target.value as 'pending' | 'completed' | 'cancelled',
                },
              })
            }
          >
            <option value="pending">Pendiente</option>
            <option value="completed">Completada</option>
            <option value="cancelled">Cancelada</option>
          </select>
        </label>
      </fieldset>
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
