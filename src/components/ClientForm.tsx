import { useState, type FormEvent } from 'react';
import type { Client, ClientInput, PreferredChannel } from '../types/client';
import type { Prospect } from '../types/prospect';
import {
  clientFormFieldOrder,
  getClientFieldErrors,
  getClientValidationError,
  isPendingEmail,
  isPendingPhone,
  normalizeClientInput,
  PENDING_EMAIL,
  PENDING_PHONE,
  type ClientFormField,
} from '../utils/clientValidation';
import { FieldError } from './FieldError';
import { useFieldValidation } from './useFieldValidation';

/** Prospect data edited together with the contact (SCRUM-120). */
export interface ContactProspectExtras {
  instagram: string;
  address: string;
  source: string;
  potentialService: string;
  notes: string;
}

interface Props {
  client?: Client;
  /** When the contact came from a prospect, its data is edited in the same form. */
  prospect?: Prospect;
  /** Returns an error message, or null when saved. May be async (Supabase, SCRUM-113). */
  onSave: (
    input: ClientInput,
    extras?: ContactProspectExtras,
  ) => string | null | Promise<string | null>;
  onCancel: () => void;
}

/**
 * SCRUM-120: an empty phone or email is stored as the internal "pending" value, but the user
 * never sees or types "1111111111" or "none". Consent and do-not-contact are no longer edited
 * here: "No interesado" and the next step cover that; existing values are kept as they are.
 */
export function ClientForm({ client, prospect, onSave, onCancel }: Props) {
  const [input, setInput] = useState<ClientInput>(() => {
    const base = client ?? {
      name: '',
      phone: '',
      email: '',
      preferredChannel: '' as PreferredChannel,
      contactConsent: false,
    };
    return {
      ...base,
      phone: isPendingPhone(base.phone) ? '' : base.phone,
      email: isPendingEmail(base.email) ? '' : base.email,
    };
  });
  const [extras, setExtras] = useState<ContactProspectExtras>({
    instagram: prospect?.instagram ?? '',
    address: prospect?.address ?? '',
    source: prospect?.source ?? '',
    potentialService: prospect?.potentialService ?? '',
    notes: prospect?.notes ?? '',
  });
  const [error, setError] = useState<string | null>(null);
  const buildInput = (): ClientInput => ({
    ...input,
    phone: input.phone.trim() ? input.phone : PENDING_PHONE,
    email: input.email.trim() ? input.email : PENDING_EMAIL,
  });
  const validation = useFieldValidation(
    `client-${client?.id ?? 'new'}`,
    getClientFieldErrors(buildInput()),
    clientFormFieldOrder,
  );
  const fieldError = (field: ClientFormField) => (
    <FieldError id={validation.errorId(field)} message={validation.visibleError(field)} />
  );
  const [isSaving, setIsSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (isSaving) return;
    if (!validation.validateForSubmit()) return setError(null);
    const next = buildInput();
    // The stored-data rules still run before saving; field errors cover every case they check.
    const stored = getClientValidationError(next);
    if (stored) return setError(stored);
    setIsSaving(true);
    try {
      setError(
        await onSave(
          normalizeClientInput(next),
          prospect
            ? {
                instagram: extras.instagram.trim(),
                address: extras.address.trim(),
                source: extras.source.trim(),
                potentialService: extras.potentialService.trim(),
                notes: extras.notes.trim(),
              }
            : undefined,
        ),
      );
    } finally {
      setIsSaving(false);
    }
  }
  const extraField = (key: keyof ContactProspectExtras, label: string) => (
    <label className="field">
      <span>{label}</span>
      {key === 'notes' ? (
        <textarea
          value={extras[key]}
          rows={3}
          onChange={(e) => setExtras({ ...extras, [key]: e.target.value })}
        />
      ) : (
        <input
          value={extras[key]}
          onChange={(e) => setExtras({ ...extras, [key]: e.target.value })}
        />
      )}
    </label>
  );
  return (
    <form className="commercial-form" onSubmit={(event) => void submit(event)} noValidate>
      <h3>{client ? 'Editar contacto' : 'Nuevo contacto'}</h3>
      <label className="field">
        <span>Nombre</span>
        <input
          value={input.name}
          onChange={(e) => setInput({ ...input, name: e.target.value })}
          required
          {...validation.fieldProps('name')}
        />
        {fieldError('name')}
      </label>
      <label className="field">
        <span>Empresa</span>
        <input
          value={input.company ?? ''}
          onChange={(e) => setInput({ ...input, company: e.target.value })}
        />
      </label>
      <label className="field">
        <span>Teléfono</span>
        <input
          type="tel"
          value={input.phone}
          placeholder="Sin definir"
          onChange={(e) => setInput({ ...input, phone: e.target.value })}
          {...validation.fieldProps('phone')}
        />
        {fieldError('phone')}
      </label>
      <label className="field">
        <span>Email</span>
        <input
          type="text"
          inputMode="email"
          value={input.email}
          placeholder="Sin definir"
          onChange={(e) => setInput({ ...input, email: e.target.value })}
          {...validation.fieldProps('email')}
        />
        {fieldError('email')}
      </label>
      {prospect && extraField('instagram', 'Instagram')}
      {prospect && extraField('address', 'Dirección')}
      {prospect && extraField('source', 'Origen')}
      {prospect && extraField('potentialService', 'Servicio potencial')}
      <label className="field">
        <span>Canal preferido</span>
        <select
          value={input.preferredChannel}
          onChange={(e) =>
            setInput({ ...input, preferredChannel: e.target.value as PreferredChannel })
          }
          {...validation.fieldProps('preferredChannel')}
        >
          <option value="">Sin preferencia</option>
          <option value="phone">Teléfono</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
        </select>
        {fieldError('preferredChannel')}
      </label>
      {prospect && extraField('notes', 'Observaciones')}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="commercial-actions">
        <button className="button button-primary" type="submit" disabled={isSaving}>
          {isSaving ? 'Guardando…' : 'Guardar contacto'}
        </button>
        <button className="button button-line" type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
