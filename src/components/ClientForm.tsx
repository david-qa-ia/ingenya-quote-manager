import { useState, type FormEvent } from 'react';
import type { Client, ClientInput, PreferredChannel } from '../types/client';
import {
  clientFormFieldOrder,
  getClientFieldErrors,
  getClientValidationError,
  normalizeClientInput,
  type ClientFormField,
} from '../utils/clientValidation';
import { FieldError } from './FieldError';
import { useFieldValidation } from './useFieldValidation';

interface Props {
  client?: Client;
  /** Returns an error message, or null when saved. May be async (Supabase, SCRUM-113). */
  onSave: (input: ClientInput) => string | null | Promise<string | null>;
  onCancel: () => void;
}

export function ClientForm({ client, onSave, onCancel }: Props) {
  const [input, setInput] = useState<ClientInput>(
    client ?? { name: '', phone: '', email: '', preferredChannel: '', contactConsent: false },
  );
  const [error, setError] = useState<string | null>(null);
  const [doNotContact, setDoNotContact] = useState(Boolean(client?.doNotContact));
  const [doNotContactReason, setDoNotContactReason] = useState(client?.doNotContact?.reason ?? '');
  const [doNotContactAuthor, setDoNotContactAuthor] = useState(
    client?.doNotContact?.recordedBy ?? '',
  );
  const buildInput = (): ClientInput => ({
    ...input,
    ...(doNotContact
      ? {
          doNotContact: {
            reason: doNotContactReason,
            recordedAt: new Date().toISOString(),
            recordedBy: doNotContactAuthor,
          },
        }
      : {}),
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
      setError(await onSave(normalizeClientInput(next)));
    } finally {
      setIsSaving(false);
    }
  }
  return (
    <form className="commercial-form" onSubmit={(event) => void submit(event)} noValidate>
      <h3>{client ? 'Editar cliente' : 'Nuevo cliente'}</h3>
      <label className="field">
        <span>Nombre del cliente</span>
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
        <span>Teléfono del cliente</span>
        <input
          type="tel"
          value={input.phone}
          onChange={(e) => setInput({ ...input, phone: e.target.value })}
          required
          {...validation.fieldProps('phone')}
        />
        <small>Si está pendiente de confirmar, ingresá 1111111111.</small>
        {fieldError('phone')}
      </label>
      <label className="field">
        <span>Email del cliente</span>
        <input
          type="text"
          inputMode="email"
          value={input.email}
          onChange={(e) => setInput({ ...input, email: e.target.value })}
          required
          {...validation.fieldProps('email')}
        />
        <small>Si está pendiente de confirmar, ingresá none.</small>
        {fieldError('email')}
      </label>
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
      <label className="commercial-consent">
        <input
          type="checkbox"
          checked={input.contactConsent}
          onChange={(e) => setInput({ ...input, contactConsent: e.target.checked })}
        />
        El cliente autorizó el contacto
      </label>
      <label className="commercial-consent">
        <input
          type="checkbox"
          checked={doNotContact}
          onChange={(event) => setDoNotContact(event.target.checked)}
        />
        El cliente solicitó no recibir más contactos
      </label>
      {doNotContact && (
        <>
          <label className="field">
            <span>Motivo del no contacto</span>
            <textarea
              value={doNotContactReason}
              onChange={(event) => setDoNotContactReason(event.target.value)}
              {...validation.fieldProps('doNotContactReason')}
            />
            {fieldError('doNotContactReason')}
          </label>
          <label className="field">
            <span>Registrado por</span>
            <input
              value={doNotContactAuthor}
              onChange={(event) => setDoNotContactAuthor(event.target.value)}
              {...validation.fieldProps('doNotContactAuthor')}
            />
            {fieldError('doNotContactAuthor')}
          </label>
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="commercial-actions">
        <button className="button button-line" type="submit" disabled={isSaving}>
          {isSaving ? 'Guardando…' : 'Guardar cliente'}
        </button>
        <button className="button button-line" type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
