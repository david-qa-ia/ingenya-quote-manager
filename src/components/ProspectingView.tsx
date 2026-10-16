import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type {
  Prospect,
  ProspectChannel,
  ProspectContactResult,
  ProspectPriority,
  ProspectStatus,
} from '../types/prospect';
import {
  createNewProspect,
  isProspectContactAvailable,
  loadProspects,
  saveProspect,
  saveProspectWithResult,
} from '../utils/prospectStorage';
import { previewProspectCsv } from '../utils/prospectImport';
import { isoToLocalDateTime } from '../utils/prospectFollowUp';
import {
  filterProspects,
  createProspectWhatsAppUrl,
  getDueGroup,
  prospectPriorityLabels,
  prospectChannelLabels,
  prospectContactResultLabels,
  prospectStatusLabels,
  getProspectActionValidationError,
  registerProspectAction,
  sortProspectsForContact,
  transitionProspect,
  type ProspectFilters,
} from '../utils/prospectWorkflow';

const statuses = Object.keys(prospectStatusLabels) as ProspectStatus[];
const priorities = Object.keys(prospectPriorityLabels) as ProspectPriority[];
const channels: { value: ProspectChannel; label: string }[] = [
  { value: 'phone', label: 'Llamada' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
];
const activityTypeLabels = {
  statusChanged: 'Cambio de estado',
  contactPrepared: 'Contacto preparado',
  contactResult: 'Contacto registrado',
  note: 'Nota',
} as const;
type DueGroup = 'overdue' | 'today' | 'upcoming';

interface Props {
  initialFilters: ProspectFilters;
  onFiltersChange: (filters: ProspectFilters) => void;
}

export function ProspectingView({ initialFilters, onFiltersChange }: Props) {
  const [prospects, setProspects] = useState(() => loadProspects().items);
  const [filters, setFilters] = useState(initialFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creationDraft, setCreationDraft] = useState<Prospect | null>(null);
  const initialContactChannel: ProspectChannel = 'phone';
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [csvFileName, setCsvFileName] = useState('');
  const [feedback, setFeedback] = useState('');
  const [toast, setToast] = useState('');
  const [actionProspect, setActionProspect] = useState<Prospect | null>(null);
  const [actionInitialResult, setActionInitialResult] =
    useState<ProspectContactResult>('contacted');
  const [inboxSelectedId, setInboxSelectedId] = useState<string | null>(null);
  const [inboxGroup, setInboxGroup] = useState<DueGroup>('today');
  const csvInputRef = useRef<HTMLInputElement>(null);
  const selected = prospects.find((item) => item.id === selectedId);
  const inboxSelected = prospects.find((item) => item.id === inboxSelectedId);
  const visible = useMemo(() => filterProspects(prospects, filters), [prospects, filters]);
  const rows = useMemo(() => previewProspectCsv(csv, prospects), [csv, prospects]);
  const validRows = rows.filter((row) => !row.reason && !row.duplicate);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    if (!inboxSelectedId || actionProspect) return;
    function closePanel(event: KeyboardEvent) {
      if (event.key === 'Escape') setInboxSelectedId(null);
    }
    document.addEventListener('keydown', closePanel);
    return () => document.removeEventListener('keydown', closePanel);
  }, [actionProspect, inboxSelectedId]);
  function updateFilters(next: ProspectFilters) {
    setFilters(next);
    onFiltersChange(next);
  }
  function refresh() {
    setProspects(loadProspects().items);
  }
  function save(next: Prospect, openDetail = true): boolean {
    const result = saveProspectWithResult(next);
    if (!result.ok) {
      setFeedback(
        `No se pudo guardar (${result.reason})${result.error ? `: ${result.error}` : ''}`,
      );
      return false;
    }
    refresh();
    if (openDetail) setSelectedId(next.id);
    setFeedback('Prospecto guardado localmente.');
    return true;
  }
  function importRows() {
    let saved = 0;
    validRows.forEach((row) => {
      const now = new Date().toISOString();
      const prospect: Prospect = {
        ...row.input,
        id: crypto.randomUUID(),
        activities: [
          {
            id: crypto.randomUUID(),
            occurredAt: now,
            type: 'note',
            description: 'Prospecto importado.',
          },
        ],
        createdAt: now,
        updatedAt: now,
      };
      if (saveProspect(prospect)) saved += 1;
    });
    refresh();
    setFeedback(
      `${saved} prospecto(s) importado(s). Las filas inválidas o duplicadas no se agregaron.`,
    );
    setCsv('');
    setCsvFileName('');
    if (csvInputRef.current) csvInputRef.current.value = '';
    setIsImportOpen(false);
  }
  function cancelImport() {
    setCsv('');
    setCsvFileName('');
    if (csvInputRef.current) csvInputRef.current.value = '';
    setIsImportOpen(false);
  }
  async function handleCsvFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLocaleLowerCase('es').endsWith('.csv')) {
      setCsv('');
      setCsvFileName('');
      setFeedback('Elegí un archivo con extensión .csv.');
      return;
    }
    try {
      setCsv(await file.text());
      setCsvFileName(file.name);
      setFeedback('');
    } catch {
      setCsv('');
      setCsvFileName('');
      setFeedback('No se pudo leer el archivo CSV.');
    }
  }
  function handleNew() {
    setCreationDraft(createNewProspect());
    setFeedback('');
  }
  async function copyContact(value: string, label: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setToast(`${label} copiado`);
    } catch {
      setToast(`No se pudo copiar ${label.toLocaleLowerCase('es')}.`);
    }
  }
  if (creationDraft)
    return (
      <ProspectDetail
        key={`new-${creationDraft.id}`}
        prospect={creationDraft}
        initialContactChannel={initialContactChannel}
        isNew
        onBack={() => setCreationDraft(null)}
        onSave={(prospect) => {
          const saved = save(prospect);
          if (saved) setCreationDraft(null);
          return saved;
        }}
        feedback={feedback}
      />
    );
  if (selected)
    return (
      <ProspectDetail
        prospect={selected}
        initialContactChannel={initialContactChannel}
        onBack={() => setSelectedId(null)}
        onSave={save}
        feedback={feedback}
      />
    );
  const grouped = (group: DueGroup) =>
    sortProspectsForContact(visible.filter((item) => getDueGroup(item) === group));
  const inboxGroups: { key: DueGroup; label: string }[] = [
    { key: 'overdue', label: 'Vencidos' },
    { key: 'today', label: 'Hoy' },
    { key: 'upcoming', label: 'Próximos' },
  ];
  const dailyDate = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
  return (
    <main className="app-shell prospecting-shell">
      {toast && (
        <p className="prospect-toast" role="status">
          {toast}
        </p>
      )}
      <header className="page-header">
        <div>
          <p className="eyebrow">Ingenya · Prospección comercial</p>
          <h1>Prospectos</h1>
          <p className="page-description">
            Un prospecto todavía no es cliente ni una obra o trabajo en seguimiento.
          </p>
        </div>
        <div className="header-actions">
          <button
            className="button button-line"
            type="button"
            onClick={() => setIsImportOpen((open) => !open)}
          >
            Importar CSV
          </button>
          <button className="button button-primary" type="button" onClick={handleNew}>
            + Nuevo prospecto
          </button>
        </div>
      </header>
      {feedback && (
        <p className="commercial-note" role="status">
          {feedback}
        </p>
      )}
      {isImportOpen && (
        <section className="quote-card prospect-import">
          <h2>Importar prospectos</h2>
          <p>
            Elegí un archivo CSV con los encabezados: name, company, phone, email, source,
            potentialService y notes.
          </p>
          <label className="field" htmlFor="prospect-csv-file">
            <span>Archivo CSV</span>
            <input
              ref={csvInputRef}
              id="prospect-csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={handleCsvFile}
            />
          </label>
          {csvFileName && <p className="commercial-note">Archivo seleccionado: {csvFileName}</p>}
          {csv && (
            <p>
              <strong>{validRows.length}</strong> válidas ·{' '}
              <strong>{rows.filter((row) => row.reason).length}</strong> inválidas ·{' '}
              <strong>{rows.filter((row) => row.duplicate).length}</strong> duplicadas
            </p>
          )}
          <ul className="import-preview">
            {rows.map((row) => (
              <li key={row.line}>
                Fila {row.line}:{' '}
                {row.reason ?? (row.duplicate ? 'Duplicada, no se importará.' : 'Válida.')}
              </li>
            ))}
          </ul>
          <button
            className="button button-primary"
            type="button"
            disabled={!validRows.length}
            onClick={importRows}
          >
            Confirmar importación
          </button>
          <button className="button button-line" type="button" onClick={cancelImport}>
            Cancelar
          </button>
        </section>
      )}
      <section className="quote-card prospect-inbox">
        <div className="quote-heading">
          <div>
            <p className="eyebrow">Bandeja diaria</p>
            <h2>A quién contactar hoy</h2>
            <p className="prospect-daily-date">Hoy, {dailyDate}</p>
          </div>
        </div>
        <div
          className="prospect-inbox-tabs"
          role="tablist"
          aria-label="Categorías de la bandeja diaria"
        >
          {inboxGroups.map((group) => (
            <button
              key={group.key}
              className={`prospect-inbox-tab ${inboxGroup === group.key ? 'prospect-inbox-tab-active' : ''}`}
              type="button"
              role="tab"
              aria-selected={inboxGroup === group.key}
              onClick={() => setInboxGroup(group.key)}
            >
              <span>{group.label}</span>
              <strong>{grouped(group.key).length}</strong>
            </button>
          ))}
        </div>
        <div
          className={`prospect-inbox-layout ${inboxSelected ? 'prospect-inbox-detail-open' : ''}`}
        >
          <div className="prospect-inbox-queue">
            <div className="prospect-queue-list" role="tabpanel">
              {grouped(inboxGroup).length ? (
                grouped(inboxGroup).map((prospect) => (
                  <ProspectQueueRow
                    key={prospect.id}
                    prospect={prospect}
                    group={inboxGroup}
                    isSelected={prospect.id === inboxSelectedId}
                    onSelect={() => setInboxSelectedId(prospect.id)}
                    onToast={setToast}
                    onRegister={() => {
                      setActionInitialResult('contacted');
                      setActionProspect(prospect);
                    }}
                  />
                ))
              ) : (
                <div className="empty-state">
                  <h3>No hay prospectos en esta categoría</h3>
                  <p>Elegí otra categoría de la bandeja diaria para continuar.</p>
                </div>
              )}
            </div>
          </div>
          {inboxSelected && (
            <ProspectInboxDetail
              prospect={inboxSelected}
              onClose={() => setInboxSelectedId(null)}
              onCopy={copyContact}
              onOpen={() => setSelectedId(inboxSelected.id)}
              onRegister={(result = 'contacted') => {
                setActionInitialResult(result);
                setActionProspect(inboxSelected);
              }}
            />
          )}
        </div>
      </section>
      <section className="quote-card prospect-list">
        <div className="quote-heading">
          <div>
            <p className="eyebrow">Administración</p>
            <h2>Todos los prospectos</h2>
          </div>
          <span className="line-count">{visible.length}</span>
        </div>
        <div className="prospect-filters">
          <label className="field">
            <span>Estado</span>
            <select
              value={filters.status}
              onChange={(e) =>
                updateFilters({ ...filters, status: e.target.value as ProspectFilters['status'] })
              }
            >
              <option value="all">Todos</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {prospectStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Prioridad</span>
            <select
              value={filters.priority}
              onChange={(e) =>
                updateFilters({
                  ...filters,
                  priority: e.target.value as ProspectFilters['priority'],
                })
              }
            >
              <option value="all">Todas</option>
              {priorities.map((priority) => (
                <option key={priority} value={priority}>
                  {prospectPriorityLabels[priority]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Canal</span>
            <select
              value={filters.channel}
              onChange={(e) => updateFilters({ ...filters, channel: e.target.value })}
            >
              <option value="all">Todos</option>
              {channels.map((channel) => (
                <option key={channel.value} value={channel.value}>
                  {channel.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Servicio potencial</span>
            <select
              value={filters.service}
              onChange={(e) => updateFilters({ ...filters, service: e.target.value })}
            >
              <option value="all">Todos</option>
              {[...new Set(prospects.map((item) => item.potentialService).filter(Boolean))].map(
                (service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
        {visible.length ? (
          <div className="prospect-cards">
            {sortProspectsForContact(visible).map((prospect) => (
              <ProspectRow
                key={prospect.id}
                prospect={prospect}
                onOpen={() => setSelectedId(prospect.id)}
                onCopy={copyContact}
                onToast={setToast}
                onRegister={() => setActionProspect(prospect)}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No hay prospectos con estos filtros</h3>
            <p>Importá una lista o creá un prospecto para comenzar.</p>
          </div>
        )}
      </section>
      {actionProspect && (
        <ProspectActionModal
          prospect={actionProspect}
          onClose={() => setActionProspect(null)}
          initialResult={actionInitialResult}
          onSave={(input) => {
            if (!save(registerProspectAction(actionProspect, input), false)) return;
            setActionProspect(null);
            setToast('Acción registrada.');
          }}
        />
      )}
    </main>
  );
}

function ProspectRow({
  prospect,
  isInboxSelected = false,
  onSelect,
  onOpen,
  onCopy,
  onToast,
  onRegister,
}: {
  prospect: Prospect;
  isInboxSelected?: boolean;
  onSelect?: () => void;
  onOpen: () => void;
  onCopy: (value: string, label: string) => void;
  onToast: (message: string) => void;
  onRegister: () => void;
}) {
  const whatsappUrl = createProspectWhatsAppUrl(prospect.phone);
  const initials = prospect.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase('es');
  return (
    <article
      className={`prospect-row ${isInboxSelected ? 'prospect-row-selected' : ''}`}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={onSelect ? `Ver detalle rápido de ${prospect.name}` : undefined}
      onClick={(event) => {
        if (onSelect && !(event.target as HTMLElement).closest('button, a')) onSelect();
      }}
      onKeyDown={(event) => {
        if (onSelect && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="prospect-identity">
        <span className="prospect-avatar" aria-hidden="true">
          {initials || '?'}
        </span>
        <div>
          <strong>{prospect.name}</strong>
          {prospect.company && <span className="prospect-company">{prospect.company}</span>}
          <div className="prospect-badges">
            <span className={`status-badge prospect-status-${prospect.status}`}>
              {prospectStatusLabels[prospect.status]}
            </span>
            <span className="prospect-priority">
              Prioridad {prospectPriorityLabels[prospect.priority]}
            </span>
          </div>
        </div>
      </div>
      <div className="prospect-contact-values" aria-label={`Datos de contacto de ${prospect.name}`}>
        <span className="prospect-contact-item">
          <span className="prospect-contact-text">{prospect.phone || 'Teléfono pendiente'}</span>
          {isProspectContactAvailable(prospect, 'phone') && (
            <button
              className="prospect-copy"
              type="button"
              aria-label="Copiar teléfono"
              title="Copiar teléfono"
              onClick={() => onCopy(prospect.phone, 'Teléfono')}
            >
              ⧉
            </button>
          )}
        </span>
        <span className="prospect-contact-item">
          <span className="prospect-contact-text">{prospect.email || 'Email pendiente'}</span>
          {isProspectContactAvailable(prospect, 'email') && (
            <button
              className="prospect-copy"
              type="button"
              aria-label="Copiar email"
              title="Copiar email"
              onClick={() => onCopy(prospect.email, 'Email')}
            >
              ⧉
            </button>
          )}
        </span>
      </div>
      <div className="prospect-row-actions">
        {whatsappUrl ? (
          <a
            className="button button-primary prospect-whatsapp"
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => onToast('WhatsApp abierto.')}
          >
            <span aria-hidden="true">◔</span> WhatsApp
          </a>
        ) : (
          <button className="button button-primary prospect-whatsapp" type="button" disabled>
            <span aria-hidden="true">◔</span> WhatsApp
          </button>
        )}
        <button className="button button-line" type="button" onClick={onRegister}>
          <span aria-hidden="true">✓</span> Registrar acción
        </button>
      </div>
      <button className="button button-link prospect-detail-link" type="button" onClick={onOpen}>
        Ver ficha <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}

function ProspectQueueRow({
  prospect,
  group,
  isSelected,
  onSelect,
  onToast,
  onRegister,
}: {
  prospect: Prospect;
  group: DueGroup;
  isSelected: boolean;
  onSelect: () => void;
  onToast: (message: string) => void;
  onRegister: () => void;
}) {
  const initials = prospect.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase('es');
  const lastAction = [...prospect.activities]
    .reverse()
    .find((activity) => activity.type === 'contactResult');
  const whatsAppUrl = createProspectWhatsAppUrl(prospect.phone);
  const dueLabel =
    group === 'overdue' ? 'Vencido' : group === 'today' ? 'Contactar hoy' : 'Próximo';
  return (
    <article
      className={`prospect-queue-row ${isSelected ? 'prospect-queue-row-selected' : ''}`}
      tabIndex={0}
      aria-label={`Ver detalle rápido de ${prospect.name}`}
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest('button, a')) onSelect();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="prospect-queue-identity">
        <span className="prospect-avatar" aria-hidden="true">
          {initials || '?'}
        </span>
        <div>
          <strong>{prospect.name}</strong>
          {prospect.company && <span>{prospect.company}</span>}
          <small>Prioridad {prospectPriorityLabels[prospect.priority]}</small>
        </div>
      </div>
      <div className="prospect-queue-last-action">
        <strong>
          {lastAction?.result
            ? `${prospectContactResultLabels[lastAction.result]} · ${lastAction.channel ? prospectChannelLabels[lastAction.channel] : 'Contacto'}`
            : 'Sin intentos registrados'}
        </strong>
        <small>
          {lastAction
            ? new Date(lastAction.occurredAt).toLocaleString('es-AR')
            : 'Todavía no se realizó un intento'}
        </small>
      </div>
      <div className="prospect-queue-follow-up">
        <span className={`status-badge prospect-status-${prospect.status}`}>{dueLabel}</span>
        {prospect.nextActionAt && (
          <small>{new Date(prospect.nextActionAt).toLocaleString('es-AR')}</small>
        )}
      </div>
      <div className="prospect-queue-actions">
        {whatsAppUrl ? (
          <a
            className="button button-primary prospect-queue-whatsapp"
            href={whatsAppUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => onToast('WhatsApp abierto.')}
          >
            <span aria-hidden="true">◔</span> WhatsApp
          </a>
        ) : (
          <button className="button button-primary prospect-queue-whatsapp" type="button" disabled>
            <span aria-hidden="true">◔</span> WhatsApp
          </button>
        )}
        <button className="button button-line" type="button" onClick={onRegister}>
          <span aria-hidden="true">✓</span> Registrar acción
        </button>
      </div>
    </article>
  );
}

function ProspectInboxDetail({
  prospect,
  onClose,
  onCopy,
  onOpen,
  onRegister,
}: {
  prospect: Prospect;
  onClose: () => void;
  onCopy: (value: string, label: string) => void;
  onOpen: () => void;
  onRegister: (result?: ProspectContactResult) => void;
}) {
  const initials = prospect.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase('es');
  const contactActivities = [...prospect.activities]
    .filter((activity) => activity.type === 'contactResult')
    .reverse();
  return (
    <aside className="prospect-inbox-detail" aria-label={`Detalle rápido de ${prospect.name}`}>
      <div className="prospect-inbox-detail-header">
        <div className="prospect-identity">
          <span className="prospect-avatar" aria-hidden="true">
            {initials || '?'}
          </span>
          <div>
            <strong>{prospect.name}</strong>
            {prospect.company && <span className="prospect-company">{prospect.company}</span>}
          </div>
        </div>
        <button
          className="prospect-panel-close"
          type="button"
          aria-label="Cerrar detalle"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="prospect-panel-contact">
        <div>
          <span>Teléfono</span>
          <strong>{prospect.phone || 'Pendiente de confirmar'}</strong>
          {isProspectContactAvailable(prospect, 'phone') && (
            <button
              className="prospect-copy"
              type="button"
              aria-label="Copiar teléfono"
              title="Copiar teléfono"
              onClick={() => onCopy(prospect.phone, 'Teléfono')}
            >
              ⧉
            </button>
          )}
        </div>
        <div>
          <span>Email</span>
          <strong>{prospect.email || 'Pendiente de confirmar'}</strong>
          {isProspectContactAvailable(prospect, 'email') && (
            <button
              className="prospect-copy"
              type="button"
              aria-label="Copiar email"
              title="Copiar email"
              onClick={() => onCopy(prospect.email, 'Email')}
            >
              ⧉
            </button>
          )}
        </div>
      </div>
      <div className="prospect-panel-actions">
        <button className="button button-line" type="button" onClick={() => onRegister()}>
          <span aria-hidden="true">✓</span> Registrar acción
        </button>
        <button className="button button-link prospect-detail-link" type="button" onClick={onOpen}>
          Ver ficha completa <span aria-hidden="true">→</span>
        </button>
      </div>
      <section className="prospect-panel-section">
        <h3>Historial de acciones</h3>
        {contactActivities.length ? (
          <ol className="prospect-panel-history">
            {contactActivities.map((activity) => (
              <li key={activity.id}>
                <strong>
                  {activity.channel ? prospectChannelLabels[activity.channel] : 'Contacto'} ·{' '}
                  {activity.result
                    ? prospectContactResultLabels[activity.result]
                    : activity.description}
                </strong>
                <small>{new Date(activity.occurredAt).toLocaleString('es-AR')}</small>
                {activity.note && <p>{activity.note}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-inline">Todavía no hay acciones registradas.</p>
        )}
      </section>
      <section className="prospect-panel-section prospect-panel-follow-up">
        <h3>Próximo seguimiento</h3>
        {prospect.nextActionAt ? (
          <p>{new Date(prospect.nextActionAt).toLocaleString('es-AR')}</p>
        ) : (
          <p className="empty-inline">Sin seguimiento programado.</p>
        )}
        <button
          className="button button-line"
          type="button"
          onClick={() => onRegister('reschedule')}
        >
          Reprogramar
        </button>
      </section>
    </aside>
  );
}

function ProspectActionModal({
  prospect,
  initialResult,
  onClose,
  onSave,
}: {
  prospect: Prospect;
  initialResult: ProspectContactResult;
  onClose: () => void;
  onSave: (input: {
    result: ProspectContactResult;
    channel: ProspectChannel;
    note: string;
    followUpAt?: string;
  }) => void;
}) {
  const [result, setResult] = useState<ProspectContactResult>(initialResult);
  const [channel, setChannel] = useState<ProspectChannel>('whatsapp');
  const [note, setNote] = useState('');
  const [followUpAt, setFollowUpAt] = useState(() =>
    initialResult === 'reschedule' ? isoToLocalDateTime(prospect.nextActionAt) : '',
  );
  const [validationError, setValidationError] = useState('');
  const modalRef = useRef<HTMLFormElement>(null);
  const results: { value: ProspectContactResult; label: string }[] = [
    { value: 'contacted', label: 'Contactado' },
    { value: 'noResponse', label: 'No respondió' },
    { value: 'reschedule', label: 'Reagendar' },
    { value: 'discarded', label: 'Descartar' },
  ];
  useEffect(() => {
    modalRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const controls = Array.from(
        modalRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input, textarea',
        ) ?? [],
      );
      const index = controls.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey
        ? index <= 0
          ? controls.length - 1
          : index - 1
        : index >= controls.length - 1
          ? 0
          : index + 1;
      if (controls.length) {
        event.preventDefault();
        controls[next].focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => event.currentTarget === event.target && onClose()}
    >
      <form
        ref={modalRef}
        className="confirmation-modal prospect-action-modal commercial-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prospect-action-title"
        onSubmit={(event) => {
          event.preventDefault();
          const input = { result, channel, note, ...(followUpAt ? { followUpAt } : {}) };
          const error = getProspectActionValidationError(input);
          if (error) return setValidationError(error);
          onSave(input);
        }}
      >
        <h2 id="prospect-action-title">Registrar acción</h2>
        <p className="prospect-action-subtitle">
          {prospect.name}
          {prospect.company ? ` · ${prospect.company}` : ''}
        </p>
        <fieldset className="prospect-action-options">
          <legend>Resultado</legend>
          <div>
            {results.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`button button-line ${result === item.value ? 'saved-quote-filter-active' : ''}`}
                aria-pressed={result === item.value}
                onClick={() => {
                  setResult(item.value);
                  setValidationError('');
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="prospect-action-options">
          <legend>Canal</legend>
          <div>
            {channels.map((item) => (
              <button
                key={item.value}
                type="button"
                className={`button button-line ${channel === item.value ? 'saved-quote-filter-active' : ''}`}
                aria-pressed={channel === item.value}
                onClick={() => setChannel(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>
        {result === 'reschedule' && (
          <label className="field">
            <span>Próximo contacto</span>
            <input
              type="datetime-local"
              value={followUpAt}
              onChange={(event) => {
                setFollowUpAt(event.target.value);
                setValidationError('');
              }}
            />
          </label>
        )}
        {validationError && (
          <p className="commercial-warning" role="alert">
            {validationError}
          </p>
        )}
        <label className="field">
          <span>Nota opcional</span>
          <textarea
            value={note}
            placeholder="Ej. pidió que lo contacte el jueves"
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
        <div className="confirmation-actions">
          <button className="button button-line" type="button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button button-primary" type="submit">
            Guardar acción
          </button>
        </div>
      </form>
    </div>
  );
}

function ProspectDetail({
  prospect,
  initialContactChannel,
  isNew = false,
  onBack,
  onSave,
  feedback,
}: {
  prospect: Prospect;
  initialContactChannel: ProspectChannel;
  isNew?: boolean;
  onBack: () => void;
  onSave: (prospect: Prospect) => boolean;
  feedback: string;
}) {
  const [draft, setDraft] = useState(prospect);
  const [isEditing, setIsEditing] = useState(isNew);
  const [scriptChannel, setScriptChannel] = useState<ProspectChannel>(initialContactChannel);
  const [script, setScript] = useState('');
  const [result, setResult] = useState<ProspectContactResult | ''>('');
  const [author, setAuthor] = useState('');
  const [contactFeedback, setContactFeedback] = useState('');
  const [detailFollowUpAt, setDetailFollowUpAt] = useState('');
  const defaultScript = `Hola ${draft.name}, soy Daniel. Te contacto por ${draft.potentialService || 'el servicio que necesitás'}. ¿Te parece si coordinamos una breve conversación?`;
  function field<K extends keyof Prospect>(key: K, value: Prospect[K]) {
    setDraft((current) => ({ ...current, [key]: value, updatedAt: new Date().toISOString() }));
  }
  function recordResult(event: FormEvent) {
    event.preventDefault();
    if (!result) return setContactFeedback('Elegí el resultado del contacto.');
    if (!isProspectContactAvailable(draft, scriptChannel))
      return setContactFeedback(
        scriptChannel === 'email'
          ? 'Falta un email confirmado para este canal.'
          : 'Falta un teléfono confirmado para este canal.',
      );
    const input = {
      result,
      channel: scriptChannel,
      note: script,
      author,
      ...(detailFollowUpAt ? { followUpAt: detailFollowUpAt } : {}),
    };
    const validationError = getProspectActionValidationError(input);
    if (validationError) return setContactFeedback(validationError);
    if (!onSave(registerProspectAction(draft, input)))
      return setContactFeedback('No se pudo guardar la acción. Intentá nuevamente.');
    setResult('');
    setScript('');
    setDetailFollowUpAt('');
    setContactFeedback('Contacto registrado en el historial.');
  }
  function saveDraft() {
    const next =
      draft.status === prospect.status
        ? draft
        : transitionProspect({ ...draft, activities: prospect.activities }, draft.status);
    if (onSave(next)) setIsEditing(false);
  }
  function cancelEditing() {
    setDraft(prospect);
    setIsEditing(false);
  }
  const statusDescription: Record<ProspectStatus, string> = {
    uncontacted: 'Todavía no se realizó el primer contacto.',
    contactToday: 'Este prospecto necesita un contacto hoy.',
    contacted: 'Ya se realizó un contacto; revisá el próximo paso.',
    noResponse: 'Todavía no hubo respuesta al contacto.',
    interested: 'El prospecto mostró interés; mantené el seguimiento.',
    notInterested: 'El prospecto indicó que no tiene interés por ahora.',
    converted: 'Estado reservado para una conversión posterior.',
  };
  const channelUnavailable = !isProspectContactAvailable(draft, scriptChannel);
  const detailFields: readonly [keyof Prospect, string][] = [
    ['name', 'Nombre'],
    ['company', 'Empresa'],
    ['phone', 'Teléfono'],
    ['email', 'Email'],
    ['source', 'Origen'],
    ['potentialService', 'Servicio potencial'],
    ['notes', 'Observaciones'],
  ];
  return (
    <main className="app-shell prospecting-shell">
      {!isNew && (
        <button className="button button-link" type="button" onClick={onBack}>
          ← Volver a prospectos
        </button>
      )}
      <header className="page-header">
        <div>
          <p className="eyebrow">{isNew ? 'Alta de prospecto' : 'Ficha de prospecto'}</p>
          <h1>{isNew ? 'Nuevo prospecto' : prospect.name}</h1>
          {!isNew && (
            <>
              <p className="page-description">
                {prospect.company && `${prospect.company} · `}
                {statusDescription[prospect.status]}
              </p>
              <span className={`status-badge prospect-status-${prospect.status}`}>
                {prospectStatusLabels[prospect.status]}
              </span>
            </>
          )}
        </div>
      </header>
      {feedback && (
        <p className="commercial-note" role="status">
          {feedback}
        </p>
      )}
      <div className="prospect-detail-grid">
        <section className="quote-card prospect-form">
          <h2>Datos del prospecto</h2>
          {isEditing ? (
            <div className="form-grid">
              {detailFields.map(([key, label]) => (
                <label className="field" key={key}>
                  <span>{label}</span>
                  {key === 'notes' ? (
                    <textarea
                      value={draft[key] as string}
                      onChange={(e) => field(key, e.target.value)}
                    />
                  ) : (
                    <input
                      value={draft[key] as string}
                      onChange={(e) => field(key, e.target.value)}
                    />
                  )}
                </label>
              ))}
            </div>
          ) : (
            <dl className="prospect-data">
              {detailFields
                .filter(([key]) => Boolean(prospect[key]))
                .map(([key, label]) => (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd>{prospect[key] as string}</dd>
                  </div>
                ))}
            </dl>
          )}
          <div className="commercial-actions">
            {isEditing ? (
              <>
                <button className="button button-primary" type="button" onClick={saveDraft}>
                  {isNew ? 'Guardar prospecto' : 'Guardar cambios'}
                </button>
                <button
                  className="button button-line"
                  type="button"
                  onClick={isNew ? onBack : cancelEditing}
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                className="button button-line"
                type="button"
                onClick={() => setIsEditing(true)}
              >
                Editar datos
              </button>
            )}
          </div>
        </section>
        {!isNew && (
          <section className="quote-card prospect-contact-card">
            <h2>Preparar primer contacto</h2>
            <p>
              Elegí el canal, prepará el mensaje y registrá el resultado después de contactarlo.
            </p>
            <label className="field">
              <span>Canal</span>
              <select
                value={scriptChannel}
                onChange={(e) => setScriptChannel(e.target.value as ProspectChannel)}
              >
                {channels.map((channel) => (
                  <option key={channel.value} value={channel.value}>
                    {channel.label}
                  </option>
                ))}
              </select>
            </label>
            {channelUnavailable && (
              <p className="commercial-warning" role="alert">
                {scriptChannel === 'email'
                  ? 'Falta un email confirmado para preparar este contacto.'
                  : 'Falta un teléfono confirmado para preparar este contacto.'}
              </p>
            )}
            <label className="field">
              <span>Guion editable</span>
              <textarea
                rows={7}
                value={script}
                placeholder={defaultScript}
                onChange={(e) => setScript(e.target.value)}
              />
            </label>
            <form className="commercial-form" onSubmit={recordResult}>
              <label className="field">
                <span>Resultado</span>
                <select
                  value={result}
                  onChange={(e) => setResult(e.target.value as ProspectContactResult | '')}
                >
                  <option value="">Seleccionar resultado</option>
                  <optgroup label="En seguimiento">
                    <option value="contacted">Contactado</option>
                    <option value="noResponse">Sin respuesta</option>
                    <option value="reschedule">Reagendar</option>
                  </optgroup>
                  <optgroup label="Resultado">
                    <option value="discarded">No interesado</option>
                  </optgroup>
                </select>
              </label>
              {result === 'reschedule' && (
                <label className="field">
                  <span>Próximo contacto</span>
                  <input
                    type="datetime-local"
                    value={detailFollowUpAt}
                    onChange={(event) => setDetailFollowUpAt(event.target.value)}
                    required
                  />
                </label>
              )}
              <label className="field">
                <span>Autor</span>
                <input value={author} onChange={(e) => setAuthor(e.target.value)} />
              </label>
              {contactFeedback && (
                <p className="commercial-note" role="status">
                  {contactFeedback}
                </p>
              )}
              <button className="button button-primary" type="submit" disabled={channelUnavailable}>
                Registrar contacto
              </button>
            </form>
          </section>
        )}
        <section className="quote-card prospect-timeline">
          <h2>Historial</h2>
          {prospect.activities.length ? (
            <ol className="activity-list">
              {[...prospect.activities].reverse().map((activity) => (
                <li key={activity.id}>
                  <strong>{activity.description}</strong>
                  <small>
                    {activityTypeLabels[activity.type]} ·{' '}
                    {new Date(activity.occurredAt).toLocaleString('es-AR')}
                    {activity.author ? ` · ${activity.author}` : ''}
                  </small>
                </li>
              ))}
            </ol>
          ) : (
            <p className="empty-inline">Todavía no hay contactos registrados.</p>
          )}
        </section>
      </div>
    </main>
  );
}
