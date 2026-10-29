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
  getProspectFieldErrors,
  getProspectSaveErrorMessage,
  isProspectContactAvailable,
  isProspect,
  loadProspects,
  saveProspectWithResult,
} from '../utils/prospectStorage';
import { ArchiveProspectDialog } from './ArchiveProspectDialog';
import { FieldError } from './FieldError';
import { useFieldValidation } from './useFieldValidation';
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
  countActiveProspectFilters,
  defaultProspectFilters,
  filterProspects,
  getBulkArchiveCandidates,
  normalizeProspectFilters,
  getProspectActivityDisplay,
  isProspectArchived,
  withProspectArchived,
  type ProspectListView,
  withProspectProfileChangeActivity,
  createProspectInstagramUrl,
  createProspectWhatsAppUrl,
  prospectPriorityLabels,
  prospectChannelLabels,
  prospectContactResultLabels,
  prospectStatusLabels,
  sortProspectsForContact,
  type ProspectFilters,
} from '../utils/prospectWorkflow';
import { formatActivityDateTime } from '../utils/activityTimeline';
import {
  canQualifyProspect,
  createPendingProspectConversion,
  getProspectConversionFieldErrors,
  prospectConversionFieldOrder,
  resumeProspectConversion,
  startProspectConversion,
  withRemoteConversionIds,
  type ProspectConversionInput,
} from '../utils/prospectConversion';
import { isAuthConfigured, loadAuthSession } from '../utils/authService';
import { getActiveWorkspaceId, isWorkspaceUuid } from '../utils/workspaceStorage';
import {
  createRemoteProspect,
  convertRemoteProspectToOpportunity,
  setRemoteProspectArchived,
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
type FeedbackTone = 'status' | 'error';
type ArchiveActionResult = { ok: true } | { ok: false; error: string };

/** Prospect fields edited in the form; other validation errors are shown as a general message. */
const prospectFormFields = ['name', 'phone', 'email'] as const;
type ProspectFormField = (typeof prospectFormFields)[number];

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
  const [storedFilters, setFilters] = useState(initialFilters);
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
  const [feedbackState, setFeedbackState] = useState<{ message: string; tone: FeedbackTone }>({
    message: '',
    tone: 'status',
  });
  const feedback = feedbackState.message;
  const setFeedback = useCallback(
    (message: string, tone: FeedbackTone = 'status') => setFeedbackState({ message, tone }),
    [],
  );
  const [toast, setToast] = useState('');
  const [conversionTarget, setConversionTarget] = useState<Prospect | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const importSubmissionRef = useRef(false);
  const selected = prospects.find((item) => item.id === (selectedId ?? openProspectId));
  const [listView, setListView] = useState<ProspectListView>('active');
  const [isBulkArchiveOpen, setIsBulkArchiveOpen] = useState(false);
  const [isBulkArchiving, setIsBulkArchiving] = useState(false);
  const services = useMemo(
    () => [...new Set(prospects.map((item) => item.potentialService).filter(Boolean))],
    [prospects],
  );
  // SCRUM-110: filter only by values the dropdowns can show; anything else counts as "Todos".
  const filters = useMemo(
    () => normalizeProspectFilters(storedFilters, { services }),
    [storedFilters, services],
  );
  const activeFilterCount = countActiveProspectFilters(filters);
  const visible = useMemo(
    () => filterProspects(prospects, filters, listView),
    [prospects, filters, listView],
  );
  const archivedCount = useMemo(() => prospects.filter(isProspectArchived).length, [prospects]);
  const bulkArchiveCandidates = useMemo(() => getBulkArchiveCandidates(prospects), [prospects]);
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
  }, [onProspectsChanged, setFeedback, workspaceContext.session?.activeWorkspaceId]);

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
        'error',
      );
      return false;
    }
    const before = prospects.find((item) => item.id === next.id);
    const changeAuthor = loadAuthSession()?.email;
    if (before) next = withProspectProfileChangeActivity(before, next, changeAuthor);
    const changeEntry = next.activities.at(-1);
    const changeSummary =
      changeEntry && changeEntry !== before?.activities.at(-1) && changeEntry.type === 'note'
        ? changeEntry.description
        : undefined;
    if (isAuthConfigured() && workspaceId) {
      try {
        const remote = await updateRemoteProspectProfile({
          workspaceId,
          prospect: next,
          idempotencyKey: `update-prospect:${next.id}:${next.version ?? 1}:${next.updatedAt}`,
          changeSummary,
          changeAuthor,
        });
        if (!remote.ok) {
          setFeedback(remote.message, 'error');
          return false;
        }
        next = { ...next, version: remote.version };
      } catch (error) {
        setFeedback(
          error instanceof Error
            ? `No se pudo guardar en Supabase: ${error.message}`
            : 'No se pudo guardar en Supabase. Los cambios siguen abiertos para reintentar.',
          'error',
        );
        return false;
      }
    }
    const result = saveProspectWithResult(next);
    if (!result.ok) {
      setFeedback(getProspectSaveErrorMessage(result), 'error');
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
      setFeedback(getProspectSaveErrorMessage(localResult), 'error');
      return false;
    }
    const workspaceId = workspaceContext.session?.activeWorkspaceId;
    if (isAuthConfigured() && !isWorkspaceUuid(workspaceId)) {
      setFeedback(
        'No se pudo identificar el espacio de trabajo en Supabase. Volvé a iniciar sesión o seleccioná otro espacio.',
        'error',
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
          'error',
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
      return setFeedback(result.error, 'error');
    }
    refresh();
    onOpportunitiesChanged?.();
    setConversionTarget(null);
    setFeedback('Oportunidad creada. Revisá el próximo paso en Seguimiento.');
  }
  /**
   * Archives or restores one prospect (SCRUM-111). With Supabase the RPC writes the history
   * entry; the local copy is updated right away and the list is reloaded.
   */
  async function setArchived(
    prospect: Prospect,
    archived: boolean,
    reason = '',
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const author = loadAuthSession()?.email ?? '';
    const workspaceId = workspaceContext.session?.activeWorkspaceId;
    let next: Prospect;
    if (isAuthConfigured()) {
      if (!isWorkspaceUuid(workspaceId))
        return {
          ok: false,
          error:
            'No se pudo identificar el espacio de trabajo en Supabase. Volvé a iniciar sesión o seleccioná otro espacio.',
        };
      try {
        const remote = await setRemoteProspectArchived({
          workspaceId,
          prospect,
          archived,
          reason,
          author,
        });
        if (!remote.ok) return { ok: false, error: remote.message };
        next = withProspectArchived(prospect, {
          archived,
          reason,
          author,
          version: remote.version,
          ...(remote.archivedAt ? { at: remote.archivedAt } : {}),
        });
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof Error
              ? `No se pudo guardar en Supabase: ${error.message}`
              : 'No se pudo guardar en Supabase.',
        };
      }
    } else {
      next = withProspectArchived(prospect, { archived, reason, author });
    }
    const saved = saveProspectWithResult(next);
    if (!saved.ok) return { ok: false, error: getProspectSaveErrorMessage(saved) };
    setProspects((current) => current.map((item) => (item.id === next.id ? next : item)));
    return { ok: true };
  }
  async function archiveFromDetail(prospect: Prospect, reason: string) {
    const result = await setArchived(prospect, true, reason);
    if (!result.ok) return result;
    setSelectedId(null);
    onOpenProspectHandled?.();
    setFeedback(`${prospect.name} quedó archivado. Lo encontrás en Archivados.`);
    await refresh();
    return result;
  }
  async function restoreFromDetail(prospect: Prospect) {
    const result = await setArchived(prospect, false);
    if (!result.ok) return result;
    setFeedback(`${prospect.name} volvió a Prospectos activos.`);
    await refresh();
    return result;
  }
  async function archiveInBulk() {
    setIsBulkArchiving(true);
    const failed: string[] = [];
    for (const prospect of bulkArchiveCandidates) {
      const result = await setArchived(
        prospect,
        true,
        prospect.status === 'converted' ? 'Ya es cliente' : 'No interesado',
      );
      if (!result.ok) failed.push(prospect.name);
    }
    const archived = bulkArchiveCandidates.length - failed.length;
    setIsBulkArchiving(false);
    setIsBulkArchiveOpen(false);
    setFeedback(
      failed.length
        ? `Se archivaron ${archived} de ${bulkArchiveCandidates.length} prospectos. No se pudieron archivar: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}.`
        : `Se archivaron ${archived} prospecto(s) convertidos o no interesados.`,
      failed.length ? 'error' : 'status',
    );
    await refresh();
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
        feedbackTone={feedbackState.tone}
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
          onArchive={archiveFromDetail}
          onRestore={restoreFromDetail}
          onReload={refresh}
          feedback={feedback}
          feedbackTone={feedbackState.tone}
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
      {feedback &&
        (feedbackState.tone === 'error' ? (
          <p className="form-error" role="alert">
            {feedback}
          </p>
        ) : (
          <p className="commercial-note" role="status">
            {feedback}
          </p>
        ))}
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
            <h2>{listView === 'archived' ? 'Prospectos archivados' : 'Todos los prospectos'}</h2>
          </div>
          <span className="line-count">{visible.length}</span>
        </div>
        {activeFilterCount > 0 && (
          <p className="commercial-note prospect-active-filters" role="status">
            {activeFilterCount === 1 ? '1 filtro activo' : `${activeFilterCount} filtros activos`} ·{' '}
            {visible.length} resultado{visible.length === 1 ? '' : 's'}.{' '}
            <button
              className="button button-link"
              type="button"
              onClick={() => updateFilters(defaultProspectFilters)}
            >
              Limpiar filtros
            </button>
          </p>
        )}
        <div className="prospect-list-toolbar">
          <div
            className="service-entry-toggle prospect-view-toggle"
            role="group"
            aria-label="Prospectos activos o archivados"
          >
            <button
              className={`button button-line ${listView === 'active' ? 'is-selected' : ''}`}
              type="button"
              aria-pressed={listView === 'active'}
              onClick={() => setListView('active')}
            >
              Activos
            </button>
            <button
              className={`button button-line ${listView === 'archived' ? 'is-selected' : ''}`}
              type="button"
              aria-pressed={listView === 'archived'}
              onClick={() => setListView('archived')}
            >
              Archivados ({archivedCount})
            </button>
          </div>
          {listView === 'active' && bulkArchiveCandidates.length > 0 && (
            <button
              className="button button-line"
              type="button"
              onClick={() => setIsBulkArchiveOpen(true)}
            >
              Archivar convertidos y no interesados ({bulkArchiveCandidates.length})
            </button>
          )}
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
              {services.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
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
            {listView === 'archived' ? (
              <>
                <h3>No hay prospectos archivados con estos filtros</h3>
                <p>Los prospectos que archives van a aparecer acá, con su historial.</p>
              </>
            ) : (
              <>
                <h3>No hay prospectos con estos filtros</h3>
                <p>Importá una lista o creá un prospecto para comenzar.</p>
              </>
            )}
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
      {isBulkArchiveOpen && (
        <div className="modal-backdrop">
          <section
            className="confirmation-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="bulk-archive-title"
            aria-describedby="bulk-archive-description"
          >
            <h2 id="bulk-archive-title">¿Archivar {bulkArchiveCandidates.length} prospecto(s)?</h2>
            <p id="bulk-archive-description">
              Se archivan los convertidos y los no interesados. Conservan su historial y los podés
              restaurar desde Archivados.
            </p>
            <div className="confirmation-actions">
              <button
                className="button button-line"
                type="button"
                autoFocus
                disabled={isBulkArchiving}
                onClick={() => setIsBulkArchiveOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="button button-primary"
                type="button"
                disabled={isBulkArchiving}
                onClick={() => void archiveInBulk()}
              >
                {isBulkArchiving ? 'Archivando…' : 'Sí, archivar'}
              </button>
            </div>
          </section>
        </div>
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
            {isProspectArchived(prospect) && <span className="status-badge">Archivado</span>}
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
      {!isProspectArchived(prospect) && (
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
      )}
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
                <strong>{getProspectActivityDisplay(activity).title}</strong>
                <small>{formatActivityDateTime(activity.occurredAt)}</small>
                {getProspectActivityDisplay(activity).note && (
                  <p>{getProspectActivityDisplay(activity).note}</p>
                )}
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
  feedbackTone = 'status',
  onOpenOpportunity,
  onReload,
  onOpportunitiesChanged,
  onDirtyChange,
  onRegisterResult,
  onArchive,
  onRestore,
}: {
  prospect: Prospect;
  initialContactChannel: ProspectChannel;
  isNew?: boolean;
  onBack: () => void;
  onSave: (prospect: Prospect) => boolean | Promise<boolean>;
  onArchive?: (prospect: Prospect, reason: string) => Promise<ArchiveActionResult>;
  onRestore?: (prospect: Prospect) => Promise<ArchiveActionResult>;
  feedback: string;
  feedbackTone?: FeedbackTone;
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
  const [conversionError, setConversionError] = useState('');
  const [pendingConversion, setPendingConversion] = useState<Prospect | null>(null);
  const isArchived = isProspectArchived(prospect);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const [isArchiving, setIsArchiving] = useState(false);
  async function confirmArchive(reason: string) {
    if (!onArchive) return;
    setIsArchiving(true);
    const result = await onArchive(prospect, reason);
    setIsArchiving(false);
    if (result.ok) setIsArchiveOpen(false);
    else setArchiveError(result.error);
  }
  async function restore() {
    if (!onRestore) return;
    setIsArchiving(true);
    const result = await onRestore(prospect);
    setIsArchiving(false);
    setArchiveError(result.ok ? '' : result.error);
  }
  const allFieldErrors = getProspectFieldErrors(draft);
  const formFieldErrors: Partial<Record<ProspectFormField, string>> = {
    name: allFieldErrors.name,
    phone: allFieldErrors.phone,
    email: allFieldErrors.email,
  };
  // Fields that are not edited in this form (status, priority, channel, date) are reported once.
  const otherFieldError = Object.entries(allFieldErrors).find(
    ([key]) => !(prospectFormFields as readonly string[]).includes(key),
  )?.[1];
  const validation = useFieldValidation(
    `prospect-${prospect.id}`,
    formFieldErrors,
    prospectFormFields,
  );
  const [showOtherFieldError, setShowOtherFieldError] = useState(false);
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
  function showConversionError(message: string) {
    setConversionFeedback('');
    setConversionError(message);
  }
  function showConversionSuccess() {
    setConversionError('');
    setConversionFeedback('Oportunidad creada. Revisá su contexto y próximo paso en Seguimiento.');
  }
  async function beginConversion(input: ProspectConversionInput) {
    setConversionError('');
    try {
      let pending = createPendingProspectConversion(prospect, input);
      const workspaceId = workspaceContext.session?.activeWorkspaceId;
      if (isAuthConfigured()) {
        if (!isWorkspaceUuid(workspaceId)) {
          showConversionError(
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
          showConversionError(remote.message);
          return;
        }
        pending = { ...withRemoteConversionIds(pending, remote), version: remote.version };
      }
      setPendingConversion(pending);
      const pendingSave = saveProspectWithResult(pending);
      if (!pendingSave.ok) {
        showConversionError('No se pudo iniciar la conversión. No se creó cliente ni oportunidad.');
        return;
      }
      const result = resumeProspectConversion(pending);
      if (!result.ok) {
        showConversionError(result.error);
        return;
      }
      onReload();
      onOpportunitiesChanged?.();
      setPendingConversion(null);
      setIsConversionOpen(false);
      showConversionSuccess();
    } catch (error) {
      showConversionError(
        error instanceof Error ? error.message : 'No se pudo iniciar la conversión.',
      );
    }
  }
  function retryConversion() {
    const result = resumeProspectConversion(pendingConversion ?? prospect);
    if (!result.ok) return showConversionError(result.error);
    onReload();
    onOpportunitiesChanged?.();
    setPendingConversion(null);
    showConversionSuccess();
  }
  async function saveDraft() {
    if (!validation.validateForSubmit()) return;
    setShowOtherFieldError(Boolean(otherFieldError));
    if (otherFieldError) return;
    // Only the fields edited in this form are taken from the draft. Status, next step, history and
    // version come from the current prospect, which may have changed after the form was opened.
    const editedFields = Object.fromEntries(
      detailFields.map(([key]) => [key, draft[key]]),
    ) as Partial<Prospect>;
    const next: Prospect = isNew
      ? draft
      : { ...prospect, ...editedFields, updatedAt: new Date().toISOString() };
    if (await onSave(next)) setIsEditing(false);
  }
  function cancelEditing() {
    setDraft(prospect);
    setIsEditing(false);
    validation.reset();
    setShowOtherFieldError(false);
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
        {!isNew && !isArchived && onRegisterResult && (
          <button className="button button-primary" type="button" onClick={onRegisterResult}>
            Registrar resultado
          </button>
        )}
      </header>
      {feedback &&
        (feedbackTone === 'error' ? (
          <p className="form-error" role="alert">
            {feedback}
          </p>
        ) : (
          <p className="commercial-note" role="status">
            {feedback}
          </p>
        ))}
      {isArchived && (
        <div className="commercial-warning prospect-archived-notice" role="status">
          <p>
            <strong>Prospecto archivado</strong> el {formatActivityDateTime(prospect.archivedAt!)}.
            Está en solo lectura: restauralo para editarlo o registrar contactos.
          </p>
          <button
            className="button button-primary"
            type="button"
            disabled={isArchiving}
            onClick={() => void restore()}
          >
            {isArchiving ? 'Restaurando…' : 'Restaurar prospecto'}
          </button>
        </div>
      )}
      {archiveError && !isArchiveOpen && (
        <p className="form-error" role="alert">
          {archiveError}
        </p>
      )}
      <div className="prospect-detail-grid">
        <section className="quote-card prospect-form">
          <h2>Datos del prospecto</h2>
          {isEditing ? (
            <div className="form-grid">
              {detailFields.map(([key, label]) => {
                const validated = (prospectFormFields as readonly string[]).includes(key)
                  ? (key as ProspectFormField)
                  : null;
                return (
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
                        {...(validated ? validation.fieldProps(validated) : {})}
                      />
                    )}
                    {validated && (
                      <FieldError
                        id={validation.errorId(validated)}
                        message={validation.visibleError(validated)}
                      />
                    )}
                  </label>
                );
              })}
              {showOtherFieldError && otherFieldError && (
                <p className="form-error" role="alert">
                  {otherFieldError}
                </p>
              )}
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
            ) : isArchived ? null : (
              <>
                <button
                  className="button button-line"
                  type="button"
                  onClick={() => {
                    // Start from the current data: the prospect may have changed since it opened.
                    setDraft(prospect);
                    setIsEditing(true);
                  }}
                >
                  Editar datos
                </button>
                {!isNew && onArchive && (
                  <button
                    className="button button-line"
                    type="button"
                    onClick={() => {
                      setArchiveError('');
                      setIsArchiveOpen(true);
                    }}
                  >
                    Archivar prospecto
                  </button>
                )}
              </>
            )}
          </div>
          {!isNew && !isArchived && canQualifyProspect(prospect) && (
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
          {conversionError && !isConversionOpen && (
            <p className="form-error" role="alert">
              {conversionError}
            </p>
          )}
        </section>
        {!isNew && !isArchived && (
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
              {[...prospect.activities].reverse().map((activity) => {
                const display = getProspectActivityDisplay(activity);
                return (
                  <li key={activity.id}>
                    <strong>{display.title}</strong>
                    {display.note && <p>{display.note}</p>}
                    {display.followUp && <p>{display.followUp}</p>}
                    <small>
                      {display.kindLabel ?? activityTypeLabels[activity.type]} ·{' '}
                      {formatActivityDateTime(activity.occurredAt)}
                      {activity.author ? ` · ${activity.author}` : ''}
                    </small>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="empty-inline">Todavía no hay contactos registrados.</p>
          )}
        </section>
      </div>
      {isArchiveOpen && (
        <ArchiveProspectDialog
          prospectName={prospect.name}
          isSaving={isArchiving}
          saveError={archiveError}
          onConfirm={(reason) => void confirmArchive(reason)}
          onCancel={() => {
            setIsArchiveOpen(false);
            setArchiveError('');
          }}
        />
      )}
      {isConversionOpen && (
        <ProspectConversionModal
          prospect={prospect}
          saveError={conversionError}
          onClose={() => {
            setIsConversionOpen(false);
            setConversionError('');
          }}
          onSave={beginConversion}
        />
      )}
    </main>
  );
}

function ProspectConversionModal({
  prospect,
  saveError = '',
  onClose,
  onSave,
}: {
  prospect: Prospect;
  /** Error from creating the opportunity (Supabase or local save), shown inside the modal. */
  saveError?: string;
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
  const validation = useFieldValidation(
    `conversion-${prospect.id}`,
    getProspectConversionFieldErrors(input),
    prospectConversionFieldOrder,
  );
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!validation.validateForSubmit()) return;
    onSave(input);
  }
  const set = <K extends keyof ProspectConversionInput>(
    key: K,
    value: ProspectConversionInput[K],
  ) => {
    setInput((current) => ({ ...current, [key]: value }));
  };
  const fieldError = (field: keyof ProspectConversionInput) => (
    <FieldError id={validation.errorId(field)} message={validation.visibleError(field)} />
  );
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
            {...validation.fieldProps('opportunityName')}
          />
          {fieldError('opportunityName')}
        </label>
        <label className="field">
          <span>Servicio de interés</span>
          <input
            value={input.serviceOfInterest}
            onChange={(e) => set('serviceOfInterest', e.target.value)}
            {...validation.fieldProps('serviceOfInterest')}
          />
          {fieldError('serviceOfInterest')}
        </label>
        <label className="field">
          <span>Nivel de interés</span>
          <select
            value={input.interestLevel}
            {...validation.fieldProps('interestLevel')}
            onChange={(e) =>
              set('interestLevel', e.target.value as ProspectConversionInput['interestLevel'])
            }
          >
            <option value="high">Alto</option>
            <option value="medium">Medio</option>
            <option value="low">Bajo</option>
          </select>
          {fieldError('interestLevel')}
        </label>
        <label className="field">
          <span>Necesidad detectada</span>
          <textarea
            value={input.detectedNeed}
            onChange={(e) => set('detectedNeed', e.target.value)}
            {...validation.fieldProps('detectedNeed')}
          />
          {fieldError('detectedNeed')}
        </label>
        <label className="field">
          <span>Valor estimado (opcional)</span>
          <input
            type="number"
            min="0"
            step="any"
            value={input.estimatedValue}
            onChange={(e) => set('estimatedValue', e.target.value)}
            {...validation.fieldProps('estimatedValue')}
          />
          {fieldError('estimatedValue')}
        </label>
        <label className="field">
          <span>Próximo paso</span>
          <input
            value={input.nextStep}
            onChange={(e) => set('nextStep', e.target.value)}
            {...validation.fieldProps('nextStep')}
          />
          {fieldError('nextStep')}
        </label>
        <label className="field">
          <span>Canal del próximo paso</span>
          <select
            value={input.nextStepChannel}
            {...validation.fieldProps('nextStepChannel')}
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
          {fieldError('nextStepChannel')}
        </label>
        <label className="field">
          <span>Fecha y hora del próximo paso</span>
          <input
            type="datetime-local"
            value={input.nextStepAt}
            onChange={(e) => set('nextStepAt', e.target.value)}
            {...validation.fieldProps('nextStepAt')}
          />
          {fieldError('nextStepAt')}
        </label>
        <label className="field">
          <span>Responsable</span>
          <input
            value={input.responsible}
            onChange={(e) => set('responsible', e.target.value)}
            {...validation.fieldProps('responsible')}
          />
          {fieldError('responsible')}
        </label>
        {saveError && (
          <p className="form-error" role="alert">
            {saveError}
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
