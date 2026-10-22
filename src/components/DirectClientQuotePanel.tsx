import { useMemo, useState } from 'react';
import type { Client } from '../types/client';
import type { DirectClientInput, DirectQuoteFollowUpInput } from '../utils/directClientQuote';

interface Props {
  clients: readonly Client[];
  selectedClientId?: string;
  onSelectExisting(client: Client): void;
  onDirectChange(input: DirectClientInput | null, followUp?: DirectQuoteFollowUpInput): void;
}

export function DirectClientQuotePanel({
  clients,
  selectedClientId,
  onSelectExisting,
  onDirectChange,
}: Props) {
  const [mode, setMode] = useState<'opportunity' | 'direct'>('opportunity');
  const [query, setQuery] = useState('');
  const [input, setInput] = useState<DirectClientInput>({
    name: '',
    company: '',
    phone: '',
    email: '',
    projectName: '',
  });
  const [schedule, setSchedule] = useState(false);
  const [followUp, setFollowUp] = useState<DirectQuoteFollowUpInput>({
    dueAt: '',
    channel: 'call',
    responsible: '',
  });
  function updateInput(next: DirectClientInput) {
    setInput(next);
    onDirectChange(next, schedule ? followUp : undefined);
  }
  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return clients.slice(0, 6);
    return clients
      .filter((client) =>
        [client.name, client.company, client.phone, client.email].some((value) =>
          value?.toLowerCase().includes(normalized),
        ),
      )
      .slice(0, 6);
  }, [clients, query]);
  const duplicates = useMemo(() => {
    const phone = input.phone.replace(/\D/g, '');
    const email = input.email.trim().toLowerCase();
    const name = input.name.trim().toLowerCase();
    const company = input.company.trim().toLowerCase();
    return clients.filter(
      (client) =>
        (phone.length >= 7 && client.phone.replace(/\D/g, '') === phone) ||
        (email.length > 0 && client.email.trim().toLowerCase() === email) ||
        Boolean(
          name &&
          company &&
          client.name.trim().toLowerCase() === name &&
          client.company?.trim().toLowerCase() === company,
        ),
    );
  }, [clients, input]);
  return (
    <section className="quote-card direct-client-panel" aria-labelledby="quote-origin-title">
      <div className="quote-heading">
        <div>
          <p className="eyebrow">Cliente</p>
          <h2 id="quote-origin-title">¿Cómo querés vincular este presupuesto?</h2>
        </div>
      </div>
      <div className="direct-client-choice" role="radiogroup" aria-label="Origen del presupuesto">
        <button
          type="button"
          className={`direct-client-option ${mode === 'opportunity' ? 'direct-client-option-active' : ''}`}
          onClick={() => {
            setMode('opportunity');
            onDirectChange(null);
          }}
          aria-pressed={mode === 'opportunity'}
        >
          <strong>Vincular a oportunidad existente</strong>
          <span>Elegí una obra o trabajo desde el contexto comercial.</span>
        </button>
        <button
          type="button"
          className={`direct-client-option ${mode === 'direct' ? 'direct-client-option-active' : ''}`}
          onClick={() => {
            setMode('direct');
            onDirectChange(input, schedule ? followUp : undefined);
          }}
          aria-pressed={mode === 'direct'}
        >
          <strong>Cliente directo</strong>
          <span>Creá un presupuesto sin inventar una oportunidad.</span>
        </button>
      </div>
      {mode === 'direct' && (
        <div className="direct-client-fields">
          <label className="field">
            <span>Buscar cliente existente</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nombre, empresa, teléfono o email"
            />
          </label>
          {matches.length > 0 && (
            <div className="direct-client-matches">
              {matches.map((client) => (
                <button
                  type="button"
                  key={client.id}
                  className={`button button-line ${selectedClientId === client.id ? 'is-selected' : ''}`}
                  onClick={() => onSelectExisting(client)}
                >
                  {client.name}
                  {client.company ? ` · ${client.company}` : ''}
                </button>
              ))}
            </div>
          )}
          <p className="commercial-note">o completá los datos de un cliente nuevo</p>
          <div className="form-grid">
            <label className="field">
              <span>Nombre</span>
              <input
                value={input.name}
                onChange={(event) => updateInput({ ...input, name: event.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>Empresa</span>
              <input
                value={input.company}
                onChange={(event) => updateInput({ ...input, company: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Teléfono (opcional)</span>
              <input
                type="tel"
                value={input.phone}
                onChange={(event) => updateInput({ ...input, phone: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Email (opcional)</span>
              <input
                type="email"
                value={input.email}
                onChange={(event) => updateInput({ ...input, email: event.target.value })}
              />
            </label>
          </div>
          {duplicates.length > 0 && (
            <aside className="commercial-warning" aria-live="polite">
              <strong>Encontramos posibles clientes duplicados.</strong>
              <div className="direct-client-matches">
                {duplicates.map((client) => (
                  <button
                    type="button"
                    key={client.id}
                    className="button button-line"
                    onClick={() => onSelectExisting(client)}
                  >
                    Usar {client.name}
                  </button>
                ))}
              </div>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={Boolean(input.duplicateConfirmed)}
                  onChange={(event) =>
                    updateInput({ ...input, duplicateConfirmed: event.target.checked })
                  }
                />
                <span>Crear igualmente</span>
              </label>
              {input.duplicateConfirmed && (
                <label className="field">
                  <span>Motivo</span>
                  <input
                    value={input.duplicateReason ?? ''}
                    onChange={(event) =>
                      updateInput({ ...input, duplicateReason: event.target.value })
                    }
                    required
                  />
                </label>
              )}
            </aside>
          )}
          <label className="field">
            <span>Proyecto o descripción (opcional)</span>
            <input
              value={input.projectName}
              onChange={(event) => updateInput({ ...input, projectName: event.target.value })}
            />
          </label>
          <p className="commercial-note">
            El cliente se guardará junto con el presupuesto. No se creará nada hasta guardar el
            borrador o continuar.
          </p>
          <section className="direct-follow-up" aria-label="Seguimiento opcional">
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={schedule}
                onChange={(event) => {
                  const next = event.target.checked;
                  setSchedule(next);
                  onDirectChange(input, next ? followUp : undefined);
                }}
              />
              <span>Agendar seguimiento</span>
            </label>
            {schedule && (
              <div className="form-grid">
                <label className="field">
                  <span>Fecha y hora</span>
                  <input
                    type="datetime-local"
                    value={followUp.dueAt}
                    onChange={(event) => {
                      const next = { ...followUp, dueAt: event.target.value };
                      setFollowUp(next);
                      onDirectChange(input, next);
                    }}
                    required
                  />
                </label>
                <label className="field">
                  <span>Canal</span>
                  <select
                    value={followUp.channel}
                    onChange={(event) => {
                      const next = {
                        ...followUp,
                        channel: event.target.value as DirectQuoteFollowUpInput['channel'],
                      };
                      setFollowUp(next);
                      onDirectChange(input, next);
                    }}
                  >
                    <option value="call">Llamada</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Email</option>
                    <option value="meeting">Reunión</option>
                    <option value="other">Otro</option>
                  </select>
                </label>
                <label className="field">
                  <span>Responsable</span>
                  <input
                    value={followUp.responsible}
                    onChange={(event) => {
                      const next = { ...followUp, responsible: event.target.value };
                      setFollowUp(next);
                      onDirectChange(input, next);
                    }}
                    required
                  />
                </label>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
