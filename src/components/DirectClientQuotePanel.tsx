import { useMemo, useState } from 'react';
import type { Client } from '../types/client';
import type { Opportunity } from '../types/opportunity';
import type { DirectClientInput, DirectQuoteFollowUpInput } from '../utils/directClientQuote';

interface Props {
  clients: readonly Client[];
  opportunities: readonly Opportunity[];
  onSelectOpportunity(opportunity: Opportunity): void;
  onDirectChange(input: DirectClientInput | null, followUp?: DirectQuoteFollowUpInput): void;
}

export function DirectClientQuotePanel({
  clients,
  opportunities,
  onSelectOpportunity,
  onDirectChange,
}: Props) {
  const [mode, setMode] = useState<'opportunity' | 'direct'>('opportunity');
  const [opportunityQuery, setOpportunityQuery] = useState('');
  const [clientQuery, setClientQuery] = useState('');
  const [isOpportunityMenuOpen, setIsOpportunityMenuOpen] = useState(false);
  const [isClientMenuOpen, setIsClientMenuOpen] = useState(false);
  const [input, setInput] = useState<DirectClientInput>({
    name: '',
    company: '',
    phone: '',
    email: '',
    projectName: '',
    origin: '',
    serviceOfInterest: '',
    observations: '',
  });
  const [schedule, setSchedule] = useState(true);
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
    const normalized = clientQuery.trim().toLowerCase();
    if (!normalized) return clients.slice(0, 6);
    return clients
      .filter((client) =>
        [client.name, client.company, client.phone, client.email].some((value) =>
          value?.toLowerCase().includes(normalized),
        ),
      )
      .slice(0, 6);
  }, [clients, clientQuery]);
  const opportunityMatches = useMemo(() => {
    const normalized = opportunityQuery.trim().toLowerCase();
    return opportunities
      .filter((opportunity) => {
        const client = clients.find((item) => item.id === opportunity.clientId);
        return [opportunity.name, client?.name, client?.company]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalized));
      })
      .slice(0, 6);
  }, [clients, opportunities, opportunityQuery]);
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
  function selectExistingClient(client: Client) {
    const next: DirectClientInput = {
      ...input,
      existingClientId: client.id,
      name: client.name,
      company: client.company ?? '',
      phone: client.phone,
      email: client.email,
      duplicateConfirmed: undefined,
      duplicateReason: undefined,
    };
    updateInput(next);
    setClientQuery([client.name, client.company].filter(Boolean).join(' · '));
    setIsClientMenuOpen(false);
  }
  function updateNewClientField(field: keyof DirectClientInput, value: string) {
    updateInput({
      ...input,
      existingClientId: undefined,
      [field]: value,
    });
  }
  return (
    <section className="quote-card direct-client-panel" aria-labelledby="quote-origin-title">
      <div className="quote-heading">
        <div>
          <p className="eyebrow">Cliente</p>
          <h2 id="quote-origin-title">Vincular a seguimiento</h2>
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
          <strong>Oportunidad existente</strong>
          <span>Elegí una obra o trabajo ya creado.</span>
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
          <strong>Crear contacto y oportunidad</strong>
          <span>Creá el contacto, la obra o trabajo y su próximo paso.</span>
        </button>
      </div>
      {mode === 'opportunity' && (
        <div className="direct-client-fields">
          <label className="field">
            <span>Buscar oportunidad</span>
            <div className="search-select">
              <input
                type="search"
                value={opportunityQuery}
                onFocus={() => setIsOpportunityMenuOpen(true)}
                onChange={(event) => {
                  setOpportunityQuery(event.target.value);
                  setIsOpportunityMenuOpen(true);
                }}
                placeholder="Cliente, empresa u obra"
                aria-expanded={isOpportunityMenuOpen}
                aria-controls="opportunity-search-results"
              />
              {isOpportunityMenuOpen && (
                <div id="opportunity-search-results" className="search-select-menu" role="listbox">
                  {opportunityMatches.length > 0 ? (
                    opportunityMatches.map((opportunity) => {
                      const client = clients.find((item) => item.id === opportunity.clientId);
                      return (
                        <button
                          type="button"
                          key={opportunity.id}
                          className="search-select-option"
                          role="option"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            setOpportunityQuery(
                              `${opportunity.name} · ${client?.name ?? 'Contacto no disponible'}`,
                            );
                            setIsOpportunityMenuOpen(false);
                            onSelectOpportunity(opportunity);
                          }}
                        >
                          <strong>{opportunity.name}</strong>
                          <span>{client?.name ?? 'Contacto no disponible'}</span>
                        </button>
                      );
                    })
                  ) : (
                    <p className="search-select-empty">No encontramos una oportunidad con esos datos.</p>
                  )}
                </div>
              )}
            </div>
          </label>
          <p className="commercial-note">Escribí para filtrar y elegí una opción de la lista.</p>
        </div>
      )}
      {mode === 'direct' && (
        <div className="direct-client-fields">
          <label className="field">
            <span>Buscar cliente existente</span>
            <div className="search-select">
              <input
                type="search"
                value={clientQuery}
                onFocus={() => setIsClientMenuOpen(true)}
                onChange={(event) => {
                  setClientQuery(event.target.value);
                  setIsClientMenuOpen(true);
                  if (input.existingClientId) updateInput({ ...input, existingClientId: undefined });
                }}
                placeholder="Nombre, empresa, teléfono o email"
                aria-expanded={isClientMenuOpen}
                aria-controls="client-search-results"
              />
              {isClientMenuOpen && (
                <div id="client-search-results" className="search-select-menu" role="listbox">
                  {matches.length > 0 ? (
                    matches.map((client) => (
                      <button
                        type="button"
                        key={client.id}
                        className="search-select-option"
                        role="option"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectExistingClient(client)}
                      >
                        <strong>{client.name}</strong>
                        <span>{client.company || client.email}</span>
                      </button>
                    ))
                  ) : (
                    <p className="search-select-empty">No encontramos un cliente con esos datos.</p>
                  )}
                </div>
              )}
            </div>
          </label>
          {input.existingClientId && (
            <p className="commercial-note">
              Cliente seleccionado. Podés escribir otra búsqueda para cambiarlo; no se duplicará.
            </p>
          )}
          <p className="commercial-note">O creá un contacto nuevo:</p>
          <h3 className="direct-client-subheading">Datos del contacto</h3>
          <div className="form-grid">
            <label className="field">
              <span>Nombre</span>
              <input
                value={input.name}
                onChange={(event) => updateNewClientField('name', event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Empresa</span>
              <input
                value={input.company}
                onChange={(event) => updateNewClientField('company', event.target.value)}
              />
            </label>
            <label className="field">
              <span>Teléfono (opcional)</span>
              <input
                type="tel"
                value={input.phone}
                onChange={(event) => updateNewClientField('phone', event.target.value)}
              />
            </label>
            <label className="field">
              <span>Email (opcional)</span>
              <input
                type="email"
                value={input.email}
                onChange={(event) => updateNewClientField('email', event.target.value)}
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
                    onClick={() => selectExistingClient(client)}
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
          <h3 className="direct-client-subheading">Datos de la oportunidad</h3>
          <div className="form-grid">
            <label className="field">
              <span>Obra o trabajo</span>
              <input
                value={input.projectName}
                onChange={(event) => updateInput({ ...input, projectName: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Servicio potencial</span>
              <input
                value={input.serviceOfInterest ?? ''}
                onChange={(event) => updateInput({ ...input, serviceOfInterest: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Origen</span>
              <input
                value={input.origin ?? ''}
                onChange={(event) => updateInput({ ...input, origin: event.target.value })}
              />
            </label>
            <label className="field field-wide">
              <span>Observaciones</span>
              <textarea
                value={input.observations ?? ''}
                onChange={(event) => updateInput({ ...input, observations: event.target.value })}
              />
            </label>
          </div>
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
              <span>Crear oportunidad y agendar próximo paso</span>
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
