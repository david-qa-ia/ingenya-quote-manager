import { useEffect, useRef, useState, type FormEvent } from 'react';
import './App.css';
import { ContactAssistant } from './components/ContactAssistant';
import type { Client, ClientInput } from './types/client';
import type { FollowUpInboxItem } from './types/followUpInbox';
import type { Opportunity } from './types/opportunity';
import { CLIENTS_STORAGE_KEY, loadClients, saveClient } from './utils/clientStorage';
import { buildOpportunityContactActivity } from './utils/opportunityContactActivity';
import { buildJobList } from './utils/jobList';
import { resolveJobRef, type JobRef } from './utils/jobFile';
import { describeScheduledNextStep, isDiscardResult } from './utils/resultNextStep';
import { canSendDraftInOneStep } from './utils/quoteOneStepSend';
import { JobsView } from './components/JobsView';
import { ClientsView } from './components/ClientsView';
import { buildClientList } from './utils/clientList';
import { associateQuote } from './utils/quoteAssociations';
import {
  loadOpportunities,
  OPPORTUNITIES_STORAGE_KEY,
  saveOpportunity,
} from './utils/opportunityStorage';
import { AppHeader } from './components/AppHeader';
import { LaborCatalogView } from './components/LaborCatalogView';
import type {
  CatalogJob,
  CommercialStatus,
  Quote,
  QuoteDiscount,
  QuoteLine,
  QuoteStatus,
  SavedQuote,
  WorkUnit,
} from './types/quote';
import {
  calculateQuoteTotal,
  getQuoteDiscountError,
  getQuoteTotals,
} from './utils/quoteCalculations';
import {
  loadSavedQuotes,
  saveFinalizedQuoteCommercialState,
  saveQuote,
} from './utils/quoteDraftStorage';
import { finalizeQuote, QuoteFinalizationError } from './utils/quoteFinalization';
import { currencyFormatter } from './utils/quoteFormatting';
import { downloadQuotePdf } from './utils/quotePdf';
import { getQuoteCompletionError } from './utils/quoteValidation';
import { QuotePdfValidationError } from './utils/quotePdfModel';
import {
  applyCommercialTransition,
  commercialStatusLabels,
  createPreparedCommercialAudit,
} from './utils/quoteCommercialStatus';
import { addCatalogJob, setCatalogJobActive, updateCatalogJob } from './utils/jobCatalogStorage';
import { createCatalogQuoteLine } from './utils/quoteLineFactory';
import { addQuickService } from './utils/quickServiceAddition';
import { opportunityOriginLabels, resolveActiveNavigationSection } from './utils/appNavigation';
import { useAppNavigation } from './utils/useAppNavigation';
import { useSavedQuotes } from './utils/useSavedQuotes';
import { useCommercialRecords } from './utils/useCommercialRecords';
import { useLaborCatalog } from './utils/useLaborCatalog';
import {
  ACTIVITIES_STORAGE_KEY,
  loadActivities,
  recordAutomaticActivity,
  recordCadenceActivity,
  recordNextActionActivity,
  saveActivity,
} from './utils/activityStorage';
import { MetricsDashboard } from './components/MetricsDashboard';
import { UnsavedQuoteDialog } from './components/UnsavedQuoteDialog';
import { hasUnsavedQuoteChanges } from './utils/quoteUnsavedChanges';
import { persistContact, syncRemoteContacts } from './utils/contactPersistence';
import { onLocalWrite } from './utils/localWriteEvents';
import {
  notifyLocalCommercialWrite,
  REMOTE_SYNC_APPLIED_EVENT,
  REMOTE_SYNC_FAILED_EVENT,
  startRemoteCommercialSync,
} from './utils/remoteCommercialSync';
import {
  notifyLocalDocumentWrite,
  REMOTE_DOCUMENTS_LOADED_EVENT,
  startRemoteDocumentSync,
} from './utils/remoteDocumentSync';
import { useFieldValidation } from './components/useFieldValidation';
import {
  getManualQuoteLineFieldErrors,
  manualQuoteLineFieldOrder,
} from './utils/manualQuoteLineValidation';
import { CadenceView } from './components/CadenceView';
import { ProspectingView } from './components/ProspectingView';
import { OpportunityDetailView } from './components/OpportunityDetailView';
import { TodayView } from './components/TodayView';
import { SavedQuotesView } from './components/SavedQuotesView';
import { QuoteSummaryView } from './components/QuoteSummaryView';
import { QuoteLinkingSection } from './components/QuoteLinkingSection';
import { ServiceEntryCard } from './components/ServiceEntryCard';
import { QuoteDiscountField } from './components/QuoteDiscountField';
import { QuoteLinesEditor } from './components/QuoteLinesEditor';
import {
  RegisterResultDrawer,
  type InboxActionInput,
  type RegisterResultSubmitResult,
} from './components/RegisterResultDrawer';
import { resultNextStepLabels } from './utils/resultNextStep';
import { syncResponsibles } from './utils/responsibleSync';
import { syncCompanyProfile } from './utils/companyProfileSync';
import {
  hasSingleResponsible,
  loadResponsibles,
  primaryResponsibleName,
} from './utils/responsibleStorage';
import type { ProspectContactExtras } from './utils/prospectContextSync';
import {
  clearQuoteRecovery,
  isQuoteRecoveryUseful,
  loadQuoteRecovery,
  saveQuoteRecovery,
} from './utils/quoteRecoveryStorage';
import { QuoteDetailView } from './components/QuoteDetailView';
import { formatNumberInput, parseLocaleNumber } from './utils/localeNumber';
import { RegisterQuoteSendDrawer, type QuoteSendInput } from './components/RegisterQuoteSendDrawer';
import {
  defaultProspectFilters,
  normalizeProspectFilters,
  registerProspectAction,
  type ProspectFilters,
} from './utils/prospectWorkflow';
import {
  PROSPECT_FILTERS_STORAGE_KEY,
  PROSPECTS_STORAGE_KEY,
  isProspect,
  loadProspects,
  saveProspectWithResult,
} from './utils/prospectStorage';
import {
  CADENCE_EXECUTIONS_STORAGE_KEY,
  cancelCadencesForCommercialClose,
  loadCadenceExecutions,
  saveCadenceExecution,
} from './utils/cadenceStorage';
import { transitionNextAction } from './utils/opportunityNextAction';
import {
  closeOpportunityForAcceptedQuote,
  closeOpportunityForRejectedQuote,
} from './utils/opportunityQuoteSettlement';
import { canCreateQuoteVersion, collectQuoteVersions } from './utils/quoteVersioning';
import { mirrorProspectActivitiesToOpportunity } from './utils/prospectConversion';
import { completeCadenceAction } from './utils/cadenceTransitions';
import { loadCommercialOutcomes } from './utils/commercialOutcomeStorage';
import { loadFollowUpInbox } from './utils/followUpInboxSources';
import { deriveGlobalSearchResults } from './utils/globalSearch';
import type { GlobalSearchResult } from './types/globalSearch';
import type { Prospect } from './types/prospect';
import { useWorkspace } from './context/useWorkspace';
import { WorkspaceAccessState } from './components/WorkspaceAccessState';
import { UiIcon } from './components/UiIcon';
import { isWorkspaceUuid, workspaceStorageKey } from './utils/workspaceStorage';
import { LoginView } from './components/LoginView';
import { SettingsView } from './components/SettingsView';
import { commitLocalFollowUpResult } from './utils/followUpResultTransaction';
import { isAuthConfigured } from './utils/authService';
import {
  loadRemoteProspects,
  mapRemoteProspect,
  registerRemoteProspectResult,
  registerRemoteQuoteSend,
  syncAndRegisterRemoteLocalQuoteSend,
  updateRemoteProspectProfile,
  SupabaseRepositoryError,
} from './utils/supabaseRepository';
import { commitLocalQuoteSend, hasQuoteSendRecovery } from './utils/quoteSendTransaction';
import {
  saveDirectClientQuote,
  type DirectClientInput,
  type DirectQuoteFollowUpInput,
} from './utils/directClientQuote';
import { convertDirectQuoteToOpportunity } from './utils/directQuoteConversion';
import {
  syncConvertedProspectContact,
  syncConvertedProspectOpportunity,
} from './utils/prospectContextSync';
import {
  clearProspectResultRecovery,
  loadProspectResultRecovery,
  saveProspectResultRecovery,
} from './utils/prospectResultRecovery';

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  hourCycle: 'h23',
  timeZone: 'America/Argentina/Buenos_Aires',
});

function createLineId(): string {
  return crypto.randomUUID();
}

function createQuoteId(): string {
  return `PRES-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function loadProspectFilters(): ProspectFilters {
  try {
    const stored = localStorage.getItem(workspaceStorageKey(PROSPECT_FILTERS_STORAGE_KEY));
    if (!stored) return defaultProspectFilters;
    // SCRUM-110: an unknown stored value would filter while the dropdown shows "Todos".
    return normalizeProspectFilters(JSON.parse(stored));
  } catch {
    return defaultProspectFilters;
  }
}

function App() {
  const workspaceContext = useWorkspace();
  const {
    catalogJobs,
    catalogLoadIssue,
    reloadCatalog,
    writeCatalog,
    showSavedCatalog,
    saveCatalog,
  } = useLaborCatalog();
  const [quoteId, setQuoteId] = useState(createQuoteId);
  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus>('draft');
  const [commercialStatus, setCommercialStatus] = useState<CommercialStatus>('prepared');
  const [commercialStatusAudit, setCommercialStatusAudit] = useState(() =>
    createPreparedCommercialAudit(new Date().toISOString()),
  );
  const [sentAudit, setSentAudit] = useState<Quote['sentAudit']>();
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([]);
  const [quoteDiscount, setQuoteDiscount] = useState<QuoteDiscount | undefined>(undefined);
  const {
    savedQuotes,
    reloadSavedQuotes,
    visibleSavedQuotes,
    documentFilter: savedQuoteFilter,
    setDocumentFilter: setSavedQuoteFilter,
    commercialFilter: savedQuoteCommercialFilter,
    setCommercialFilter: setSavedQuoteCommercialFilter,
    downloadingQuoteId: downloadingSavedQuoteId,
    pdfFeedback: savedQuotePdfFeedback,
    downloadSavedQuotePdf,
  } = useSavedQuotes();
  const { currentView, setCurrentView, replaceView, opportunityOrigin, rememberOpportunityOrigin } =
    useAppNavigation();
  const { opportunities, reloadOpportunities, prospects, setProspects, reloadProspects } =
    useCommercialRecords();
  // SCRUM-119: "Prospectos" in the menu goes back to the list even from a prospect detail.
  const [prospectsResetToken, setProspectsResetToken] = useState(0);
  const [prospectFilters, setProspectFilters] = useState(loadProspectFilters);
  const [requestedProspectId, setRequestedProspectId] = useState<string | null>(null);
  const [openNewProspect, setOpenNewProspect] = useState(false);
  const [inboxContact, setInboxContact] = useState<FollowUpInboxItem | null>(null);
  const [drawerItem, setDrawerItem] = useState<FollowUpInboxItem | null>(null);
  const [clientId, setClientId] = useState<string | undefined>();
  const [directClientInput, setDirectClientInput] = useState<DirectClientInput | null>(null);
  const [directFollowUp, setDirectFollowUp] = useState<DirectQuoteFollowUpInput | undefined>();
  const [opportunityId, setOpportunityId] = useState<string | undefined>();
  const [shouldRefreshDocumentSnapshots, setShouldRefreshDocumentSnapshots] = useState(false);
  const [detailOpportunityId, setDetailOpportunityId] = useState<string | null>(null);
  /** Shown once at the top of a job file right after its prospect was converted. */
  const [convertedJobNotice, setConvertedJobNotice] = useState<string | null>(null);
  const [detailQuoteId, setDetailQuoteId] = useState<string | null>(null);
  const [quoteSendTarget, setQuoteSendTarget] = useState<SavedQuote | null>(null);
  /** Draft being sent with "Enviar": it is finalized only when the send is confirmed. */
  const [draftSendTarget, setDraftSendTarget] = useState<SavedQuote | null>(null);
  const [quoteSendRecoveryRequired, setQuoteSendRecoveryRequired] = useState(false);
  const [prospectHasUnsavedChanges, setProspectHasUnsavedChanges] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Bumped after remote data is copied into the browser so views that read it re-render.
  const [remoteDataRevision, setRemoteDataRevision] = useState(0);
  const [remoteSyncError, setRemoteSyncError] = useState('');
  // SCRUM-124: sign-out waits when some change has not reached Supabase yet.
  const [logoutPending, setLogoutPending] = useState(false);
  async function handleLogout(discardPending = false) {
    const result = await workspaceContext.logout({ discardPending });
    setLogoutPending(result === 'pending-changes');
  }
  // SCRUM-118: a quote left unsaved by a reload or a closed tab, offered back to the user.
  const [pendingQuoteRecovery, setPendingQuoteRecovery] = useState<SavedQuote | null>(() => {
    const recovery = loadQuoteRecovery();
    return isQuoteRecoveryUseful(recovery, loadSavedQuotes()) ? recovery : null;
  });
  useEffect(() => {
    const stopListening = onLocalWrite(notifyLocalCommercialWrite);
    const stopDocumentListening = onLocalWrite(notifyLocalDocumentWrite);
    const handleFailure = (event: Event) => {
      // SCRUM-114: the browser copy was restored; show the restored data and why.
      setRemoteSyncError((event as CustomEvent<string>).detail);
      reloadOpportunities();
      setRemoteDataRevision((value) => value + 1);
    };
    const handleApplied = () => setRemoteSyncError('');
    // SCRUM-123: quotes and the catalog changed in the browser copy (loaded or restored).
    const handleDocuments = () => {
      reloadSavedQuotes();
      reloadCatalog();
      setRemoteDataRevision((value) => value + 1);
    };
    window.addEventListener(REMOTE_SYNC_FAILED_EVENT, handleFailure);
    window.addEventListener(REMOTE_SYNC_APPLIED_EVENT, handleApplied);
    window.addEventListener(REMOTE_DOCUMENTS_LOADED_EVENT, handleDocuments);
    return () => {
      stopListening();
      stopDocumentListening();
      window.removeEventListener(REMOTE_SYNC_FAILED_EVENT, handleFailure);
      window.removeEventListener(REMOTE_SYNC_APPLIED_EVENT, handleApplied);
      window.removeEventListener(REMOTE_DOCUMENTS_LOADED_EVENT, handleDocuments);
    };
  }, [reloadSavedQuotes, reloadCatalog, reloadOpportunities]);
  const [clientName, setClientName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [quoteVersion, setQuoteVersion] = useState(1);
  const [quoteBasedOnId, setQuoteBasedOnId] = useState<string | undefined>();
  const [quoteChangeRequest, setQuoteChangeRequest] = useState<Quote['changeRequest']>();
  const [saveFeedback, setSaveFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [pdfFeedback, setPdfFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isFinalizationConfirmationOpen, setIsFinalizationConfirmationOpen] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const finalizationLockRef = useRef(false);
  const finalizationTriggerRef = useRef<HTMLButtonElement>(null);
  const finalizationCancelRef = useRef<HTMLButtonElement>(null);
  const finalizationConfirmRef = useRef<HTMLButtonElement>(null);
  const wasFinalizationConfirmationOpenRef = useRef(false);
  const [finalizationFeedback, setFinalizationFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  // SCRUM-117: nothing is preselected. A hidden first service made "Agregar servicio"
  // add a service the user never chose while the search field looked empty.
  const [selectedJobId, setSelectedJobId] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [isCatalogMenuOpen, setIsCatalogMenuOpen] = useState(false);
  const [catalogQuantity, setCatalogQuantity] = useState('1');
  const [catalogUnitPrice, setCatalogUnitPrice] = useState('');
  const [serviceEntryMode, setServiceEntryMode] = useState<'catalog' | 'manual'>('catalog');
  const [manualName, setManualName] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualUnit, setManualUnit] = useState<WorkUnit>('unit');
  const [manualQuantity, setManualQuantity] = useState('1');
  const [manualUnitPrice, setManualUnitPrice] = useState('');
  const [saveManualToCatalog, setSaveManualToCatalog] = useState(false);
  const [isOptionalDataOpen, setIsOptionalDataOpen] = useState(false);
  const [isLinkingOpen, setIsLinkingOpen] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [manualError, setManualError] = useState('');
  const manualValidation = useFieldValidation(
    'manual-line',
    getManualQuoteLineFieldErrors({
      name: manualName,
      quantity: manualQuantity,
      unitPrice: manualUnitPrice,
    }),
    manualQuoteLineFieldOrder,
  );
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editUnitPrice, setEditUnitPrice] = useState('');
  const [editError, setEditError] = useState('');

  const [pendingQuoteReplacement, setPendingQuoteReplacement] = useState<(() => void) | null>(null);
  const [quoteReplacementError, setQuoteReplacementError] = useState('');
  const quoteReplacementApprovedRef = useRef(false);

  const activeCatalogJobs = catalogJobs.filter((job) => job.isActive);
  const visibleActiveCatalogJobs = activeCatalogJobs.filter((job) =>
    `${job.name} ${job.description ?? ''}`
      .toLocaleLowerCase('es')
      .includes(catalogSearch.trim().toLocaleLowerCase('es')),
  );
  const selectedVisibleJob = visibleActiveCatalogJobs.find((job) => job.id === selectedJobId);
  const associatedClient = clientId
    ? loadClients().items.find((item) => item.id === clientId)
    : undefined;
  const associatedOpportunity = opportunityId
    ? opportunities.find(
        (item) => item.id === opportunityId && item.clientId === associatedClient?.id,
      )
    : undefined;
  const isContextualOpportunityQuote = Boolean(associatedClient && associatedOpportunity);
  const quoteTotals = getQuoteTotals(quoteLines, quoteDiscount);
  const quoteDiscountError = getQuoteDiscountError(quoteDiscount, quoteTotals.subtotal);
  const globalSearchResults = deriveGlobalSearchResults(
    searchQuery,
    loadClients().items,
    opportunities,
    savedQuotes,
    prospects,
  );

  function resetWorkspaceContext() {
    setProspectHasUnsavedChanges(false);
    setCurrentView('today');
    setProspectFilters(defaultProspectFilters);
    setInboxContact(null);
    setDrawerItem(null);
    setDetailOpportunityId(null);
    setDetailQuoteId(null);
    setIsSearchOpen(false);
    setSearchQuery('');
    reloadOpportunities();
    reloadSavedQuotes();
    reloadCatalog();
    setSelectedJobId('');
    setCatalogSearch('');
    setCatalogQuantity('1');
    setCatalogUnitPrice('');
  }
  useEffect(() => {
    if (isFinalizationConfirmationOpen) {
      finalizationCancelRef.current?.focus();
      wasFinalizationConfirmationOpenRef.current = true;
      return;
    }

    if (wasFinalizationConfirmationOpenRef.current) {
      finalizationTriggerRef.current?.focus();
      wasFinalizationConfirmationOpenRef.current = false;
    }
  }, [isFinalizationConfirmationOpen]);

  useEffect(() => {
    const workspaceId = workspaceContext.session?.activeWorkspaceId;
    if (!isAuthConfigured() || !isWorkspaceUuid(workspaceId)) return;
    let cancelled = false;
    loadRemoteProspects(workspaceId)
      .then((rows) => {
        if (cancelled) return;
        const next = rows.map((row) => mapRemoteProspect(row)).filter(isProspect);
        next.forEach((prospect) => saveProspectWithResult(prospect));
        setProspects(next);
      })
      .catch(() => {
        // The local mirror remains available when the remote read is temporarily unavailable.
      });
    // SCRUM-113/114: contacts, then opportunities and their activity, come from Supabase too, so
    // they are the same in every browser. Contacts first: opportunities reference them.
    syncRemoteContacts(workspaceId)
      .catch(() => {
        // Same fallback: keep showing the browser copy.
      })
      .then(() => startRemoteCommercialSync(workspaceId))
      // SCRUM-123: quotes, catalog, scripts, cadences and quote activity.
      .then(() => startRemoteDocumentSync(workspaceId))
      .then(() => {
        if (cancelled) return;
        reloadOpportunities();
        window.dispatchEvent(new Event('activitiesupdated'));
        setRemoteDataRevision((value) => value + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceContext.session?.activeWorkspaceId, reloadOpportunities, setProspects]);

  // SCRUM-117: the team list of responsibles, shared through Supabase. The first time, names
  // already typed in prospects, their history and opportunities become the initial list.
  useEffect(() => {
    const workspaceId = workspaceContext.session?.activeWorkspaceId;
    const names = [
      ...loadProspects().items.flatMap((prospect) => [
        prospect.responsible,
        ...prospect.activities.map((activity) => activity.author ?? ''),
      ]),
      ...loadOpportunities().items.map((opportunity) => opportunity.responsibleSeller ?? ''),
    ];
    syncResponsibles(workspaceId ?? undefined, names).catch(() => {
      // The browser copy of the list keeps working while Supabase is unavailable.
    });
    // SCRUM-119: the company data printed on quotes comes from Supabase too.
    syncCompanyProfile(workspaceId ?? undefined).catch(() => {
      // The PDF keeps using the browser copy (or Ventro's data) while Supabase is unavailable.
    });
  }, [workspaceContext.session?.activeWorkspaceId, remoteDataRevision]);

  useEffect(() => {
    if (!isFinalizationConfirmationOpen) return;

    function handleConfirmationKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();

        if (!isFinalizing && !finalizationLockRef.current) {
          setIsFinalizationConfirmationOpen(false);
        }

        return;
      }

      if (event.key !== 'Tab') return;

      event.preventDefault();

      if (isFinalizing || finalizationLockRef.current) return;

      const cancelButton = finalizationCancelRef.current;
      const confirmButton = finalizationConfirmRef.current;

      if (!cancelButton || !confirmButton) return;

      if (event.shiftKey) {
        (document.activeElement === cancelButton ? confirmButton : cancelButton).focus();
      } else {
        (document.activeElement === confirmButton ? cancelButton : confirmButton).focus();
      }
    }

    document.addEventListener('keydown', handleConfirmationKeyDown);
    return () => document.removeEventListener('keydown', handleConfirmationKeyDown);
  }, [isFinalizationConfirmationOpen, isFinalizing]);

  /** SCRUM-120: who is acting when a form has no "Responsable" field (shared account). */
  function currentResponsible(): string {
    return primaryResponsibleName(loadResponsibles());
  }

  function getCurrentQuote(): Quote {
    return {
      id: quoteId,
      status: quoteStatus,
      commercialStatus,
      commercialStatusAudit,
      sentAudit,
      clientId,
      opportunityId,
      clientName,
      projectName,
      lines: quoteLines,
      ...(quoteDiscount ? { discount: quoteDiscount } : {}),
      version: quoteVersion,
      basedOnQuoteId: quoteBasedOnId,
      changeRequest: quoteChangeRequest,
    };
  }

  const quoteHasUnsavedChanges = hasUnsavedQuoteChanges(
    getCurrentQuote(),
    savedQuotes.find((quote) => quote.id === quoteId),
  );
  const hasUnsavedWorkspaceChanges = quoteHasUnsavedChanges || prospectHasUnsavedChanges;

  // SCRUM-118: keep a recovery copy of the quote while it has unsaved changes. While an older
  // copy is waiting for the user's decision, it is not overwritten.
  const currentQuoteSnapshot = JSON.stringify(getCurrentQuote());
  useEffect(() => {
    if (pendingQuoteRecovery) return;
    const current = JSON.parse(currentQuoteSnapshot) as Quote;
    if (quoteHasUnsavedChanges) saveQuoteRecovery(current);
    else if (loadQuoteRecovery()?.id === current.id) clearQuoteRecovery();
  }, [currentQuoteSnapshot, quoteHasUnsavedChanges, pendingQuoteRecovery]);

  // SCRUM-118: the browser asks before a reload or close would drop unsaved work.
  useEffect(() => {
    if (!hasUnsavedWorkspaceChanges) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedWorkspaceChanges]);

  function recoverPendingQuote() {
    const recovery = pendingQuoteRecovery;
    if (!recovery) return;
    if (deferQuoteReplacement(recoverPendingQuote)) return;
    loadSavedQuoteIntoState(recovery);
    setPendingQuoteRecovery(null);
    setCurrentView('editor');
  }

  function discardPendingQuote() {
    clearQuoteRecovery();
    setPendingQuoteRecovery(null);
  }

  /**
   * Defers an action that replaces the quote in the editor while it has unsaved changes and
   * asks first (SCRUM-97). Returns true when the action was deferred.
   */
  function deferQuoteReplacement(action: () => void): boolean {
    if (quoteReplacementApprovedRef.current || !quoteHasUnsavedChanges) return false;
    setQuoteReplacementError('');
    setPendingQuoteReplacement(() => action);
    return true;
  }

  function runQuoteReplacement() {
    const action = pendingQuoteReplacement;
    setPendingQuoteReplacement(null);
    if (!action) return;
    quoteReplacementApprovedRef.current = true;
    try {
      action();
    } finally {
      quoteReplacementApprovedRef.current = false;
    }
  }

  function saveDraftAndReplaceQuote() {
    if (handleDraftSave()) runQuoteReplacement();
    else
      setQuoteReplacementError(
        'No se pudo guardar el borrador. Revisá el presupuesto o descartá los cambios para continuar.',
      );
  }

  function handleAssociation(client: Client | undefined, opportunity: Opportunity | undefined) {
    if (quoteStatus !== 'draft') return;
    const next = associateQuote(
      getCurrentQuote(),
      client,
      opportunity,
      savedQuotes.some((quote) => quote.id === quoteId) && !shouldRefreshDocumentSnapshots,
    );
    setClientId(next.clientId);
    setOpportunityId(next.opportunityId);
    setClientName(next.clientName);
    setProjectName(next.projectName);
    setSaveFeedback(null);
    if (client) setDirectClientInput(null);
    if (client) setDirectFollowUp(undefined);
    if (opportunity) setIsLinkingOpen(false);
    setShouldRefreshDocumentSnapshots(false);
  }

  function handleCatalogJobChange(jobId: string) {
    const nextJob = activeCatalogJobs.find((job) => job.id === jobId);

    if (!nextJob) return;

    setSelectedJobId(nextJob.id);
    setCatalogUnitPrice(formatNumberInput(nextJob.defaultPrice));
    setCatalogError('');
  }

  function handleCatalogSearchChange(value: string) {
    setCatalogSearch(value);
    setIsCatalogMenuOpen(true);
    if (selectedJobId) {
      setSelectedJobId('');
      setCatalogUnitPrice('');
    }
    setCatalogError('');
  }

  function handleCatalogServiceSelection(job: CatalogJob) {
    setCatalogSearch(job.name);
    handleCatalogJobChange(job.id);
    setIsCatalogMenuOpen(false);
  }

  function handleServiceEntryModeChange(mode: 'catalog' | 'manual') {
    setServiceEntryMode(mode);
    setCatalogError('');
    setManualError('');
  }

  function handleCatalogSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedVisibleJob) {
      setCatalogError('Seleccioná un servicio activo del catálogo.');
      return;
    }
    const quantity = parseLocaleNumber(catalogQuantity) ?? Number.NaN;
    const unitPrice = parseLocaleNumber(catalogUnitPrice) ?? Number.NaN;

    if (
      !Number.isFinite(quantity) ||
      !Number.isFinite(unitPrice) ||
      catalogUnitPrice.trim() === '' ||
      quantity <= 0 ||
      unitPrice < 0
    ) {
      setCatalogError('Ingresá una cantidad mayor a cero y un precio no negativo.');
      return;
    }

    setQuoteLines((currentLines) => [
      ...currentLines,
      createCatalogQuoteLine(selectedVisibleJob, createLineId(), quantity, unitPrice),
    ]);
    setCatalogQuantity('1');
    setCatalogUnitPrice(formatNumberInput(selectedVisibleJob.defaultPrice));
    setCatalogError('');
  }

  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = manualName.trim();
    const quantity = parseLocaleNumber(manualQuantity) ?? Number.NaN;
    const unitPrice = parseLocaleNumber(manualUnitPrice) ?? Number.NaN;

    if (!manualValidation.validateForSubmit()) {
      setManualError('');
      return;
    }

    const addition = addQuickService(
      catalogJobs,
      {
        name,
        description: manualDescription.trim() || undefined,
        unit: manualUnit,
        quantity,
        unitPrice,
      },
      saveManualToCatalog,
      writeCatalog,
      createLineId,
    );
    if (!addition.success) {
      setManualError(addition.message);
      return;
    }
    if (addition.catalogJobs) showSavedCatalog(addition.catalogJobs);
    setQuoteLines((currentLines) => [...currentLines, addition.line]);
    setManualName('');
    setManualDescription('');
    setManualUnit('unit');
    setManualQuantity('1');
    setManualUnitPrice('');
    setSaveManualToCatalog(false);
    setManualError('');
    manualValidation.reset();
  }

  function persistCatalog(nextJobs: CatalogJob[]): string | null {
    const error = saveCatalog(nextJobs);
    if (error) return error;
    const nextSelectedJob = nextJobs.find((job) => job.id === selectedJobId && job.isActive);
    setSelectedJobId(nextSelectedJob?.id ?? '');
    if (!nextSelectedJob) setCatalogSearch('');
    setCatalogUnitPrice(nextSelectedJob ? formatNumberInput(nextSelectedJob.defaultPrice) : '');
    return null;
  }

  function handleCatalogCreate(job: Omit<CatalogJob, 'id' | 'isActive'>): string | null {
    return persistCatalog(
      addCatalogJob(catalogJobs, { ...job, id: crypto.randomUUID(), isActive: true }),
    );
  }

  function handleCatalogUpdate(job: CatalogJob): string | null {
    return persistCatalog(updateCatalogJob(catalogJobs, job));
  }

  function handleCatalogActivation(job: CatalogJob, isActive: boolean): string | null {
    return persistCatalog(setCatalogJobActive(catalogJobs, job.id, isActive));
  }

  function handleEditStart(line: QuoteLine) {
    setEditingLineId(line.id);
    setEditQuantity(formatNumberInput(line.quantity));
    setEditUnitPrice(formatNumberInput(line.unitPrice));
    setEditError('');
  }

  function handleEditCancel() {
    setEditingLineId(null);
    setEditQuantity('');
    setEditUnitPrice('');
    setEditError('');
  }

  function handleEditSave(lineId: string) {
    const quantity = parseLocaleNumber(editQuantity) ?? Number.NaN;
    const unitPrice = parseLocaleNumber(editUnitPrice) ?? Number.NaN;

    if (
      !Number.isFinite(quantity) ||
      !Number.isFinite(unitPrice) ||
      editUnitPrice.trim() === '' ||
      quantity <= 0 ||
      unitPrice < 0
    ) {
      setEditError('Ingresá una cantidad mayor a cero y un precio no negativo.');
      return;
    }

    setQuoteLines((currentLines) =>
      currentLines.map((line) =>
        line.id === lineId
          ? {
              ...line,
              quantity,
              unitPrice,
            }
          : line,
      ),
    );
    handleEditCancel();
  }

  function handleLineDelete(lineId: string) {
    setQuoteLines((currentLines) => currentLines.filter((line) => line.id !== lineId));

    if (editingLineId === lineId) {
      handleEditCancel();
    }
  }

  function resetTransientState() {
    setSaveFeedback(null);
    setPdfFeedback(null);
    setCatalogError('');
    setManualError('');
    setFinalizationFeedback(null);
    setIsFinalizationConfirmationOpen(false);
    setIsFinalizing(false);
    finalizationLockRef.current = false;
    handleEditCancel();
  }

  function handleNewQuote() {
    if (deferQuoteReplacement(() => handleNewQuote())) return;
    setQuoteId(createQuoteId());
    setQuoteStatus('draft');
    setCommercialStatus('prepared');
    setCommercialStatusAudit(createPreparedCommercialAudit(new Date().toISOString()));
    setSentAudit(undefined);
    setQuoteLines([]);
    setQuoteDiscount(undefined);
    setClientName('');
    setProjectName('');
    setQuoteVersion(1);
    setQuoteBasedOnId(undefined);
    setQuoteChangeRequest(undefined);
    setClientId(undefined);
    setOpportunityId(undefined);
    setShouldRefreshDocumentSnapshots(false);
    setDirectClientInput(null);
    setDirectFollowUp(undefined);
    setIsLinkingOpen(false);
    resetTransientState();
    setCurrentView('editor');
  }

  function handleNewOpportunityQuote(opportunity: Opportunity) {
    if (deferQuoteReplacement(() => handleNewOpportunityQuote(opportunity))) return;
    const client = loadClients().items.find((item) => item.id === opportunity.clientId);
    handleNewQuote();
    setClientId(client?.id);
    setOpportunityId(opportunity.id);
    setClientName(client?.name ?? '');
    setProjectName(opportunity.name);
  }

  function loadSavedQuoteIntoState(savedQuote: SavedQuote) {
    setQuoteId(savedQuote.id);
    setQuoteStatus(savedQuote.status);
    setCommercialStatus(savedQuote.commercialStatus);
    setCommercialStatusAudit(savedQuote.commercialStatusAudit);
    setSentAudit(savedQuote.sentAudit);
    setQuoteLines(savedQuote.lines);
    setQuoteDiscount(savedQuote.discount);
    setClientId(savedQuote.clientId);
    setOpportunityId(savedQuote.opportunityId);
    setShouldRefreshDocumentSnapshots(false);
    setClientName(savedQuote.clientName);
    setProjectName(savedQuote.projectName);
    setQuoteVersion(savedQuote.version ?? 1);
    setQuoteBasedOnId(savedQuote.basedOnQuoteId);
    setQuoteChangeRequest(savedQuote.changeRequest);
    setDirectClientInput(null);
    setDirectFollowUp(undefined);
    setIsLinkingOpen(false);
    resetTransientState();
  }

  function handleSavedQuoteOpen(savedQuote: SavedQuote) {
    if (deferQuoteReplacement(() => handleSavedQuoteOpen(savedQuote))) return;
    // SCRUM-118: a finalized quote opens its commercial detail (register send, status, PDF),
    // not the read-only review, so a quote without an opportunity is no longer stuck.
    if (savedQuote.status === 'finalized') {
      handleQuoteDetailOpen(savedQuote);
      return;
    }
    loadSavedQuoteIntoState(savedQuote);
    setCurrentView('editor');
  }

  function handleSavedQuoteReview(savedQuote: SavedQuote) {
    if (deferQuoteReplacement(() => handleSavedQuoteReview(savedQuote))) return;
    loadSavedQuoteIntoState(savedQuote);
    setCurrentView('summary');
  }

  function handleQuoteDetailOpen(savedQuote: SavedQuote) {
    if (deferQuoteReplacement(() => handleQuoteDetailOpen(savedQuote))) return;
    setQuoteId(savedQuote.id);
    setQuoteStatus(savedQuote.status);
    setCommercialStatus(savedQuote.commercialStatus);
    setCommercialStatusAudit(savedQuote.commercialStatusAudit);
    setSentAudit(savedQuote.sentAudit);
    setQuoteLines(savedQuote.lines);
    setQuoteDiscount(savedQuote.discount);
    setClientId(savedQuote.clientId);
    setOpportunityId(savedQuote.opportunityId);
    setShouldRefreshDocumentSnapshots(false);
    setClientName(savedQuote.clientName);
    setProjectName(savedQuote.projectName);
    setQuoteVersion(savedQuote.version ?? 1);
    setQuoteBasedOnId(savedQuote.basedOnQuoteId);
    setQuoteChangeRequest(savedQuote.changeRequest);
    setDirectClientInput(null);
    setDirectFollowUp(undefined);
    setDetailQuoteId(savedQuote.id);
    rememberOpportunityOrigin();
    setCurrentView('quoteDetail');
  }

  function handleCreateQuoteVersion(source: SavedQuote, reason: string) {
    if (deferQuoteReplacement(() => handleCreateQuoteVersion(source, reason))) return;
    const opportunity = source.opportunityId
      ? loadOpportunities().items.find((item) => item.id === source.opportunityId)
      : undefined;
    if (!canCreateQuoteVersion(source, opportunity)) return;
    setQuoteId(createQuoteId());
    setQuoteStatus('draft');
    setCommercialStatus('prepared');
    setCommercialStatusAudit(createPreparedCommercialAudit(new Date().toISOString()));
    setSentAudit(undefined);
    setQuoteLines(source.lines.map((line) => ({ ...line, id: crypto.randomUUID() })));
    // The new version starts with the same discount; it can be changed while preparing it.
    setQuoteDiscount(source.discount);
    setClientId(source.clientId);
    setOpportunityId(source.opportunityId);
    setShouldRefreshDocumentSnapshots(false);
    setClientName(source.clientName);
    setProjectName(source.projectName);
    setQuoteVersion((source.version ?? 1) + 1);
    setQuoteBasedOnId(source.id);
    setQuoteChangeRequest({
      requestedAt: new Date().toISOString(),
      requestedBy: 'Pendiente de registrar',
      reason: reason.trim(),
    });
    resetTransientState();
    setCurrentView('editor');
  }

  /**
   * Opens the job file of a sale from any list. A converted prospect opens as its opportunity,
   * so the same sale always opens the same file.
   */
  function openJob(ref: JobRef) {
    const resolved =
      resolveJobRef(ref, {
        prospects: loadProspects().items,
        opportunities: loadOpportunities().items,
      }) ?? ref;
    if (resolved.kind === 'opportunity') {
      openOpportunityDetail(resolved.id);
      return;
    }
    rememberOpportunityOrigin();
    setRequestedProspectId(resolved.id);
    setCurrentView('prospects');
  }

  /**
   * After converting a prospect from its file, the same job file keeps showing the sale, now as
   * an opportunity: same header, same way back, and no extra step in the browser history.
   */
  function showConvertedJob(opportunityId: string) {
    reloadOpportunities();
    // A prospect opened from another list keeps that list as the way back; one opened from the
    // prospect list goes back to it.
    if (!requestedProspectId) rememberOpportunityOrigin();
    setRequestedProspectId(null);
    setDetailOpportunityId(opportunityId);
    setConvertedJobNotice(
      'Listo, ya es una oportunidad. El historial y el próximo paso siguen en esta ficha.',
    );
    replaceView('opportunityDetail');
    // The conversion form sits low in the prospect file; start the opportunity at its header.
    window.scrollTo({ top: 0 });
  }

  function openOpportunityDetail(id: string) {
    setConvertedJobNotice(null);
    reloadOpportunities();
    setDetailOpportunityId(id);
    rememberOpportunityOrigin();
    setCurrentView('opportunityDetail');
  }

  function handleFollowUpOpen(item: FollowUpInboxItem) {
    if (item.prospectId) {
      openJob({ kind: 'prospect', id: item.prospectId });
      return;
    }
    if (item.opportunityId) {
      openOpportunityDetail(item.opportunityId);
      return;
    }
    const target = item.quoteId
      ? savedQuotes.find((quote) => quote.id === item.quoteId)
      : savedQuotes.find((quote) => quote.opportunityId === item.opportunityId);
    if (target) {
      handleSavedQuoteOpen(target);
      return;
    }
    setSaveFeedback({
      type: 'error',
      message:
        'No hay un presupuesto asociado para abrir este contexto. El proyecto sigue disponible en el seguimiento.',
    });
  }

  function handleGlobalSearchSelect(result: GlobalSearchResult) {
    setIsSearchOpen(false);
    setSearchQuery('');
    if (result.opportunity) {
      openOpportunityDetail(result.opportunity.id);
      return;
    }
    if (result.quote) {
      handleQuoteDetailOpen(result.quote);
      return;
    }
    if (result.prospect) {
      openJob({ kind: 'prospect', id: result.prospect.id });
      return;
    }
    setProspectFilters((current) => ({ ...current, search: result.client?.name ?? '' }));
    setCurrentView('prospects');
  }

  function handleDashboardQuoteIntent(item: FollowUpInboxItem, mode: 'new' | 'existing') {
    if (deferQuoteReplacement(() => handleDashboardQuoteIntent(item, mode))) return;
    if (mode === 'existing' && item.quoteId) {
      const existing = savedQuotes.find((quote) => quote.id === item.quoteId);
      if (existing) {
        handleSavedQuoteOpen(existing);
        return;
      }
    }
    if (mode === 'new' && item.opportunityId) {
      const opportunity = opportunities.find((value) => value.id === item.opportunityId);
      const client = loadClients().items.find((value) => value.id === item.clientId);
      handleNewQuote();
      setClientId(client?.id);
      setOpportunityId(opportunity?.id);
      setClientName(client?.name ?? item.clientName);
      setProjectName(opportunity?.name ?? item.opportunityName ?? '');
    }
  }

  function saveOpportunityFromDetail(next: Opportunity, event: string): boolean {
    const sourceProspect = loadProspects().items.find(
      (prospect) => prospect.conversion?.draft.opportunityId === next.id,
    );
    const synced =
      event === 'edited' && sourceProspect
        ? syncConvertedProspectOpportunity(sourceProspect, next, next.responsibleSeller)
        : null;
    const saved = synced
      ? commitLocalFollowUpResult(
          [OPPORTUNITIES_STORAGE_KEY, PROSPECTS_STORAGE_KEY],
          [() => saveOpportunity(next), () => saveProspectWithResult(synced.prospect).ok],
        )
      : { ok: saveOpportunity(next) };
    if (!saved.ok) return false;
    if (synced) {
      mirrorProspectActivitiesToOpportunity(synced.prospect, synced.prospect.conversion!.draft);
      reloadProspects();
      void syncProspectContextRemotely(synced.prospect);
    }
    if (event === 'edited') reloadOpportunities();
    return true;
  }

  async function updateOpportunityClient(
    client: Client,
    input: ClientInput,
    extras?: ProspectContactExtras,
  ): Promise<string | null> {
    const now = new Date().toISOString();
    const next: Client = {
      ...input,
      id: client.id,
      createdAt: client.createdAt,
      updatedAt: now,
      ...(client.version !== undefined ? { version: client.version } : {}),
    };
    // SCRUM-113: Supabase confirms the contact before the browser copy changes.
    const remote = await persistContact(next, false);
    if (!remote.ok) return remote.error;
    next.version = remote.client.version;
    next.updatedAt = remote.client.updatedAt;
    const sourceProspect = loadProspects().items.find(
      (prospect) => prospect.conversion?.draft.clientId === client.id,
    );
    const synced = sourceProspect
      ? syncConvertedProspectContact(
          sourceProspect,
          input,
          primaryResponsibleName(loadResponsibles()) || sourceProspect.responsible,
          now,
          extras,
        )
      : null;
    const saved = synced
      ? commitLocalFollowUpResult(
          [CLIENTS_STORAGE_KEY, PROSPECTS_STORAGE_KEY],
          [() => saveClient(next), () => saveProspectWithResult(synced.prospect).ok],
        )
      : { ok: saveClient(next) };
    if (!saved.ok) return 'No se pudo guardar el contacto. Los datos existentes se conservaron.';
    if (synced) {
      mirrorProspectActivitiesToOpportunity(synced.prospect, synced.prospect.conversion!.draft);
      reloadProspects();
      void syncProspectContextRemotely(synced.prospect);
    }
    if (next.doNotContact) {
      loadOpportunities()
        .items.filter((item) => item.clientId === next.id && item.nextAction?.status === 'pending')
        .forEach((item) => {
          const cancelled = transitionNextAction(
            item,
            'cancelled',
            next.doNotContact!.recordedBy,
            `Pedido de no contacto: ${next.doNotContact!.reason}`,
            next.doNotContact!.recordedAt,
          );
          if (saveOpportunity(cancelled) && cancelled.nextAction)
            recordNextActionActivity(
              cancelled.id,
              cancelled.nextAction.id,
              'cancelled',
              'Recordatorio cancelado por pedido de no contacto.',
            );
        });
    }
    reloadOpportunities();
    return null;
  }

  async function syncProspectContextRemotely(prospect: Prospect) {
    const workspaceId = workspaceContext.session?.activeWorkspaceId;
    if (!isAuthConfigured() || !isWorkspaceUuid(workspaceId)) return;
    try {
      const remote = await updateRemoteProspectProfile({
        workspaceId,
        prospect,
        idempotencyKey: `context-prospect:${prospect.id}:${prospect.version ?? 1}:${prospect.updatedAt}`,
      });
      if (!remote.ok) {
        setSaveFeedback({ type: 'error', message: remote.message });
        return;
      }
      const current = loadProspects().items.find((item) => item.id === prospect.id);
      if (current?.updatedAt !== prospect.updatedAt) return;
      if (saveProspectWithResult({ ...current, version: remote.version }).ok) {
        reloadProspects();
      }
    } catch (error) {
      setSaveFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? `No se pudo sincronizar el prospecto: ${error.message}`
            : 'No se pudo sincronizar el prospecto en Supabase.',
      });
    }
  }

  async function handleFollowUpAction(
    item: FollowUpInboxItem,
    input: InboxActionInput,
  ): Promise<RegisterResultSubmitResult> {
    const now = new Date().toISOString();
    const manualNote = input.note?.trim() ?? '';
    const event = 'completed' as const;
    try {
      if (item.prospectId) {
        const prospect = loadProspects().items.find((value) => value.id === item.prospectId);
        if (!prospect) return { ok: false, message: 'No se encontró el prospecto.' };
        const result =
          input.result === 'noAnswer'
            ? 'noResponse'
            : input.result === 'notInterested' || input.result === 'invalidNumber'
              ? 'discarded'
              : input.result === 'interested'
                ? 'interested'
                : 'contacted';
        // SCRUM-117: keep the next step that was chosen instead of a generic "Retomar contacto".
        const nextAction =
          input.nextStep && input.nextStep !== 'none' && input.dueAt
            ? resultNextStepLabels[input.nextStep]
            : undefined;
        const channel =
          input.channel === 'whatsapp' || input.channel === 'email' || input.channel === 'instagram'
            ? input.channel
            : 'phone';
        const next = registerProspectAction(prospect, {
          result,
          channel,
          note: manualNote,
          author: input.actor,
          ...(input.nextStep !== 'none' && input.dueAt ? { followUpAt: input.dueAt } : {}),
          ...(nextAction ? { nextAction } : {}),
        });
        const workspaceId = workspaceContext.session?.activeWorkspaceId;
        if (isAuthConfigured() && !isWorkspaceUuid(workspaceId))
          return {
            ok: false,
            message:
              'No se pudo identificar el espacio de trabajo en Supabase. Volvé a iniciar sesión o seleccioná otro espacio.',
          };
        if (isAuthConfigured() && workspaceId) {
          const remote = await registerRemoteProspectResult({
            workspaceId,
            prospectId: prospect.id,
            expectedVersion: prospect.version ?? 1,
            result,
            channel,
            note: manualNote,
            followUpAt: next.nextActionAt || undefined,
            nextAction,
            responsible: input.actor,
            idempotencyKey: `prospect-result:${prospect.id}:${prospect.version ?? 1}:${result}:${channel}:${input.dueAt}`,
          });
          if (!remote.ok) return { ok: false, message: remote.message };
          next.version = remote.version;
        }
        if (!saveProspectWithResult(next).ok) {
          if (isAuthConfigured() && workspaceId) {
            saveProspectResultRecovery({ workspaceId, prospect: next });
            return {
              ok: false,
              recoveryRequired: true,
              message:
                'El resultado se guardó en Supabase, pero falta actualizar este equipo. Recuperá el guardado sin repetir la acción.',
            };
          }
          return { ok: false, message: 'No se pudo guardar el resultado localmente.' };
        }
        clearProspectResultRecovery();
        reloadProspects();
        return { ok: true };
      }
      if (item.cadenceStep) {
        const cadenceStep = item.cadenceStep;
        const execution = loadCadenceExecutions().items.find(
          (value) => value.id === cadenceStep.executionId,
        );
        if (!execution) return { ok: false };
        const updated = completeCadenceAction(execution, input.actor, input.result, now);
        const writes: (() => boolean)[] = [() => saveCadenceExecution(updated)];
        if (execution.target.kind === 'opportunity') {
          const targetOpportunityId = execution.target.opportunityId;
          const opportunity = loadOpportunities().items.find(
            (value) => value.id === targetOpportunityId,
          );
          const action = updated.stepExecutions.find(
            (step) => step.id === updated.currentStepExecutionId,
          )?.nextAction;
          if (opportunity)
            writes.push(() =>
              saveOpportunity({ ...opportunity, nextAction: action, updatedAt: now }),
            );
        }
        writes.push(() =>
          recordCadenceActivity(
            execution.target.kind === 'opportunity'
              ? { kind: 'opportunity', opportunityId: execution.target.opportunityId }
              : { kind: 'quote', quoteId: execution.target.quoteId },
            `${execution.id}:${item.action?.id ?? cadenceStep.stepExecutionId}:${event}`,
            `Cadencia actualizada desde la bandeja.`,
          ),
        );
        const saved = commitLocalFollowUpResult(
          [CADENCE_EXECUTIONS_STORAGE_KEY, OPPORTUNITIES_STORAGE_KEY, ACTIVITIES_STORAGE_KEY],
          writes,
        );
        if (!saved.ok) return saved;
        reloadOpportunities();
        return { ok: true };
      }
      if (!item.opportunityId) return { ok: false };
      const current = loadOpportunities().items.find((value) => value.id === item.opportunityId);
      if (!current) return { ok: false };
      const currentAction = current.nextAction;
      const contactActivity = buildOpportunityContactActivity({
        id: crypto.randomUUID(),
        occurredAt: now,
        author: input.actor,
        opportunityId: current.id,
        channel: input.channel,
        result: input.result,
        note: manualNote,
      });
      if (!currentAction) {
        if (!input.nextStep || input.nextStep === 'none' || !input.dueAt) {
          // Discarding needs no next step: only the contact is recorded.
          if (!isDiscardResult(input.result) || !contactActivity) return { ok: false };
          const saved = commitLocalFollowUpResult(
            [ACTIVITIES_STORAGE_KEY],
            [() => saveActivity(contactActivity)],
          );
          if (!saved.ok) return saved;
          reloadOpportunities();
          return { ok: true };
        }
        const nextAction = {
          id: crypto.randomUUID(),
          kind: input.nextStep === 'sendQuote' ? ('sendQuote' as const) : ('followUp' as const),
          type: input.nextStep === 'sendQuote' ? ('other' as const) : input.nextStep,
          description: input.nextStep === 'sendQuote' ? 'Enviar presupuesto' : 'Dar seguimiento',
          dueAt: input.dueAt,
          responsible: input.actor.trim(),
          priority: 'medium' as const,
          status: 'pending' as const,
          createdAt: now,
          updatedAt: now,
          history: [],
        };
        const saved = commitLocalFollowUpResult(
          [OPPORTUNITIES_STORAGE_KEY, ACTIVITIES_STORAGE_KEY],
          [
            () => saveOpportunity({ ...current, nextAction, updatedAt: now }),
            ...(contactActivity ? [() => saveActivity(contactActivity)] : []),
            () =>
              recordAutomaticActivity(
                { kind: 'opportunity', opportunityId: current.id },
                'nextActionChanged',
                describeScheduledNextStep(
                  nextAction,
                  dateFormatter.format(new Date(nextAction.dueAt)),
                  hasSingleResponsible(loadResponsibles()),
                ),
              ),
          ],
        );
        if (!saved.ok) return saved;
        reloadOpportunities();
        return { ok: true };
      }
      const next = transitionNextAction(
        current,
        event,
        input.actor,
        event === 'completed' ? 'Completada desde la bandeja.' : input.reason,
        now,
        {
          dueAt: undefined,
          result: input.result,
        },
      );
      const nextAction =
        event === 'completed' && input.nextStep && input.nextStep !== 'none' && input.dueAt
          ? {
              id: crypto.randomUUID(),
              kind: input.nextStep === 'sendQuote' ? ('sendQuote' as const) : ('followUp' as const),
              type: input.nextStep === 'sendQuote' ? ('other' as const) : input.nextStep,
              description:
                input.nextStep === 'sendQuote' ? 'Enviar presupuesto' : 'Dar seguimiento',
              dueAt: input.dueAt,
              responsible: input.actor.trim(),
              priority: currentAction.priority,
              suggestedChannel: currentAction.type,
              status: 'pending' as const,
              createdAt: now,
              updatedAt: now,
              history: [
                {
                  id: `${currentAction.id}:created:${now}`,
                  occurredAt: now,
                  actor: input.actor.trim(),
                  event: 'created' as const,
                  reason: input.reason.trim(),
                },
              ],
            }
          : next.nextAction;
      const persisted = { ...next, nextAction };
      if (!persisted.nextAction) return { ok: false };
      const scheduledAction = persisted.nextAction;
      const saved = commitLocalFollowUpResult(
        [OPPORTUNITIES_STORAGE_KEY, ACTIVITIES_STORAGE_KEY],
        [
          () => saveOpportunity(persisted),
          ...(contactActivity ? [() => saveActivity(contactActivity)] : []),
          () =>
            recordNextActionActivity(
              current.id,
              currentAction.id,
              event,
              `Completó: ${currentAction.description}. ${describeScheduledNextStep(scheduledAction, dateFormatter.format(new Date(scheduledAction.dueAt)), hasSingleResponsible(loadResponsibles()))}`,
            ),
        ],
      );
      if (!saved.ok) return saved;
      reloadOpportunities();
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof SupabaseRepositoryError
            ? error.message
            : 'No se pudo guardar el resultado. Revisá los datos e intentá nuevamente.',
      };
    }
  }

  function handleDraftSave(): boolean {
    const draft = getCurrentQuote();

    if (draft.status !== 'draft') return false;

    const isNewQuote = !savedQuotes.some((savedQuote) => savedQuote.id === draft.id);
    if (directClientInput && !draft.clientId) {
      const result = saveDirectClientQuote(draft, directClientInput, directFollowUp);
      if (!result.ok) {
        setSaveFeedback({ type: 'error', message: result.message });
        return false;
      }
      setClientId(result.client.id);
      setClientName(result.client.name);
      setOpportunityId(result.opportunity?.id);
      reloadOpportunities();
      setDirectClientInput(null);
      reloadSavedQuotes();
      setSaveFeedback({
        type: 'success',
        message: 'Cliente directo y borrador guardados correctamente.',
      });
      return true;
    }
    if (saveQuote(draft)) {
      const activitySaved =
        !isNewQuote ||
        recordAutomaticActivity(
          { kind: 'quote', quoteId: draft.id },
          'created',
          'Presupuesto creado.',
          currentResponsible(),
        );
      reloadSavedQuotes();
      setSaveFeedback({
        type: activitySaved ? 'success' : 'error',
        message: activitySaved
          ? draft.opportunityId
            ? 'Borrador guardado y vinculado a la oportunidad.'
            : 'Borrador guardado correctamente.'
          : 'Borrador guardado, pero no se pudo registrar la actividad de creación.',
      });
      return true;
    }

    setSaveFeedback({
      type: 'error',
      message: 'No se pudo guardar el borrador. Intentá nuevamente.',
    });
    return false;
  }

  function handleCommercialStatusChange(
    nextStatus: CommercialStatus,
    audit: Quote['commercialStatusAudit'],
  ): string | null {
    const quote = getCurrentQuote();
    try {
      const next = applyCommercialTransition(
        quote.commercialStatus,
        nextStatus,
        quote.status,
        audit,
        quote.sentAudit,
      );
      if (
        !saveFinalizedQuoteCommercialState(
          quote.id,
          next.commercialStatus,
          next.commercialStatusAudit,
          next.sentAudit,
        )
      ) {
        return 'No se pudo guardar el estado comercial. El documento no fue modificado.';
      }
      setCommercialStatus(next.commercialStatus);
      setCommercialStatusAudit(next.commercialStatusAudit);
      setSentAudit(next.sentAudit);
      reloadSavedQuotes();
      if (quote.opportunityId && ['sent', 'followingUp'].includes(nextStatus)) {
        const opportunity = loadOpportunities().items.find(
          (item) => item.id === quote.opportunityId,
        );
        if (opportunity && opportunity.pipelineStage !== 'proposal') {
          saveOpportunity({
            ...opportunity,
            pipelineStage: 'proposal',
            updatedAt: audit.changedAt,
          });
          reloadOpportunities();
        }
      }
      if (quote.opportunityId && ['accepted', 'rejected'].includes(nextStatus)) {
        const opportunity = loadOpportunities().items.find(
          (item) => item.id === quote.opportunityId,
        );
        if (opportunity) {
          const isAccepted = nextStatus === 'accepted';
          const closedOpportunity = (
            isAccepted ? closeOpportunityForAcceptedQuote : closeOpportunityForRejectedQuote
          )(opportunity, audit.changedBy, audit.changedAt);
          if (
            !saveOpportunity({
              ...closedOpportunity,
              pipelineStage: isAccepted ? 'won' : 'lost',
              commercialState: isAccepted ? 'won' : 'lost',
              status: 'closed',
              updatedAt: audit.changedAt,
            })
          )
            return `El presupuesto fue ${isAccepted ? 'aceptado' : 'rechazado'}, pero no se pudo cerrar la oportunidad.`;
          if (
            closedOpportunity.nextAction?.status === 'cancelled' &&
            !recordNextActionActivity(
              closedOpportunity.id,
              closedOpportunity.nextAction.id,
              'cancelled',
              `Próximo paso cancelado porque el presupuesto fue ${isAccepted ? 'aceptado' : 'rechazado'}.`,
              audit.changedBy,
            )
          )
            return `El presupuesto fue ${isAccepted ? 'aceptado' : 'rechazado'}, pero no se pudo registrar la cancelación del próximo paso.`;
          reloadOpportunities();
        }
      }
      if (['accepted', 'rejected', 'expired'].includes(nextStatus)) {
        const cadenceCancelled = cancelCadencesForCommercialClose(
          quote.id,
          undefined,
          audit.changedBy,
          `Presupuesto ${commercialStatusLabels[nextStatus].toLowerCase()}.`,
          audit.changedAt,
        );
        if (!cadenceCancelled)
          return 'El estado comercial se guardó, pero no se pudo cancelar la cadencia.';
      }
      if (
        !recordAutomaticActivity(
          { kind: 'quote', quoteId: quote.id },
          'commercialStatusChanged',
          `Estado comercial cambiado a ${commercialStatusLabels[nextStatus]}.${
            audit.reason?.trim() ? ` Motivo: ${audit.reason.trim()}` : ''
          }`,
          audit.changedBy,
        )
      ) {
        return 'El estado comercial se guardó, pero no se pudo registrar su actividad.';
      }
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'No se pudo registrar el estado comercial.';
    }
  }

  async function handleQuoteSend(
    input: QuoteSendInput,
    quote: SavedQuote | null = quoteSendTarget,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!quote) return { ok: false, error: 'No se encontró el presupuesto.' };
    if (quoteSendRecoveryRequired || hasQuoteSendRecovery(quote.id))
      return { ok: false, error: 'Este envío requiere recuperación. No repitas la confirmación.' };
    const recipient =
      input.channel === 'whatsapp'
        ? loadClients().items.find((item) => item.id === quote.clientId)?.phone
        : input.channel === 'email'
          ? loadClients().items.find((item) => item.id === quote.clientId)?.email
          : 'Registro comercial';
    const normalizedPhone = recipient?.replace(/\D/g, '') ?? '';
    const validEmail =
      typeof recipient === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient);
    if (input.channel === 'whatsapp' && !/^\d{7,15}$/.test(normalizedPhone))
      return { ok: false, error: 'El contacto no tiene un teléfono válido para WhatsApp.' };
    if (input.channel === 'email' && !validEmail)
      return { ok: false, error: 'El contacto no tiene un email válido.' };
    if (input.channel === 'other' && !input.note.trim())
      return { ok: false, error: 'Indicá una nota para registrar otro canal.' };
    // SCRUM-120: the form keeps minutes only; a send registered "now" keeps the real time so it
    // is not listed before the quote was created or finalized a few seconds earlier.
    const sentAtMs = Date.parse(input.sentAt);
    const sentAt =
      Number.isFinite(sentAtMs) && Math.abs(Date.now() - sentAtMs) < 120_000
        ? new Date().toISOString()
        : input.sentAt;
    const audit: Quote['commercialStatusAudit'] = {
      changedAt: sentAt,
      changedBy: input.responsible,
      reason:
        input.note ||
        `Envío registrado por ${input.channel === 'whatsapp' ? 'WhatsApp' : input.channel === 'email' ? 'email' : input.channel === 'meeting' ? 'reunión' : 'otro canal'}.`,
      ...(input.channel === 'whatsapp' || input.channel === 'email'
        ? {
            channel: input.channel,
            recipient: input.channel === 'whatsapp' ? normalizedPhone : recipient!,
          }
        : {}),
    };
    const workspaceId = workspaceContext.session?.activeWorkspaceId;
    if (isAuthConfigured() && !isWorkspaceUuid(workspaceId))
      return {
        ok: false,
        error:
          'No se pudo identificar el espacio de trabajo en Supabase. Volvé a iniciar sesión o seleccioná otro espacio.',
      };
    if (isAuthConfigured() && workspaceId) {
      try {
        const nextAction =
          input.nextStep !== 'none' && input.nextStepAt
            ? {
                type: input.nextStep,
                dueAt: input.nextStepAt,
                responsible: input.responsible,
              }
            : undefined;
        const remoteRecipient =
          input.channel === 'whatsapp'
            ? normalizedPhone
            : input.channel === 'email'
              ? recipient!
              : 'Registro comercial';
        const localClient = loadClients().items.find((item) => item.id === quote.clientId);
        if (!isWorkspaceUuid(quote.id) && !localClient)
          return {
            ok: false,
            error: 'No se encontró el contacto local para sincronizar este presupuesto.',
          };
        const remoteResult = isWorkspaceUuid(quote.id)
          ? await registerRemoteQuoteSend({
              workspaceId,
              quoteVersionId: quote.id,
              expectedVersion: quote.version ?? 1,
              channel: input.channel,
              recipient: remoteRecipient,
              sentAt,
              note: audit.reason,
              ...(nextAction ? { nextAction } : {}),
              nextActionDecision: input.replaceExistingNextAction ? 'replace' : 'preserve',
              idempotencyKey: `quote-send:${quote.id}`,
            })
          : await syncAndRegisterRemoteLocalQuoteSend({
              workspaceId,
              quote,
              client: localClient!,
              opportunity: quote.opportunityId
                ? loadOpportunities().items.find((item) => item.id === quote.opportunityId)
                : undefined,
              channel: input.channel,
              recipient: remoteRecipient,
              sentAt,
              note: audit.reason,
              ...(nextAction ? { nextAction } : {}),
              idempotencyKey: `quote-send:${quote.id}`,
            });
        if (!remoteResult.ok) return { ok: false, error: remoteResult.message };
      } catch (error) {
        if (!(error instanceof SupabaseRepositoryError) || error.code !== 'network')
          return {
            ok: false,
            error: error instanceof Error ? error.message : 'No se pudo confirmar el envío remoto.',
          };
      }
    }
    const saved = commitLocalQuoteSend({
      quote,
      audit,
      ...(input.nextStep !== 'none' && input.nextStepAt
        ? { nextStep: { type: input.nextStep, dueAt: input.nextStepAt } }
        : {}),
      replaceExistingNextAction: input.replaceExistingNextAction,
    });
    if (!saved.ok) {
      if (saved.recoveryRequired) setQuoteSendRecoveryRequired(true);
      return saved;
    }
    setCommercialStatus('sent');
    setCommercialStatusAudit(audit);
    setSentAudit(audit);
    reloadSavedQuotes();
    reloadOpportunities();
    setQuoteSendTarget(null);
    return { ok: true };
  }

  function handleQuoteChangeRequest(quote: SavedQuote, reason: string, responsible: string) {
    const opportunity = quote.opportunityId
      ? loadOpportunities().items.find((item) => item.id === quote.opportunityId)
      : undefined;
    if (!canCreateQuoteVersion(quote, opportunity)) return;
    const now = new Date().toISOString();
    const next: SavedQuote = {
      ...quote,
      id: createQuoteId(),
      commercialStatus: 'prepared',
      commercialStatusAudit: {
        changedAt: now,
        changedBy: responsible,
        reason: 'Nueva versión creada por pedido de cambio.',
      },
      sentAudit: undefined,
      version: (quote.version ?? 1) + 1,
      basedOnQuoteId: quote.id,
      changeRequest: { requestedAt: now, requestedBy: responsible, reason },
      savedAt: now,
    };
    if (!saveQuote(next)) return;
    recordAutomaticActivity(
      { kind: 'quote', quoteId: quote.id },
      'commercialStatusChanged',
      `Pedido de cambio registrado: ${reason}`,
      responsible,
    );
    reloadSavedQuotes();
    setDetailQuoteId(next.id);
  }

  function handleDirectQuoteConversion(quote: SavedQuote): string | null {
    const result = convertDirectQuoteToOpportunity(quote);
    if (!result.ok) return result.message;
    reloadOpportunities();
    reloadSavedQuotes();
    return null;
  }

  /** "Enviar" checks the quote like "Finalizar" before opening the send drawer. */
  function handleDraftSendRequest() {
    setSaveFeedback(null);
    setFinalizationFeedback(null);
    const quote = getCurrentQuote();
    const error = getQuoteCompletionError(quote);
    if (error) {
      setFinalizationFeedback({ type: 'error', message: error });
      return;
    }
    setDraftSendTarget({ ...quote, savedAt: new Date().toISOString() });
  }

  function handleFinalizationRequest() {
    setSaveFeedback(null);
    setFinalizationFeedback(null);

    try {
      finalizeQuote(getCurrentQuote());
      setIsFinalizationConfirmationOpen(true);
    } catch (error) {
      setFinalizationFeedback({
        type: 'error',
        message:
          error instanceof QuoteFinalizationError
            ? error.message
            : 'No se pudo validar el presupuesto. Intentá nuevamente.',
      });
    }
  }

  /**
   * Saves a finalized draft and records its "created" and "finalized" activities. Used by
   * "Finalizar presupuesto" and by "Enviar", which finalizes and registers the send at once.
   */
  function saveFinalizedDraft(
    finalizedQuote: Quote,
    isNewQuote: boolean,
  ): { ok: true; activitySaved: boolean } | { ok: false; message: string } {
    if (!saveQuote(finalizedQuote))
      return { ok: false, message: 'No se pudo finalizar el presupuesto. Intentá nuevamente.' };
    setQuoteStatus('finalized');
    reloadSavedQuotes();
    const creationActivitySaved =
      !isNewQuote ||
      recordAutomaticActivity(
        { kind: 'quote', quoteId: finalizedQuote.id },
        'created',
        'Presupuesto creado.',
        currentResponsible(),
      );
    const finalizationActivitySaved = recordAutomaticActivity(
      { kind: 'quote', quoteId: finalizedQuote.id },
      'finalized',
      'Presupuesto finalizado.',
      currentResponsible(),
    );
    return { ok: true, activitySaved: creationActivitySaved && finalizationActivitySaved };
  }

  /**
   * "Enviar" from a draft: one confirmation finalizes the quote and registers the send. If the
   * send cannot be registered, the quote stays finalized and the drawer says so, so the user can
   * register the send later from the quote.
   */
  async function handleDraftSend(input: QuoteSendInput): Promise<{ ok: boolean; error?: string }> {
    if (finalizationLockRef.current)
      return { ok: false, error: 'El presupuesto se está finalizando.' };
    let saved: SavedQuote | undefined;
    if (quoteStatus === 'draft') {
      finalizationLockRef.current = true;
      setIsFinalizing(true);
      try {
        const finalizedQuote = finalizeQuote(getCurrentQuote());
        const finalized = saveFinalizedDraft(
          finalizedQuote,
          !savedQuotes.some((savedQuote) => savedQuote.id === finalizedQuote.id),
        );
        if (!finalized.ok) return { ok: false, error: finalized.message };
        saved = loadSavedQuotes().find((item) => item.id === finalizedQuote.id);
      } catch (error) {
        return {
          ok: false,
          error:
            error instanceof QuoteFinalizationError
              ? error.message
              : 'No se pudo finalizar el presupuesto. Intentá nuevamente.',
        };
      } finally {
        finalizationLockRef.current = false;
        setIsFinalizing(false);
      }
    } else saved = loadSavedQuotes().find((item) => item.id === quoteId);
    if (!saved) return { ok: false, error: 'No se encontró el presupuesto finalizado.' };
    const result = await handleQuoteSend(input, saved);
    if (!result.ok)
      return {
        ok: false,
        error: `El presupuesto quedó finalizado, pero no se registró el envío: ${result.error ?? 'intentá nuevamente.'}`,
      };
    setDraftSendTarget(null);
    setFinalizationFeedback({
      type: 'success',
      message: 'Presupuesto finalizado y envío registrado.',
    });
    return { ok: true };
  }

  function handleFinalizationConfirm() {
    if (finalizationLockRef.current || quoteStatus !== 'draft') return;

    finalizationLockRef.current = true;
    setIsFinalizing(true);
    setFinalizationFeedback(null);

    try {
      const finalizedQuote = finalizeQuote(getCurrentQuote());
      const isNewQuote = !savedQuotes.some((savedQuote) => savedQuote.id === finalizedQuote.id);

      if (directClientInput && !finalizedQuote.clientId) {
        const result = saveDirectClientQuote(finalizedQuote, directClientInput, directFollowUp);
        if (!result.ok) {
          setIsFinalizationConfirmationOpen(false);
          setFinalizationFeedback({ type: 'error', message: result.message });
          return;
        }
        const persistedQuote = {
          ...finalizedQuote,
          clientId: result.client.id,
          clientName: result.client.name,
        };
        setClientId(result.client.id);
        setClientName(result.client.name);
        setOpportunityId(result.opportunity?.id);
        setDirectClientInput(null);
        setQuoteStatus('finalized');
        reloadSavedQuotes();
        const activitySaved = recordAutomaticActivity(
          { kind: 'quote', quoteId: persistedQuote.id },
          'finalized',
          'Presupuesto finalizado.',
          currentResponsible(),
        );
        setIsFinalizationConfirmationOpen(false);
        setFinalizationFeedback({
          type: activitySaved ? 'success' : 'error',
          message: activitySaved
            ? 'Cliente directo y presupuesto finalizado correctamente.'
            : 'El presupuesto se finalizó, pero no se pudo registrar la actividad.',
        });
        return;
      }

      const finalized = saveFinalizedDraft(finalizedQuote, isNewQuote);
      if (!finalized.ok) {
        setIsFinalizationConfirmationOpen(false);
        setFinalizationFeedback({ type: 'error', message: finalized.message });
        return;
      }
      const { activitySaved } = finalized;
      setIsFinalizationConfirmationOpen(false);
      setFinalizationFeedback({
        type: activitySaved ? 'success' : 'error',
        message: activitySaved
          ? 'Presupuesto finalizado correctamente.'
          : 'Presupuesto finalizado, pero no se pudo registrar la actividad.',
      });
    } catch (error) {
      setIsFinalizationConfirmationOpen(false);
      setFinalizationFeedback({
        type: 'error',
        message:
          error instanceof QuoteFinalizationError
            ? error.message
            : 'No se pudo finalizar el presupuesto. Intentá nuevamente.',
      });
    } finally {
      finalizationLockRef.current = false;
      setIsFinalizing(false);
    }
  }

  async function handlePdfDownload() {
    if (isDownloadingPdf) return;

    const quote = getCurrentQuote();

    setIsDownloadingPdf(true);
    setPdfFeedback(null);

    try {
      await downloadQuotePdf(quote);
      const activitySaved = recordAutomaticActivity(
        { kind: 'quote', quoteId: quote.id },
        'pdfGenerated',
        'PDF generado.',
        currentResponsible(),
      );
      setPdfFeedback({
        type: activitySaved ? 'success' : 'error',
        message: activitySaved
          ? 'El PDF se descargó correctamente.'
          : 'El PDF se descargó, pero no se pudo registrar la actividad.',
      });
    } catch (error) {
      setPdfFeedback({
        type: 'error',
        message:
          error instanceof QuotePdfValidationError
            ? error.message
            : 'No se pudo generar el PDF. Intentá nuevamente.',
      });
    } finally {
      setIsDownloadingPdf(false);
    }
  }

  async function handleQuoteDetailPdfDownload(savedQuote: SavedQuote): Promise<string | null> {
    try {
      await downloadQuotePdf(savedQuote);
      if (
        !recordAutomaticActivity(
          { kind: 'quote', quoteId: savedQuote.id },
          'pdfGenerated',
          'PDF generado desde el detalle comercial.',
          currentResponsible(),
        )
      )
        return 'El PDF se descargó, pero no se pudo registrar la actividad.';
      return null;
    } catch (error) {
      return error instanceof QuotePdfValidationError
        ? error.message
        : 'No se pudo generar el PDF. Intentá nuevamente.';
    }
  }

  const appHeaderBar = (
    <AppHeader
      activeSection={resolveActiveNavigationSection(currentView)}
      onNewQuote={handleNewQuote}
      onShowSavedQuotes={() => setCurrentView('savedQuotes')}
      onShowToday={() => setCurrentView('today')}
      onShowJobs={() => setCurrentView('jobs')}
      onShowClients={() => setCurrentView('clients')}
      onShowSettings={() => setCurrentView('settings')}
      searchQuery={searchQuery}
      searchResults={globalSearchResults}
      isSearchOpen={isSearchOpen}
      onSearchOpen={() => setIsSearchOpen(true)}
      onSearchQueryChange={setSearchQuery}
      onSearchSelect={handleGlobalSearchSelect}
      onSearchClose={() => {
        setIsSearchOpen(false);
        setSearchQuery('');
      }}
      hasUnsavedChanges={hasUnsavedWorkspaceChanges}
      onResetWorkspaceContext={resetWorkspaceContext}
      onLogout={() => void handleLogout()}
    />
  );
  // Rendered with the header so the question appears on every view (SCRUM-97).
  const appHeader = (
    <>
      {appHeaderBar}
      {logoutPending && (
        <div className="modal-backdrop">
          <section
            className="confirmation-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="logout-pending-title"
            aria-describedby="logout-pending-description"
          >
            <h2 id="logout-pending-title">Hay cambios sin guardar en Supabase</h2>
            <p id="logout-pending-description">
              Al cerrar sesión se borran los datos de este navegador. Si cerrás ahora, se pierde el
              último cambio que no llegó a guardarse. Revisá la conexión y volvé a intentar.
            </p>
            <div className="confirmation-actions">
              <button
                className="button button-line"
                type="button"
                autoFocus
                onClick={() => setLogoutPending(false)}
              >
                Cancelar
              </button>
              <button
                className="button button-primary"
                type="button"
                onClick={() => void handleLogout(true)}
              >
                Cerrar sesión igual
              </button>
            </div>
          </section>
        </div>
      )}
      {remoteSyncError && (
        <div className="remote-sync-error form-error" role="alert">
          <span>{remoteSyncError}</span>
          <button
            className="button button-link"
            type="button"
            onClick={() => setRemoteSyncError('')}
          >
            Cerrar
          </button>
        </div>
      )}
      {pendingQuoteRecovery && (
        <div className="quote-recovery-banner" role="status">
          <UiIcon name="document" />
          <div>
            <strong>Tenés un presupuesto sin guardar</strong>
            <span>
              {pendingQuoteRecovery.clientName || 'Sin cliente'} ·{' '}
              {pendingQuoteRecovery.lines.length}{' '}
              {pendingQuoteRecovery.lines.length === 1 ? 'servicio' : 'servicios'} ·{' '}
              {currencyFormatter.format(
                calculateQuoteTotal(pendingQuoteRecovery.lines, pendingQuoteRecovery.discount),
              )}{' '}
              · quedó abierto el {dateFormatter.format(new Date(pendingQuoteRecovery.savedAt))}
            </span>
          </div>
          <button className="button button-primary" type="button" onClick={recoverPendingQuote}>
            Recuperar
          </button>
          <button className="button button-line" type="button" onClick={discardPendingQuote}>
            Descartar
          </button>
        </div>
      )}
      {pendingQuoteReplacement && (
        <UnsavedQuoteDialog
          saveError={quoteReplacementError}
          onSave={saveDraftAndReplaceQuote}
          onDiscard={runQuoteReplacement}
          onCancel={() => {
            setPendingQuoteReplacement(null);
            setQuoteReplacementError('');
          }}
        />
      )}
    </>
  );

  if (workspaceContext.isLoading) {
    return (
      <>
        {appHeader}
        <main className="workspace-access-state">
          <div className="workspace-access-card">
            <UiIcon name="clock" />
            <p>Cargando espacios de trabajo...</p>
          </div>
        </main>
      </>
    );
  }

  if (workspaceContext.accessError || !workspaceContext.activeMembership) {
    if (workspaceContext.accessError === 'session-expired') {
      return <LoginView onAuthenticated={workspaceContext.retry} />;
    }
    return (
      <>
        {appHeader}
        <WorkspaceAccessState
          error={workspaceContext.accessError ?? 'no-workspaces'}
          onRetry={workspaceContext.retry}
        />
      </>
    );
  }
  if (currentView === 'settings') {
    return (
      <>
        {appHeader}
        <SettingsView
          membership={workspaceContext.activeMembership}
          onRetryConnection={workspaceContext.retry}
          onShowServices={() => setCurrentView('catalog')}
        />
      </>
    );
  }
  function recoverProspectResult(item: FollowUpInboxItem): RegisterResultSubmitResult {
    const recovery = loadProspectResultRecovery();
    const workspaceId = workspaceContext.session?.activeWorkspaceId;
    if (
      !recovery ||
      recovery.prospect.id !== item.prospectId ||
      recovery.workspaceId !== workspaceId
    )
      return {
        ok: false,
        recoveryRequired: true,
        message: 'No hay una recuperación disponible para este prospecto.',
      };
    if (!saveProspectWithResult(recovery.prospect))
      return {
        ok: false,
        recoveryRequired: true,
        message: 'No se pudo recuperar el espejo local. Intentá nuevamente.',
      };
    clearProspectResultRecovery();
    reloadProspects();
    return { ok: true };
  }

  const followUpInbox = loadFollowUpInbox(savedQuotes, prospects);
  const followUpItems = followUpInbox.items;
  const resultDrawer = drawerItem && (
    <RegisterResultDrawer
      item={drawerItem}
      onClose={() => setDrawerItem(null)}
      onSubmit={(input) =>
        handleFollowUpAction(drawerItem, {
          actor: input.actor,
          reason: input.reason,
          note: input.note,
          result: input.result,
          dueAt: input.dueAt,
          channel: input.channel,
          nextStep: input.nextStep,
          quoteMode: input.quoteMode,
        })
      }
      onQuoteIntent={handleDashboardQuoteIntent}
      onRecover={drawerItem.prospectId ? () => recoverProspectResult(drawerItem) : undefined}
    />
  );

  if (currentView === 'today') {
    return (
      <>
        {appHeader}
        <TodayView
          items={followUpItems}
          issues={followUpInbox.issues}
          onOpen={setDrawerItem}
          onOpenContext={handleFollowUpOpen}
          onShowMetrics={() => setCurrentView('metrics')}
          onShowCadences={() => setCurrentView('cadences')}
        />
        {resultDrawer}
      </>
    );
  }

  if (currentView === 'clients') {
    const clients = loadClients().items;
    return (
      <>
        {appHeader}
        <ClientsView
          rows={buildClientList(
            clients,
            buildJobList({ prospects, opportunities, clients, quotes: savedQuotes }),
          )}
          onOpenJob={openJob}
        />
      </>
    );
  }

  if (currentView === 'jobs') {
    return (
      <>
        {appHeader}
        <JobsView
          rows={buildJobList({
            prospects,
            opportunities,
            clients: loadClients().items,
            quotes: savedQuotes,
          })}
          onOpen={openJob}
          onNewProspect={() => {
            setCurrentView('prospects');
            setOpenNewProspect(true);
          }}
          onShowProspects={() => {
            setCurrentView('prospects');
            setProspectsResetToken((value) => value + 1);
          }}
        />
      </>
    );
  }

  if (currentView === 'prospects') {
    return (
      <>
        {appHeader}
        <ProspectingView
          resetToken={prospectsResetToken}
          openNewProspect={openNewProspect}
          onOpenNewProspectHandled={() => setOpenNewProspect(false)}
          initialFilters={prospectFilters}
          onFiltersChange={(filters) => {
            setProspectFilters(filters);
            try {
              localStorage.setItem(
                workspaceStorageKey(PROSPECT_FILTERS_STORAGE_KEY),
                JSON.stringify(filters),
              );
            } catch {
              // Filter persistence is a convenience; navigation remains usable when storage is unavailable.
            }
          }}
          onOpenOpportunity={openOpportunityDetail}
          onOpenResult={setDrawerItem}
          openProspectId={requestedProspectId}
          onProspectConverted={showConvertedJob}
          openProspectBack={
            requestedProspectId
              ? {
                  label: opportunityOriginLabels[opportunityOrigin],
                  onBack: () => {
                    setRequestedProspectId(null);
                    setCurrentView(opportunityOrigin);
                  },
                }
              : undefined
          }
          onOpenProspectHandled={() => setRequestedProspectId(null)}
          onProspectsChanged={setProspects}
          onOpportunitiesChanged={() => reloadOpportunities()}
          onDirtyChange={setProspectHasUnsavedChanges}
        />
        {resultDrawer}
      </>
    );
  }

  if (currentView === 'catalog') {
    return (
      <>
        {appHeader}
        <LaborCatalogView
          jobs={catalogJobs}
          loadIssue={catalogLoadIssue}
          onBack={() => setCurrentView('settings')}
          onCreate={handleCatalogCreate}
          onUpdate={handleCatalogUpdate}
          onSetActive={handleCatalogActivation}
        />
      </>
    );
  }

  if (currentView === 'cadences') {
    return (
      <>
        {appHeader}
        <CadenceView onBack={() => setCurrentView('today')} />
      </>
    );
  }

  if (currentView === 'opportunityDetail') {
    const opportunity = opportunities.find((item) => item.id === detailOpportunityId);
    return (
      <>
        {opportunity ? (
          <>
            {appHeader}
            <OpportunityDetailView
              opportunity={opportunity}
              client={loadClients().items.find((item) => item.id === opportunity.clientId)}
              quotes={savedQuotes}
              backLabel={opportunityOriginLabels[opportunityOrigin]}
              onBack={() => {
                setConvertedJobNotice(null);
                setCurrentView(opportunityOrigin);
              }}
              notice={convertedJobNotice}
              onSaveOpportunity={saveOpportunityFromDetail}
              onUpdateClient={(input, extras) => {
                const client = loadClients().items.find((item) => item.id === opportunity.clientId);
                return client
                  ? updateOpportunityClient(client, input, extras)
                  : 'No se encontró el contacto de esta oportunidad.';
              }}
              onRegisterResult={() => {
                const item = followUpItems.find(
                  (candidate) => candidate.opportunityId === opportunity.id && candidate.action,
                );
                if (item) {
                  setDrawerItem(item);
                  return;
                }
                const client = loadClients().items.find(
                  (value) => value.id === opportunity.clientId,
                );
                setDrawerItem({
                  id: `first-action:${opportunity.id}`,
                  subjectType: 'opportunity',
                  bucket: 'missing',
                  source: 'missing',
                  clientId: client?.id,
                  clientName: client?.name ?? 'Cliente no disponible',
                  clientCompany: client?.company,
                  opportunityId: opportunity.id,
                  opportunityName: opportunity.name,
                  responsible: opportunity.responsibleSeller || 'Sin asignar',
                  contactRestricted: !!client?.doNotContact,
                  rescheduleCount: 0,
                  priority: { score: 0, level: 'medium', reasons: ['Sin próxima acción'] },
                });
              }}
              onCreateQuote={() => handleNewOpportunityQuote(opportunity)}
              onContinueQuote={handleSavedQuoteOpen}
              onOpenQuote={handleQuoteDetailOpen}
              onCreateQuoteVersion={handleCreateQuoteVersion}
              activities={loadActivities().items}
            />
            {inboxContact && (
              <ContactAssistant
                context={{
                  client: loadClients().items.find((item) => item.id === opportunity.clientId),
                  opportunity,
                }}
                subject={{ kind: 'opportunity', opportunityId: opportunity.id }}
                initialChannel={inboxContact.channel as 'call' | 'whatsapp'}
                restrictedChannel={inboxContact.channel as 'call' | 'whatsapp'}
                onClose={() => setInboxContact(null)}
                onRecorded={() => {
                  setInboxContact(null);
                  reloadOpportunities();
                }}
              />
            )}
            {resultDrawer}
          </>
        ) : (
          <main className="app-shell">
            <p className="commercial-warning" role="alert">
              No encontramos esta oportunidad en este navegador. Si se creó en otro navegador o
              dispositivo, revisala desde Trabajos en el equipo donde se creó.
            </p>
            <button
              className="button button-line"
              type="button"
              onClick={() => setCurrentView(opportunityOrigin)}
            >
              {opportunityOriginLabels[opportunityOrigin]}
            </button>
          </main>
        )}
      </>
    );
  }

  if (currentView === 'quoteDetail') {
    const quote = savedQuotes.find((item) => item.id === detailQuoteId);
    const quoteVersions = collectQuoteVersions(savedQuotes, detailQuoteId);
    const opportunity = opportunities.find(
      (item) => item.id === quote?.opportunityId && item.clientId === quote?.clientId,
    );
    if (!quote) {
      return (
        <main className="app-shell">
          <p className="commercial-warning" role="alert">
            No se encontró el presupuesto solicitado.
          </p>
          <button
            className="button button-line"
            type="button"
            onClick={() => setCurrentView('savedQuotes')}
          >
            Volver a presupuestos
          </button>
        </main>
      );
    }
    return (
      <>
        {appHeader}
        <QuoteDetailView
          quote={quote}
          versions={quoteVersions}
          opportunity={opportunity}
          client={loadClients().items.find((item) => item.id === quote.clientId)}
          onBack={() => {
            if (opportunity) {
              setConvertedJobNotice(null);
              setDetailOpportunityId(opportunity.id);
              setCurrentView('opportunityDetail');
            } else setCurrentView('savedQuotes');
          }}
          onPdf={handleQuoteDetailPdfDownload}
          onStatus={(_quote, status, audit) => handleCommercialStatusChange(status, audit)}
          onContinueEditing={handleSavedQuoteReview}
          onRegisterSend={setQuoteSendTarget}
          onRequestChange={handleQuoteChangeRequest}
          onConvertDirect={handleDirectQuoteConversion}
        />
        {quoteSendTarget && (
          <RegisterQuoteSendDrawer
            quote={quoteSendTarget}
            onClose={() => setQuoteSendTarget(null)}
            onSubmit={handleQuoteSend}
            existingNextAction={
              opportunity?.nextAction?.status === 'pending' ? opportunity.nextAction : undefined
            }
            canSendWhatsApp={Boolean(
              quoteSendTarget &&
              /^\d{7,15}$/.test(
                (
                  loadClients().items.find((item) => item.id === quoteSendTarget.clientId)?.phone ??
                  ''
                ).replace(/\D/g, ''),
              ),
            )}
            canSendEmail={Boolean(
              quoteSendTarget &&
              /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                loadClients().items.find((item) => item.id === quoteSendTarget.clientId)?.email ??
                  '',
              ),
            )}
          />
        )}
      </>
    );
  }

  if (currentView === 'metrics') {
    const clientLoad = loadClients();
    const opportunityLoad = loadOpportunities();
    const activityLoad = loadActivities();
    const executionLoad = loadCadenceExecutions();
    const outcomeLoad = loadCommercialOutcomes();
    return (
      <>
        <>{appHeader}</>
        <MetricsDashboard
          sources={{
            clients: clientLoad.items,
            opportunities: opportunityLoad.items,
            quotes: savedQuotes,
            activities: activityLoad.items,
            executions: executionLoad.items,
            outcomes: outcomeLoad.items,
            prospects,
            issues: [
              clientLoad.issue,
              opportunityLoad.issue,
              activityLoad.issue,
              executionLoad.issue,
              outcomeLoad.issue,
            ],
          }}
        />
      </>
    );
  }

  if (currentView === 'savedQuotes') {
    return (
      <>
        {appHeader}
        <SavedQuotesView
          quotes={savedQuotes}
          visibleQuotes={visibleSavedQuotes}
          opportunities={opportunities}
          documentFilter={savedQuoteFilter}
          onDocumentFilterChange={setSavedQuoteFilter}
          commercialFilter={savedQuoteCommercialFilter}
          onCommercialFilterChange={setSavedQuoteCommercialFilter}
          storedInWorkspace={isAuthConfigured()}
          downloadingQuoteId={downloadingSavedQuoteId}
          pdfFeedback={savedQuotePdfFeedback}
          onOpen={handleSavedQuoteOpen}
          onDownloadPdf={(quote) => void downloadSavedQuotePdf(quote)}
          onNewQuote={handleNewQuote}
          onBackToCurrent={() => setCurrentView(quoteStatus === 'draft' ? 'editor' : 'summary')}
        />
      </>
    );
  }

  if (currentView === 'summary') {
    return (
      <>
        {appHeader}
        <QuoteSummaryView
          quoteId={quoteId}
          status={quoteStatus}
          clientName={clientName}
          onClientNameChange={setClientName}
          projectName={projectName}
          onProjectNameChange={setProjectName}
          lines={quoteLines}
          totals={quoteTotals}
          saveFeedback={saveFeedback}
          finalizationFeedback={finalizationFeedback}
          pdfFeedback={pdfFeedback}
          isDownloadingPdf={isDownloadingPdf}
          isFinalizing={isFinalizing}
          isDocumentDataOpen={isOptionalDataOpen}
          onToggleDocumentData={() => setIsOptionalDataOpen((isOpen) => !isOpen)}
          isConfirmationOpen={isFinalizationConfirmationOpen}
          finalizationTriggerRef={finalizationTriggerRef}
          finalizationCancelRef={finalizationCancelRef}
          finalizationConfirmRef={finalizationConfirmRef}
          onEdit={() => setCurrentView('editor')}
          onSaveDraft={handleDraftSave}
          onDownloadPdf={handlePdfDownload}
          onRequestFinalization={handleFinalizationRequest}
          onCancelFinalization={() => setIsFinalizationConfirmationOpen(false)}
          onConfirmFinalization={handleFinalizationConfirm}
          onRegisterSend={() => {
            const saved = savedQuotes.find((quote) => quote.id === quoteId);
            if (saved) handleQuoteDetailOpen(saved);
          }}
          onShowSavedQuotes={() => setCurrentView('savedQuotes')}
          onSend={
            // A quote for a client can be sent in one step; a direct client is created on
            // finalizing, so that quote is finalized first.
            canSendDraftInOneStep({
              status: quoteStatus,
              clientId,
              lineCount: quoteLines.length,
              hasPendingDirectClient: Boolean(directClientInput),
            })
              ? handleDraftSendRequest
              : undefined
          }
        />
        {draftSendTarget && (
          <RegisterQuoteSendDrawer
            quote={draftSendTarget}
            finalizesDraft
            onClose={() => setDraftSendTarget(null)}
            onSubmit={handleDraftSend}
            existingNextAction={
              associatedOpportunity?.nextAction?.status === 'pending'
                ? associatedOpportunity.nextAction
                : undefined
            }
            canSendWhatsApp={/^\d{7,15}$/.test(
              (
                loadClients().items.find((item) => item.id === draftSendTarget.clientId)?.phone ??
                ''
              ).replace(/\D/g, ''),
            )}
            canSendEmail={/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
              loadClients().items.find((item) => item.id === draftSendTarget.clientId)?.email ?? '',
            )}
          />
        )}
      </>
    );
  }

  return (
    <>
      {appHeader}
      <main className="app-shell quote-editor-shell">
        <header className="page-header quote-editor-header">
          <div>
            <p className="eyebrow">VENTRO · PRESUPUESTOS</p>
            <h1>
              {isContextualOpportunityQuote
                ? `Presupuesto para ${associatedOpportunity!.name}`
                : 'Crear presupuesto'}
            </h1>
            <p className="page-description">
              Agregá los servicios, ajustá cantidades y precios, y revisá el total antes de
              continuar.
            </p>
          </div>
          <div className="page-context">
            <div
              className="header-total"
              aria-label={`Total actual: ${currencyFormatter.format(quoteTotals.total)}`}
            >
              <span>Total actual</span>
              <strong>{currencyFormatter.format(quoteTotals.total)}</strong>
            </div>
          </div>
        </header>

        <QuoteLinkingSection
          opportunity={isContextualOpportunityQuote ? associatedOpportunity : undefined}
          client={isContextualOpportunityQuote ? associatedClient : undefined}
          onChangeOpportunity={() => {
            setClientId(undefined);
            setOpportunityId(undefined);
            setShouldRefreshDocumentSnapshots(true);
            setIsLinkingOpen(true);
          }}
          isLinkingOpen={isLinkingOpen}
          onToggleLinking={() => setIsLinkingOpen((isOpen) => !isOpen)}
          clients={loadClients().items}
          opportunities={opportunities}
          onSelectOpportunity={(opportunity) => {
            const client = loadClients().items.find((item) => item.id === opportunity.clientId);
            if (client) handleAssociation(client, opportunity);
          }}
          onDirectChange={(input, followUp) => {
            setDirectClientInput(input);
            setDirectFollowUp(followUp);
            if (!input) return;
            setClientId(undefined);
            setOpportunityId(undefined);
            setClientName(input.name.trim() || input.company.trim());
            setProjectName(input.projectName.trim());
            setSaveFeedback(null);
          }}
        />

        <ServiceEntryCard
          mode={serviceEntryMode}
          onModeChange={handleServiceEntryModeChange}
          catalog={{
            search: catalogSearch,
            onSearchChange: handleCatalogSearchChange,
            onSearchFocus: () => setIsCatalogMenuOpen(true),
            isMenuOpen: isCatalogMenuOpen,
            jobs: visibleActiveCatalogJobs,
            onSelect: handleCatalogServiceSelection,
            selectedJob: selectedVisibleJob,
            quantity: catalogQuantity,
            onQuantityChange: setCatalogQuantity,
            unitPrice: catalogUnitPrice,
            onUnitPriceChange: setCatalogUnitPrice,
            error: catalogError,
            onSubmit: handleCatalogSubmit,
          }}
          manual={{
            name: manualName,
            onNameChange: setManualName,
            description: manualDescription,
            onDescriptionChange: setManualDescription,
            unit: manualUnit,
            onUnitChange: setManualUnit,
            quantity: manualQuantity,
            onQuantityChange: setManualQuantity,
            unitPrice: manualUnitPrice,
            onUnitPriceChange: setManualUnitPrice,
            saveToCatalog: saveManualToCatalog,
            onSaveToCatalogChange: setSaveManualToCatalog,
            validation: manualValidation,
            error: manualError,
            onSubmit: handleManualSubmit,
          }}
        />

        <QuoteLinesEditor
          lines={quoteLines}
          totals={quoteTotals}
          discountField={
            <QuoteDiscountField
              key={quoteId}
              discount={quoteDiscount}
              onChange={setQuoteDiscount}
              error={quoteDiscountError}
            />
          }
          editing={
            editingLineId
              ? {
                  lineId: editingLineId,
                  quantity: editQuantity,
                  onQuantityChange: setEditQuantity,
                  unitPrice: editUnitPrice,
                  onUnitPriceChange: setEditUnitPrice,
                  error: editError,
                  onSave: handleEditSave,
                  onCancel: handleEditCancel,
                }
              : null
          }
          onEditStart={handleEditStart}
          onDelete={handleLineDelete}
          onContinue={() => setCurrentView('summary')}
        />
      </main>
    </>
  );
}

export default App;
