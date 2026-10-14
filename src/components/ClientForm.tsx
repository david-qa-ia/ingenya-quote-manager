import { useState, type FormEvent } from 'react';
import type { Client, ClientInput, PreferredChannel } from '../types/client';
import { getClientValidationError, normalizeClientInput } from '../utils/clientValidation';

interface Props {
  client?: Client;
  onSave: (input: ClientInput) => string | null;
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
  function submit(event: FormEvent) {
    event.preventDefault();
    const next = {
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
    };
    const validation = getClientValidationError(next);
    setError(validation ?? onSave(normalizeClientInput(next)));
  }
  return (
    <form className="commercial-form" onSubmit={submit} noValidate>
      <h3>{client ? 'Editar cliente' : 'Nuevo cliente'}</h3>
      <label className="field">
        <span>Nombre del cliente</span>
        <input
          value={input.name}
          onChange={(e) => setInput({ ...input, name: e.target.value })}
          required
        />
      </label>
      <label className="field">
        <span>Teléfono del cliente</span>
        <input
          type="tel"
          value={input.phone}
          onChange={(e) => setInput({ ...input, phone: e.target.value })}
          required
        />
        <small>Si está pendiente de confirmar, ingresá 1111111111.</small>
      </label>
      <label className="field">
        <span>Email del cliente</span>
        <input
          type="text"
          inputMode="email"
          value={input.email}
          onChange={(e) => setInput({ ...input, email: e.target.value })}
          required
        />
        <small>Si está pendiente de confirmar, ingresá none.</small>
      </label>
      <label className="field">
        <span>Canal preferido</span>
        <select
          value={input.preferredChannel}
          onChange={(e) =>
            setInput({ ...input, preferredChannel: e.target.value as PreferredChannel })
          }
        >
          <option value="">Sin preferencia</option>
          <option value="phone">Teléfono</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="email">Email</option>
        </select>
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
            />
          </label>
          <label className="field">
            <span>Registrado por</span>
            <input
              value={doNotContactAuthor}
              onChange={(event) => setDoNotContactAuthor(event.target.value)}
            />
          </label>
        </>
      )}
      {error && (
        <p className="commercial-warning" role="alert">
          {error}
        </p>
      )}
      <div className="commercial-actions">
        <button className="button button-line" type="submit">
          Guardar cliente
        </button>
        <button className="button button-line" type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
