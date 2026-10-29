import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { useWorkspace } from '../context/useWorkspace';
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
  isProspect,
  loadProspects,
  saveProspectWithResult,
} from '../utils/prospectStorage';
import {
  analyzeProspectCsv,
  argentinaDateTimeToIso,
  hasUsableContact,
  type FirstContactChannel,
} from '../utils/prospectImport';
import {
  clearProspectImportRecovery,
  loadProspectImportRecovery,
  prepareProspectImport,
  savePreparedProspectImport,
  saveProspectImportRecovery,
  type FirstContactImportConfig,
  type PreparedProspectImport,
  type ProspectImportRecovery,
} from '../utils/prospectImportTransaction';
import { isoToLocalDateTime } from '../utils/prospectFollowUp';
import {
  filterProspects,
  createProspectInstagramUrl,
  createProspectWhatsAppUrl,
  prospectPriorityLabels,
  prospectChannelLabels,
  prospectContactResultLabels,
  prospectStatusLabels,
  sortProspectsForContact,
  transitionProspect,
  type ProspectFilters,
} from '../utils/prospectWorkflow';
import {
  canQualifyProspect,
  createPendingProspectConversion,
  getProspectConversionValidationError,
  resumeProspectConversion,
  startProspectConversion,
  type ProspectConversionInput,
} from '../utils/prospectConversion';
import { isAuthConfigured } from '../utils/authService';
import { getActiveWorkspaceId, isWorkspaceUuid } from '../utils/workspaceStorage';
import {
  createRemoteProspect,
  convertRemoteProspectToOpportunity,
  importRemoteProspects,
  updateRemoteProspectProfile,
  loadRemoteProspectActivities,
  mapRemoteProspect,
  loadRemoteProspects,
  mapRemoteProspectActivity,
  SupabaseRepositoryError,
} from '../utils/supabaseRepository';
import type { FollowUpInboxItem } from '../types/followUpInbox';

const statuses = Object.keys(prospectStatusLabels) as ProspectStatus[];
const priorities = Object.keys(prospectPriorityLabels) as ProspectPriority[];
const channels: { value: ProspectChannel; label: string }[] = [
  { value: 'phone', label: 'Llamada' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'instagram', label: 'Instagram' },
];
const activityTypeLabels = {
  statusChanged: 'Cambio de estado',
  contactPrepared: 'Contacto preparado',
  contactResult: 'Contacto registrado',
  note: 'Nota',
  conversionCompleted: 'Conversión completada',
} as const;
type DueGroup = 'overdue' | 'today' | 'upcoming';

function prospectToInboxItem(prospect: Prospect): FollowUpInboxItem {
  return {
    id: `prospect:${prospect.id}`,
    subjectType: 'prospect',
    prospectId: prospect.id,
    bucket: 'today',
    source: 'manual',
    clientName: prospect.name,
    clientCompany: prospect.company,
    opportunityName: prospect.potentialService || undefined,
    phone: isProspectContactAvailable(prospect, 'phone') ? prospect.phone : undefined,
    email: isProspectContactAvailable(prospect, 'email') ? prospect.email : undefined,
    instagram: isProspectContactAvailable(prospect, 'instagram') ? prospect.instagram : undefined,
    responsible: prospect.responsible || 'Sin asignar',
    contactRestricted: false,
    channel: prospect.preferredChannel === 'phone' ? 'call' : prospect.preferredChannel || 'other',
    manualPriority: prospect.priority,
    rescheduleCount: 0,
    priority: { score: 0, level: prospect.priority, reasons: [] },
  };
}

interface Props {
  initialFilters: ProspectFilters;
  onFiltersChange: (filters: ProspectFilters) => void;
  onOpenOpportunity: (id: string) => void;
  onOpenResult: (item: FollowUpInboxItem) => void;
  openProspectId?: string | null;
  onOpenProspectHandled?: () => void;
  onProspectsChanged?: (prospects: Prospect[]) => void;
  onOpportunitiesChanged?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function ProspectingView({
  initialFilters,
  onFiltersChange,
  onOpenOpportunity,
  onOpenResult,
  openProspectId,
  onOpenProspectHandled,
  onProspectsChanged,
  onOpportunitiesChanged,
  onDirtyChange,
}: Props) {
  const workspaceContext = useWorkspace();
  const [prospects, setProspects] = useState(() => loadProspects().items);
  const [filters, setFilters] = useState(initialFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creationDraft, setCreationDraft] = useState<Prospect | null>(null);
  const initialContactChannel: ProspectChannel = 'phone';
  const [importRecovery, setImportRecovery] = useState<ProspectImportRecovery | null>(() =>
    loadProspectImportRecovery(),
  );
  const [isImportOpen, setIsImportOpen] = useState(() => Boolean(importRecovery));
  const [csv, setCsv] = useState(() => importRecovery?.csv ?? '');
  const [csvFileName, setCsvFileName] = useState(() => importRecovery?.fileName ?? '');
  const [scheduleFirstContact, setScheduleFirstContact] = useState(
    () => importRecovery?.config.schedule ?? false,
  );
  const [firstContactChannel, setFirstContactChannel] = useState<FirstContactChannel>(
    () => importRecovery?.config.channel ?? 'whatsapp',
  );
  const [firstContactAt, setFirstContactAt] = useState(() =>
    isoToLocalDateTime(importRecovery?.config.dueAt ?? ''),
  );
  const [firstContactResponsible, setFirstContactResponsible] = useState(
    () => importRecovery?.config.responsible ?? '',
  );
  const [firstContactNote, setFirstContactNote] = useState(() => importRecovery?.config.note ?? '');
  const [isImporting, setIsImporting] = useState(false);
  const [preparedImport, setPreparedImport] = useState<PreparedProspectImport | null>(
    () => importRecovery?.prepared ?? null,
  );
  const [feedback, setFeedback] = useState('');
  const [toast, setToast] = useState('');
  const [conversionTarget, setConversionTarget] = useState<Prospect | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const importSubmissionRef = useRef(false);
  const selected = prospects.find((item) => item.id === (selectedId ?? openProspectId));
  const visible = useMemo(() => filterProspects(prospects, filters), [prospects, filters]);
  const csvPreview = useMemo(() => analyzeProspectCsv(csv, prospects), [csv, prospects]);
  const rows = csvPreview.rows;
  const validRows = rows.filter((row) => !row.reason && !row.duplicate);
  const compatibleRows = validRows.filter((row) =>
    hasUsableContact(row.input, firstContactChannel),
  );
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);
  const refresh = useCallback(async () => {
    const workspaceId = workspaceContext.session?.activeWorkspaceId;
    if (!isAuthConfigured() || !isWorkspaceUuid(workspaceId)) {
      const local = loadProspects().items;
      setProspects(local);
      onProspectsChanged?.(local);
      return;
    }
    try {
      const [rows, activityRows] = await Promise.all([
        loadRemoteProspects(workspaceId),
        loadRemoteProspectActivities(workspaceId),
      ]);
      const activitiesByProspect = new Map<string, Prospect['activities']>();
      activityRows.forEach((activity) => {
        const activities = activitiesByProspect.get(activity.prospect_id) ?? [];
        activities.push(mapRemoteProspectActivity(activity));
        activitiesByProspect.set(activity.prospect_id, activities);
      });
      const remoteProspects = rows.map((row) =>
        mapRemoteProspect(row, activitiesByProspect.get(row.id) ?? []),
      );
      const validProspects = remoteProspects.filter(isProspect);
      const invalidProspects = remoteProspects.filter((prospect) => !isProspect(prospect));
      const mirrorFailures = validProspects.filter(
        (prospect) => !saveProspectWithResult(prospect).ok,
      );
      setProspects(validProspects);
      onProspectsChanged?.(validProspects);
      if (invalidProspects.length || mirrorFailures.length) {
        const affected = [...invalidProspects, ...mirrorFailures]
          .slice(0, 3)
          .map((prospect) => prospect.name)
          .join(', ');
        setFeedback(
          `No se pudieron preparar ${invalidProspects.length + mirrorFailures.length} prospecto(s) para la vista local${affected ? `: ${affected}` : ''}. Los demás datos remotos siguen disponibles.`,
        );
      }
    } catch {
      const local = loadProspects().items;
      setProspects(local);
      onProspectsChanged?.(local);
      setFeedback('No se pudo consultar Supabase. Se muestran los últimos prospectos disponibles.');
    }
  }, [onProspectsChanged, workspaceContext.session?.activeWorkspaceId]);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);
  useEffect(() => {
    const handleProspectsUpdated = () => void refresh();
    window.addEventListener('ingenya:prospects-updated', handleProspectsUpdated);
    return () => window.removeEventListener('ingenya:prospects-updated', handleProspectsUpdated);
  }, [refresh]);
  function updateFilters(next: ProspectFilters) {
    setFilters(next);
    onFiltersChange(next);
  }
  async function save(next: Prospect, openDetail = true): Promise<boolean> {
    const workspaceId = workspaceContext.session?.activeWorkspaceId;
    if (isAuthConfigured() && !isWorkspaceUuid(workspaceId)) {
      setFeedback(
        'No se pudo identificar el espacio de trabajo en Supabase. Volvé a iniciar sesión o seleccioná otro espacio.',
      );
      return false;
    }
    if (isAuthConfigured() && workspaceId) {
      try {
        const remote = await updateRemoteProspectProfile({
          workspaceId,
          prospect: next,
          idempotencyKey: `update-prospect:${next.id}:${next.version ?? 1}:${next.updatedAt}`,
        });
        if (!remote.ok) {
          setFeedback(remote.message);
          return false;
        }
        next = { ...next, version: remote.version };
      } catch (error) {
        setFeedback(
          error instanceof Error
            ? `No se pudo guardar en Supabase: ${error.message}`
            : 'No se pudo guardar en Supabase. Los cambios siguen abiertos para reintentar.',
        );
        return false;
      }
    }
    const result = saveProspectWithResult(next);
    if (!result.ok) {
      setFeedback(
        `No se pudo guardar (${result.reason})${result.error ? `: ${result.error}` : ''}`,
      );
      return false;
    }
    refresh();
    if (openDetail) setSelectedId(next.id);
    setFeedback(
      isAuthConfigured()
        ? 'Prospecto actualizado en el espacio activo.'
        : 'Prospecto guardado localmente.',
    );
    return true;
  }
  async function saveNew(next: Prospect): Promise<boolean> {
    const localResult = saveProspectWithResult(next);
    if (!localResult.ok) {
      setFeedback(
        `No se pudo guardar (${localResult.reason})${localResult.error ? `: ${localResult.error}` : ''}`,
      );
      return false;
    }
    const workspaceId = workspaceContext.session?.activeWorkspaceId;
    if (isAuthConfigured() && !isWorkspaceUuid(workspaceId)) {
      setFeedback(
        'No se pudo identificar el espacio de trabajo en Supabase. Volvé a iniciar sesión o seleccioná otro espacio.',
      );
      return false;
    }
    if (isAuthConfigured() && workspaceId) {
      try {
        await createRemoteProspect(workspaceId, next);
      } catch (error) {
        setFeedback(
          error instanceof Error
            ? `No se pudo guardar en el espacio activo: ${error.message}`
            : 'No se pudo guardar en el espacio activo. El respaldo local se conservó.',
        );
        return false;
      }
      setProspects((current) => [next, ...current.filter((item) => item.id !== next.id)]);
      setSelectedId(next.id);
      setFeedback('Prospecto guardado en el espacio activo.');
      return true;
    }
    refresh();
    setSelectedId(next.id);
    setFeedback('Prospecto guardado localmente.');
    return true;
  }
  function convertFromPanel(input: ProspectConversionInput) {
    if (!conversionTarget) return;
    const result = startProspectConversion(conversionTarget, input);
    if (!result.ok) {
      refresh();
      return setFeedback(result.error);
    }
    refresh();
    onOpportunitiesChanged?.();
    setConversionTarget(null);
    setFeedback('Oportunidad creada. Revisá el próximo paso en Seguimiento.');
  }
  function buildImportConfig(): FirstContactImportConfig | null {
    if (!scheduleFirstContact)
      return {
        schedule: false,
        channel: firstContactChannel,
        dueAt: '',
        responsible: '',
        note: '',
      };
    const dueAt = argentinaDateTimeToIso(firstContactAt);
    if (!dueAt.ok || Date.parse(dueAt.value) <= Date.now()) {
      setFeedback(dueAt.ok ? 'La fecha y hora del primer contacto debe ser futura.' : dueAt.error);
      return null;
    }
    if (!firstContactResponsible.trim()) {
      setFeedback('Elegí un responsable para el primer contacto.');
      return null;
    }
    return {
      schedule: true,
      channel: firstContactChannel,
      dueAt: dueAt.value,
      responsible: firstContactResponsible,
      note: firstContactNote,
    };
  }
  async function importRows() {
    if (isImporting || importSubmissionRef.current || !validRows.length) return;
    const config = buildImportConfig();
    if (!config) return;
    importSubmissionRef.current = true;
    const prepared = preparedImport ?? prepareProspectImport(rows, config);
    const activeWorkspaceId = workspaceContext.session?.activeWorkspaceId;
    const importWorkspaceId = isAuthConfigured()
      ? activeWorkspaceId
      : (getActiveWorkspaceId() ?? activeWorkspaceId);
    if (isAuthConfigured() && !isWorkspaceUuid(importWorkspaceId)) {
      setFeedback(
        'No se pudo identificar el espacio de trabajo en Supabase. Volvé a iniciar sesión o seleccioná otro espacio.',
      );
      return;
    }
    const recovery: ProspectImportRecovery = {
      importKey: prepared.importKey,
      workspaceId: importWorkspaceId ?? undefined,
      fileName: csvFileName,
      csv,
      config,
      prepared,
      phase: 'pending',
    };
    setPreparedImport(prepared);
    saveProspectImportRecovery(recovery);
    setIsImporting(true);
    try {
      const workspaceId = importWorkspaceId;
      let remoteConfirmed = importRecovery?.phase === 'remoteConfirmed';
      if (isAuthConfigured() && workspaceId && !remoteConfirmed) {
        await importRemoteProspects(workspaceId, prepared);
        remoteConfirmed = true;
        const confirmedRecovery = { ...recovery, phase: 'remoteConfirmed' as const };
        setImportRecovery(confirmedRecovery);
        saveProspectImportRecovery(confirmedRecovery);
        const remoteRows = await loadRemoteProspects(workspaceId);
        const remoteIds = new Set(remoteRows.map((row) => row.id));
        if (!prepared.prospects.every((prospect) => remoteIds.has(prospect.id)))
          throw new SupabaseRepositoryError(
            'server',
            'Supabase no devolvió todos los prospectos confirmados. La importación quedó pendiente de recuperación.',
          );
      }
      const currentWorkspaceId = isAuthConfigured()
        ? workspaceContext.session?.activeWorkspaceId
        : getActiveWorkspaceId();
      if (currentWorkspaceId !== importWorkspaceId) {
        setImportRecovery(recovery);
        saveProspectImportRecovery(recovery);
        setFeedback(
          'El workspace cambió durante la importación. Volvé al workspace original para completar la recuperación sin duplicar datos.',
        );
        return;
      }
      if (!savePreparedProspectImport(prepared)) {
        if (remoteConfirmed) {
          const recoverable = { ...recovery, phase: 'remoteConfirmed' as const };
          setImportRecovery(recoverable);
          saveProspectImportRecovery(recoverable);
          setFeedback(
            'La importación se confirmó, pero no se pudo guardar parte del historial local. Reintentá solo la recuperación.',
          );
        } else {
          setFeedback('No se pudo guardar la importación. Reintentá con el mismo archivo.');
        }
        return;
      }
      clearProspectImportRecovery();
      setImportRecovery(null);
      setPreparedImport(null);
      await refresh();
      const omitted = rows.length - prepared.prospects.length;
      setFeedback(
        `${prepared.prospects.length} prospecto(s) importado(s)${omitted ? `, ${omitted} omitido(s)` : ''}${prepared.scheduledCount ? ` y ${prepared.scheduledCount} primer contacto(s) agendado(s)` : ''}.`,
      );
      cancelImport();
    } catch (error) {
      const message =
        error instanceof SupabaseRepositoryError && error.code === 'server'
          ? 'La importación no está disponible en este entorno. Falta aplicar la migración de SCRUM-82 en Supabase.'
          : error instanceof Error
            ? `No se pudo confirmar la importación: ${error.message}`
            : 'No se pudo confirmar la importación. Reintentá con el mismo archivo.';
      setFeedback(message);
    } finally {
      importSubmissionRef.current = false;
      setIsImporting(false);
    }
  }
  async function recoverImport() {
    if (!importRecovery || isImporting || importSubmissionRef.current) return;
    const currentWorkspaceId = isAuthConfigured()
      ? workspaceContext.session?.activeWorkspaceId
      : getActiveWorkspaceId();
    if (importRecovery.workspaceId && currentWorkspaceId !== importRecovery.workspaceId) {
      setFeedback('Volvé al workspace donde inició la importación para recuperar este lote.');
      return;
    }
    importSubmissionRef.current = true;
    setCsv(importRecovery.csv);
    setCsvFileName(importRecovery.fileName);
    setScheduleFirstContact(importRecovery.config.schedule);
    setFirstContactChannel(importRecovery.config.channel);
    setFirstContactAt(isoToLocalDateTime(importRecovery.config.dueAt));
    setFirstContactResponsible(importRecovery.config.responsible);
    setFirstContactNote(importRecovery.config.note);
    setPreparedImport(importRecovery.prepared);
    setIsImporting(true);
    try {
      if (!savePreparedProspectImport(importRecovery.prepared)) {
        setFeedback(
          'No se pudo completar la recuperación. Tus datos siguen listos para reintentarla.',
        );
        return;
      }
      clearProspectImportRecovery();
      setImportRecovery(null);
      setPreparedImport(null);
      refresh();
      setFeedback(
        'La recuperación se completó. Los prospectos y sus primeros contactos ya están listos.',
      );
      setIsImportOpen(false);
    } finally {
      importSubmissionRef.current = false;
      setIsImporting(false);
    }
  }
  function cancelImport() {
    if (isImporting || importRecovery?.phase === 'remoteConfirmed') return;
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
      setPreparedImport(null);
      setImportRecovery(null);
      clearProspectImportRecovery();
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
        onSave={async (prospect) => {
          const saved = await saveNew(prospect);
          if (saved) setCreationDraft(null);
          return saved;
        }}
        onReload={refresh}
        feedback={feedback}
        onOpenOpportunity={onOpenOpportunity}
        onOpportunitiesChanged={onOpportunitiesChanged}
        onDirtyChange={onDirtyChange}
      />
    );
  if (selected)
    return (
      <>
        <ProspectDetail
          prospect={selected}
          initialContactChannel={initialContactChannel}
          onBack={() => {
            setSelectedId(null);
            onOpenProspectHandled?.();
          }}
          onSave={save}
          onReload={refresh}
          feedback={feedback}
          onOpenOpportunity={onOpenOpportunity}
          onOpportunitiesChanged={onOpportunitiesChanged}
          onDirtyChange={onDirtyChange}
          onRegisterResult={() => onOpenResult(prospectToInboxItem(selected))}
        />
      </>
    );
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
          <p>Revisá los datos antes de confirmar.</p>
          {feedback && (
            <p className="commercial-warning" role="alert">
              {feedback}
            </p>
          )}
          {!csvFileName ? (
            <label className="field" htmlFor="prospect-csv-file">
              <span>Archivo CSV</span>
              <input
                ref={csvInputRef}
                id="prospect-csv-file"
                type="file"
                accept=".csv,text/csv"
                disabled={isImporting || importRecovery?.phase === 'remoteConfirmed'}
                onChange={handleCsvFile}
              />
            </label>
          ) : (
            <div className="prospect-import-file">
              <strong>{csvFileName}</strong>
              <label className="button button-line" htmlFor="prospect-csv-file">
                Cambiar archivo
                <input
                  ref={csvInputRef}
                  id="prospect-csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  disabled={isImporting || importRecovery?.phase === 'remoteConfirmed'}
                  onChange={handleCsvFile}
                />
              </label>
            </div>
          )}
          {csvPreview.headerError ? (
            <p className="commercial-warning" role="alert">
              {csvPreview.headerError}
            </p>
          ) : (
            <>
              <div className="prospect-import-summary" aria-label="Resumen de importación">
                <strong>
                  <span>{validRows.length}</span> válidas
                </strong>
                <strong>
                  <span>{rows.filter((row) => row.duplicate).length}</span> duplicadas
                </strong>
                <strong>
                  <span>{rows.filter((row) => row.reason).length}</span> inválidas
                </strong>
                <strong>
                  <span>{compatibleRows.length}</span> con contacto
                </strong>
              </div>
              {rows.length > 0 && (
                <div className="table-scroll prospect-import-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Empresa</th>
                        <th>Contacto</th>
                        <th>Teléfono</th>
                        <th>Email</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 8).map((row) => (
                        <tr
                          key={row.line}
                          className={
                            row.reason
                              ? 'prospect-import-invalid'
                              : row.duplicate
                                ? 'prospect-import-duplicate'
                                : ''
                          }
                        >
                          <td>{row.input.company || '—'}</td>
                          <td>{row.input.name || '—'}</td>
                          <td>{row.input.phone || '—'}</td>
                          <td>{row.input.email || '—'}</td>
                          <td>
                            {row.reason
                              ? `Inválida: ${row.reason}`
                              : row.duplicate
                                ? 'Duplicada'
                                : 'Válida'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <fieldset className="prospect-first-contact">
                <legend>Primer contacto</legend>
                <label
                  className={
                    !scheduleFirstContact
                      ? 'prospect-import-choice prospect-import-choice-selected'
                      : 'prospect-import-choice'
                  }
                >
                  <input
                    type="radio"
                    checked={!scheduleFirstContact}
                    onChange={() => {
                      setScheduleFirstContact(false);
                      setPreparedImport(null);
                    }}
                    disabled={isImporting || importRecovery?.phase === 'remoteConfirmed'}
                  />
                  <strong>Importar sin agendar</strong>
                  <small>Solo se importarán los prospectos.</small>
                </label>
                <label
                  className={
                    scheduleFirstContact
                      ? 'prospect-import-choice prospect-import-choice-selected'
                      : 'prospect-import-choice'
                  }
                >
                  <input
                    type="radio"
                    checked={scheduleFirstContact}
                    onChange={() => {
                      setScheduleFirstContact(true);
                      setPreparedImport(null);
                    }}
                    disabled={isImporting || importRecovery?.phase === 'remoteConfirmed'}
                  />
                  <strong>Agendar primer contacto</strong>
                  <small>Se creará una tarea para los prospectos compatibles.</small>
                </label>
              </fieldset>
              {scheduleFirstContact && (
                <div className="prospect-import-config">
                  <label className="field">
                    <span>Canal</span>
                    <select
                      value={firstContactChannel}
                      onChange={(event) => {
                        setFirstContactChannel(event.target.value as FirstContactChannel);
                        setPreparedImport(null);
                      }}
                      disabled={isImporting || importRecovery?.phase === 'remoteConfirmed'}
                    >
                      <option value="phone">Llamada</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="email">Email</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Fecha y hora</span>
                    <input
                      type="datetime-local"
                      value={firstContactAt}
                      onChange={(event) => {
                        setFirstContactAt(event.target.value);
                        setPreparedImport(null);
                      }}
                      disabled={isImporting || importRecovery?.phase === 'remoteConfirmed'}
                    />
                  </label>
                  <label className="field">
                    <span>Responsable</span>
                    <input
                      value={firstContactResponsible}
                      onChange={(event) => {
                        setFirstContactResponsible(event.target.value);
                        setPreparedImport(null);
                      }}
                      disabled={isImporting || importRecovery?.phase === 'remoteConfirmed'}
                    />
                  </label>
                  <label className="field">
                    <span>Nota opcional</span>
                    <input
                      value={firstContactNote}
                      onChange={(event) => {
                        setFirstContactNote(event.target.value);
                        setPreparedImport(null);
                      }}
                      disabled={isImporting || importRecovery?.phase === 'remoteConfirmed'}
                    />
                  </label>
                </div>
              )}
              {scheduleFirstContact && validRows.length > compatibleRows.length && (
                <p className="commercial-note">
                  {validRows.length - compatibleRows.length} prospecto(s) sin contacto compatible se
                  importará(n) sin agendar.
                </p>
              )}
              {importRecovery?.phase === 'remoteConfirmed' && (
                <p className="commercial-warning" role="alert">
                  La importación ya se confirmó. No la repitas: recuperá únicamente el registro
                  local pendiente.
                </p>
              )}
              <div className="prospect-import-actions">
                <button
                  className="button button-line"
                  type="button"
                  onClick={cancelImport}
                  disabled={isImporting || importRecovery?.phase === 'remoteConfirmed'}
                >
                  Cancelar
                </button>
                {importRecovery?.phase === 'remoteConfirmed' ? (
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => void recoverImport()}
                    disabled={isImporting}
                  >
                    {isImporting ? 'Recuperando…' : 'Reintentar recuperación'}
                  </button>
                ) : (
                  <button
                    className="button button-primary"
                    type="button"
                    disabled={!validRows.length || isImporting || Boolean(csvPreview.headerError)}
                    onClick={() => void importRows()}
                  >
                    {isImporting
                      ? 'Importando…'
                      : feedback
                        ? 'Reintentar importación'
                        : scheduleFirstContact
                          ? `Importar ${validRows.length} prospectos y agendar ${compatibleRows.length}`
                          : `Importar ${validRows.length} prospectos`}
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      )}
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
                onRegister={() => onOpenResult(prospectToInboxItem(prospect))}
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
      {conversionTarget && (
        <ProspectConversionModal
          prospect={conversionTarget}
          onClose={() => setConversionTarget(null)}
          onSave={convertFromPanel}
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
  const instagramUrl = createProspectInstagramUrl(prospect.instagram);
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
        {instagramUrl ? (
          <a
            className="button button-line"
            href={instagramUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => onToast('Instagram abierto.')}
          >
            Abrir Instagram
          </a>
        ) : (
          <button
            className="button button-line"
            type="button"
            disabled
            title="Falta un usuario o URL de Instagram"
          >
            Abrir Instagram
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

export function ProspectQueueRow({
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

export function ProspectInboxDetail({
  prospect,
  onClose,
  onCopy,
  onOpen,
  onRegister,
  onQualify,
  onOpenOpportunity,
}: {
  prospect: Prospect;
  onClose: () => void;
  onCopy: (value: string, label: string) => void;
  onOpen: () => void;
  onRegister: (result?: ProspectContactResult) => void;
  onQualify: () => void;
  onOpenOpportunity: (id: string) => void;
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
        {canQualifyProspect(prospect) && (
          <button className="button button-primary" type="button" onClick={onQualify}>
            Calificar oportunidad
          </button>
        )}
        <button className="button button-line" type="button" onClick={() => onRegister()}>
          <span aria-hidden="true">✓</span> Registrar acción
        </button>
        <button className="button button-link prospect-detail-link" type="button" onClick={onOpen}>
          Ver ficha completa <span aria-hidden="true">→</span>
        </button>
      </div>
      {prospect.conversion?.state === 'completed' && (
        <section className="prospect-panel-section">
          <h3>Oportunidad creada</h3>
          <p>
            <strong>Oportunidad:</strong> {prospect.conversion.draft.opportunityName}
          </p>
          <p>
            <strong>Contacto:</strong> {prospect.conversion.draft.clientName}
          </p>
          {prospect.conversion.draft.clientCompany && (
            <p>
              <strong>Empresa:</strong> {prospect.conversion.draft.clientCompany}
            </p>
          )}
          <p>
            <strong>Servicio:</strong> {prospect.conversion.draft.serviceOfInterest}
          </p>
          {prospect.conversion.draft.estimatedValue !== undefined && (
            <p>
              <strong>Valor estimado:</strong>{' '}
              {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(
                prospect.conversion.draft.estimatedValue,
              )}
            </p>
          )}
          <button
            className="button button-line"
            type="button"
            onClick={() => onOpenOpportunity(prospect.conversion!.draft.opportunityId)}
          >
            Ir a seguimiento de oportunidad
          </button>
        </section>
      )}
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

function ProspectDetail({
  prospect,
  initialContactChannel,
  isNew = false,
  onBack,
  onSave,
  feedback,
  onOpenOpportunity,
  onReload,
  onOpportunitiesChanged,
  onDirtyChange,
  onRegisterResult,
}: {
  prospect: Prospect;
  initialContactChannel: ProspectChannel;
  isNew?: boolean;
  onBack: () => void;
  onSave: (prospect: Prospect) => boolean | Promise<boolean>;
  feedback: string;
  onOpenOpportunity: (id: string) => void;
  onReload: () => void;
  onOpportunitiesChanged?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onRegisterResult?: () => void;
}) {
  const workspaceContext = useWorkspace();
  const [draft, setDraft] = useState(prospect);
  const [isEditing, setIsEditing] = useState(isNew);
  const [scriptChannel, setScriptChannel] = useState<ProspectChannel>(initialContactChannel);
  const [script, setScript] = useState('');
  const [isConversionOpen, setIsConversionOpen] = useState(false);
  const [conversionFeedback, setConversionFeedback] = useState('');
  const [pendingConversion, setPendingConversion] = useState<Prospect | null>(null);
  useEffect(() => {
    onDirtyChange?.(
      isNew
        ? JSON.stringify(draft) !== JSON.stringify(prospect)
        : isEditing && JSON.stringify(draft) !== JSON.stringify(prospect),
    );
    return () => onDirtyChange?.(false);
  }, [draft, isEditing, isNew, onDirtyChange, prospect]);
  const defaultScript = `Hola ${draft.name}, soy Daniel. Te contacto por ${draft.potentialService || 'el servicio que necesitás'}. ¿Te parece si coordinamos una breve conversación?`;
  function field<K extends keyof Prospect>(key: K, value: Prospect[K]) {
    setDraft((current) => ({ ...current, [key]: value, updatedAt: new Date().toISOString() }));
  }
  async function beginConversion(input: ProspectConversionInput) {
    try {
      const pending = createPendingProspectConversion(prospect, input);
      const workspaceId = workspaceContext.session?.activeWorkspaceId;
      if (isAuthConfigured()) {
        if (!isWorkspaceUuid(workspaceId)) {
          setConversionFeedback(
            'No se pudo identificar el espacio de trabajo en Supabase. Volvé a iniciar sesión o seleccioná otro espacio.',
          );
          return;
        }
        const remote = await convertRemoteProspectToOpportunity({
          workspaceId,
          prospectId: prospect.id,
          expectedVersion: prospect.version ?? 1,
          idempotencyKey: `convert-prospect:${prospect.id}:${prospect.version ?? 1}`,
        });
        if (!remote.ok) {
          setConversionFeedback(remote.message);
          return;
        }
        pending.version = remote.version;
      }
      setPendingConversion(pending);
      const pendingSave = saveProspectWithResult(pending);
      if (!pendingSave.ok) {
        setConversionFeedback(
          'No se pudo iniciar la conversión. No se creó cliente ni oportunidad.',
        );
        return;
      }
      const result = resumeProspectConversion(pending);
      if (!result.ok) {
        setConversionFeedback(result.error);
        return;
      }
      onReload();
      onOpportunitiesChanged?.();
      setPendingConversion(null);
      setIsConversionOpen(false);
      setConversionFeedback(
        'Oportunidad creada. Revisá su contexto y próximo paso en Seguimiento.',
      );
    } catch (error) {
      setConversionFeedback(
        error instanceof Error ? error.message : 'No se pudo iniciar la conversión.',
      );
    }
  }
  function retryConversion() {
    const result = resumeProspectConversion(pendingConversion ?? prospect);
    if (!result.ok) return setConversionFeedback(result.error);
    onReload();
    onOpportunitiesChanged?.();
    setPendingConversion(null);
    setConversionFeedback('Oportunidad creada. Revisá su contexto y próximo paso en Seguimiento.');
  }
  async function saveDraft() {
    const editableDraft = {
      ...draft,
      activities: prospect.activities,
      ...(prospect.conversion ? { conversion: prospect.conversion } : {}),
    };
    const next =
      editableDraft.status === prospect.status
        ? editableDraft
        : transitionProspect(editableDraft, editableDraft.status);
    if (await onSave(next)) setIsEditing(false);
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
  const instagramUrl = createProspectInstagramUrl(draft.instagram);
  const detailFields: readonly [keyof Prospect, string][] = [
    ['name', 'Nombre'],
    ['company', 'Empresa'],
    ['phone', 'Teléfono'],
    ['email', 'Email'],
    ['instagram', 'Instagram'],
    ['address', 'Dirección'],
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
        {!isNew && onRegisterResult && (
          <button className="button button-primary" type="button" onClick={onRegisterResult}>
            Registrar resultado
          </button>
        )}
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
          {!isNew && canQualifyProspect(prospect) && (
            <button
              className="button button-primary"
              type="button"
              onClick={() => setIsConversionOpen(true)}
            >
              Calificar oportunidad
            </button>
          )}
          {!isNew && (pendingConversion ?? prospect).conversion?.state === 'pending' && (
            <div className="commercial-warning" role="alert">
              <p>
                Hay una conversión pendiente para{' '}
                {(pendingConversion ?? prospect).conversion!.draft.opportunityName}.
              </p>
              <button className="button button-primary" type="button" onClick={retryConversion}>
                Reintentar conversión
              </button>
            </div>
          )}
          {!isNew && prospect.conversion?.state === 'completed' && (
            <section className="commercial-note" aria-label="Oportunidad creada">
              <h3>Oportunidad creada</h3>
              <p>
                <strong>Oportunidad / obra:</strong> {prospect.conversion.draft.opportunityName}
              </p>
              <p>
                <strong>Contacto:</strong> {prospect.conversion.draft.clientName}
              </p>
              {prospect.conversion.draft.clientCompany && (
                <p>
                  <strong>Empresa:</strong> {prospect.conversion.draft.clientCompany}
                </p>
              )}
              <p>
                <strong>Servicio:</strong> {prospect.conversion.draft.serviceOfInterest} ·{' '}
                <strong>Interés:</strong>{' '}
                {prospectPriorityLabels[prospect.conversion.draft.interestLevel]}
              </p>
              <p>
                <strong>Necesidad:</strong> {prospect.conversion.draft.detectedNeed}
              </p>
              {prospect.conversion.draft.estimatedValue !== undefined && (
                <p>
                  <strong>Valor estimado:</strong>{' '}
                  {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(
                    prospect.conversion.draft.estimatedValue,
                  )}
                </p>
              )}
              <p>
                <strong>Próximo paso:</strong> {prospect.conversion.draft.nextStep} ·{' '}
                {new Date(prospect.conversion.draft.nextStepAt).toLocaleString('es-AR')}
              </p>
              <button
                className="button button-line"
                type="button"
                onClick={() => onOpenOpportunity(prospect.conversion!.draft.opportunityId)}
              >
                Ir a seguimiento de oportunidad
              </button>
            </section>
          )}
          {conversionFeedback && (
            <p className="commercial-note" role="status">
              {conversionFeedback}
            </p>
          )}
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
                  : scriptChannel === 'instagram'
                    ? 'Falta un usuario o URL de Instagram para preparar este contacto.'
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
            {scriptChannel === 'instagram' &&
              (instagramUrl ? (
                <a
                  className="button button-line"
                  href={instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir Instagram
                </a>
              ) : (
                <button className="button button-line" type="button" disabled>
                  Abrir Instagram
                </button>
              ))}
            <p className="commercial-note">
              Cuando termines el contacto, registrá el resultado desde el panel lateral.
            </p>
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
      {isConversionOpen && (
        <ProspectConversionModal
          prospect={prospect}
          onClose={() => setIsConversionOpen(false)}
          onSave={beginConversion}
        />
      )}
    </main>
  );
}

function ProspectConversionModal({
  prospect,
  onClose,
  onSave,
}: {
  prospect: Prospect;
  onClose: () => void;
  onSave: (input: ProspectConversionInput) => void;
}) {
  const [input, setInput] = useState<ProspectConversionInput>({
    opportunityName:
      [prospect.company, prospect.potentialService].filter(Boolean).join(' · ') || prospect.name,
    serviceOfInterest: prospect.potentialService,
    interestLevel:
      prospect.priority === 'high' ? 'high' : prospect.priority === 'low' ? 'low' : 'medium',
    detectedNeed: prospect.notes,
    estimatedValue: '',
    nextStep: prospect.nextAction,
    nextStepAt: isoToLocalDateTime(prospect.nextActionAt),
    nextStepChannel: (() => {
      const channel = [...prospect.activities]
        .reverse()
        .find((item) => item.type === 'contactResult')?.channel;
      return channel === 'phone' ? 'call' : (channel ?? 'call');
    })(),
    responsible: prospect.responsible,
  });
  const [error, setError] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    const validation = getProspectConversionValidationError(input);
    if (validation) return setError(validation);
    onSave(input);
  }
  const set = <K extends keyof ProspectConversionInput>(
    key: K,
    value: ProspectConversionInput[K],
  ) => {
    setInput((current) => ({ ...current, [key]: value }));
    setError('');
  };
  return (
    <div className="modal-backdrop">
      <form
        className="confirmation-modal prospect-conversion-modal commercial-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conversion-title"
        onSubmit={submit}
      >
        <h2 id="conversion-title">Calificar oportunidad</h2>
        <p>{prospect.name}</p>
        <label className="field">
          <span>Nombre de oportunidad / obra</span>
          <input
            value={input.opportunityName}
            onChange={(e) => set('opportunityName', e.target.value)}
          />
        </label>
        <label className="field">
          <span>Servicio de interés</span>
          <input
            value={input.serviceOfInterest}
            onChange={(e) => set('serviceOfInterest', e.target.value)}
          />
        </label>
        <label className="field">
          <span>Nivel de interés</span>
          <select
            value={input.interestLevel}
            onChange={(e) =>
              set('interestLevel', e.target.value as ProspectConversionInput['interestLevel'])
            }
          >
            <option value="high">Alto</option>
            <option value="medium">Medio</option>
            <option value="low">Bajo</option>
          </select>
        </label>
        <label className="field">
          <span>Necesidad detectada</span>
          <textarea
            value={input.detectedNeed}
            onChange={(e) => set('detectedNeed', e.target.value)}
          />
        </label>
        <label className="field">
          <span>Valor estimado (opcional)</span>
          <input
            type="number"
            min="0"
            step="any"
            value={input.estimatedValue}
            onChange={(e) => set('estimatedValue', e.target.value)}
          />
        </label>
        <label className="field">
          <span>Próximo paso</span>
          <input value={input.nextStep} onChange={(e) => set('nextStep', e.target.value)} />
        </label>
        <label className="field">
          <span>Canal del próximo paso</span>
          <select
            value={input.nextStepChannel}
            onChange={(e) =>
              set('nextStepChannel', e.target.value as ProspectConversionInput['nextStepChannel'])
            }
          >
            <option value="">Seleccionar canal</option>
            <option value="call">Llamada</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
            <option value="meeting">Reunión</option>
            <option value="waitForResponse">Esperar respuesta</option>
            <option value="other">Otra</option>
          </select>
        </label>
        <label className="field">
          <span>Fecha y hora del próximo paso</span>
          <input
            type="datetime-local"
            value={input.nextStepAt}
            onChange={(e) => set('nextStepAt', e.target.value)}
          />
        </label>
        <label className="field">
          <span>Responsable</span>
          <input value={input.responsible} onChange={(e) => set('responsible', e.target.value)} />
        </label>
        {error && (
          <p className="commercial-warning" role="alert">
            {error}
          </p>
        )}
        <div className="confirmation-actions">
          <button className="button button-line" type="button" onClick={onClose}>
            Seguir como prospecto
          </button>
          <button className="button button-primary" type="submit">
            Crear oportunidad
          </button>
        </div>
      </form>
    </div>
  );
}
