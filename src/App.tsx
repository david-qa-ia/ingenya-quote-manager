import { useEffect, useRef, useState, type FormEvent } from 'react';
import './App.css';
import { QuoteCommercialContext } from './components/QuoteCommercialContext';
import { QuoteCommercialStatus } from './components/QuoteCommercialStatus';
import { QuoteActivityPanel } from './components/QuoteActivityPanel';
import { QuoteSidebar } from './components/QuoteSidebar';
import { ContactAssistant } from './components/ContactAssistant';
import type { Client } from './types/client';
import type { FollowUpInboxItem } from './types/followUpInbox';
import type { Opportunity } from './types/opportunity';
import { loadClients } from './utils/clientStorage';
import { associateQuote } from './utils/quoteAssociations';
import { loadOpportunities } from './utils/opportunityStorage';
import { saveOpportunity } from './utils/opportunityStorage';
import { AppHeader } from './components/AppHeader';
import { LaborCatalogView } from './components/LaborCatalogView';
import { workUnitLabels, workUnitSymbols } from './data/workUnits';
import type {
  CatalogJob,
  CommercialStatus,
  Quote,
  QuoteLine,
  QuoteStatus,
  SavedQuote,
  WorkUnit,
} from './types/quote';
import { calculateLineSubtotal, calculateQuoteTotal } from './utils/quoteCalculations';
import {
  loadSavedQuotes,
  saveFinalizedQuoteCommercialState,
  saveQuote,
} from './utils/quoteDraftStorage';
import { finalizeQuote, QuoteFinalizationError } from './utils/quoteFinalization';
import { currencyFormatter } from './utils/quoteFormatting';
import { downloadQuotePdf } from './utils/quotePdf';
import { QuotePdfValidationError } from './utils/quotePdfModel';
import {
  filterSavedQuotes,
  filterSavedQuotesByCommercialStatus,
  type SavedQuoteCommercialFilter,
  type SavedQuoteFilter,
} from './utils/savedQuoteFilters';
import {
  applyCommercialTransition,
  commercialStatusLabels,
  createPreparedCommercialAudit,
} from './utils/quoteCommercialStatus';
import {
  addCatalogJob,
  loadLaborCatalog,
  saveLaborCatalog,
  setCatalogJobActive,
  updateCatalogJob,
} from './utils/jobCatalogStorage';
import { createCatalogQuoteLine } from './utils/quoteLineFactory';
import { addQuickService } from './utils/quickServiceAddition';
import { resolveActiveNavigationSection, type AppView } from './utils/appNavigation';
import {
  loadActivities,
  recordAutomaticActivity,
  recordCadenceActivity,
  recordNextActionActivity,
} from './utils/activityStorage';
import {
  OpportunityNextActionsInbox,
  type InboxActionEvent,
  type InboxActionInput,
} from './components/OpportunityNextActionsInbox';
import { CadenceView } from './components/CadenceView';
import {
  cancelCadencesForCommercialClose,
  loadCadenceExecutions,
  saveCadenceExecution,
} from './utils/cadenceStorage';
import { transitionNextAction } from './utils/opportunityNextAction';
import { completeCadenceAction, updateCadenceAction } from './utils/cadenceTransitions';

const availableWorkUnits = Object.keys(workUnitLabels) as WorkUnit[];
const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function createLineId(): string {
  return crypto.randomUUID();
}

function createQuoteId(): string {
  return `PRES-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function App() {
  const [initialCatalogLoad] = useState(loadLaborCatalog);
  const [catalogJobs, setCatalogJobs] = useState<CatalogJob[]>(initialCatalogLoad.jobs);
  const [catalogLoadIssue, setCatalogLoadIssue] = useState(initialCatalogLoad.issue);
  const [quoteId, setQuoteId] = useState(createQuoteId);
  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus>('draft');
  const [commercialStatus, setCommercialStatus] = useState<CommercialStatus>('prepared');
  const [commercialStatusAudit, setCommercialStatusAudit] = useState(() =>
    createPreparedCommercialAudit(new Date().toISOString()),
  );
  const [sentAudit, setSentAudit] = useState<Quote['sentAudit']>();
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([]);
  const [savedQuotes, setSavedQuotes] = useState(loadSavedQuotes);
  const [savedQuoteFilter, setSavedQuoteFilter] = useState<SavedQuoteFilter>('all');
  const [savedQuoteCommercialFilter, setSavedQuoteCommercialFilter] =
    useState<SavedQuoteCommercialFilter>('all');
  const [downloadingSavedQuoteId, setDownloadingSavedQuoteId] = useState<string | null>(null);
  const [savedQuotePdfFeedback, setSavedQuotePdfFeedback] = useState<{
    quoteId: string;
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('editor');
  const [inboxContact, setInboxContact] = useState<FollowUpInboxItem | null>(null);
  const [clientId, setClientId] = useState<string | undefined>();
  const [opportunityId, setOpportunityId] = useState<string | undefined>();
  const [opportunities, setOpportunities] = useState(() => loadOpportunities().items);
  const [clientName, setClientName] = useState('');
  const [projectName, setProjectName] = useState('');
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
  const [selectedJobId, setSelectedJobId] = useState(
    initialCatalogLoad.jobs.find((job) => job.isActive)?.id ?? '',
  );
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogQuantity, setCatalogQuantity] = useState('1');
  const [catalogUnitPrice, setCatalogUnitPrice] = useState(
    String(initialCatalogLoad.jobs.find((job) => job.isActive)?.defaultPrice ?? ''),
  );
  const [manualName, setManualName] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualUnit, setManualUnit] = useState<WorkUnit>('squareMeter');
  const [manualQuantity, setManualQuantity] = useState('1');
  const [manualUnitPrice, setManualUnitPrice] = useState('');
  const [saveManualToCatalog, setSaveManualToCatalog] = useState(false);
  const [isOptionalDataOpen, setIsOptionalDataOpen] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [manualError, setManualError] = useState('');
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editUnitPrice, setEditUnitPrice] = useState('');
  const [editError, setEditError] = useState('');

  const activeCatalogJobs = catalogJobs.filter((job) => job.isActive);
  const visibleActiveCatalogJobs = activeCatalogJobs.filter((job) =>
    `${job.name} ${job.description ?? ''}`
      .toLocaleLowerCase('es')
      .includes(catalogSearch.trim().toLocaleLowerCase('es')),
  );
  const selectedJob = activeCatalogJobs.find((job) => job.id === selectedJobId);
  const selectedVisibleJob = visibleActiveCatalogJobs.find((job) => job.id === selectedJobId);
  const quoteTotal = calculateQuoteTotal(quoteLines);
  const visibleSavedQuotes = filterSavedQuotesByCommercialStatus(
    filterSavedQuotes(savedQuotes, savedQuoteFilter),
    savedQuoteCommercialFilter,
  );
  const currentOpportunity = opportunities.find(
    (opportunity) => opportunity.id === opportunityId && opportunity.clientId === clientId,
  );

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
    };
  }

  function handleAssociation(client: Client | undefined, opportunity: Opportunity | undefined) {
    if (quoteStatus !== 'draft') return;
    const next = associateQuote(
      getCurrentQuote(),
      client,
      opportunity,
      savedQuotes.some((quote) => quote.id === quoteId),
    );
    setClientId(next.clientId);
    setOpportunityId(next.opportunityId);
    setClientName(next.clientName);
    setProjectName(next.projectName);
    setSaveFeedback(null);
  }

  function handleCatalogJobChange(jobId: string) {
    const nextJob = activeCatalogJobs.find((job) => job.id === jobId);

    if (!nextJob) return;

    setSelectedJobId(nextJob.id);
    setCatalogUnitPrice(String(nextJob.defaultPrice));
    setCatalogError('');
  }

  function handleCatalogSearchChange(value: string) {
    setCatalogSearch(value);
    const normalized = value.trim().toLocaleLowerCase('es');
    const firstMatch = activeCatalogJobs.find((job) =>
      `${job.name} ${job.description ?? ''}`.toLocaleLowerCase('es').includes(normalized),
    );
    if (
      firstMatch &&
      !`${selectedJob?.name ?? ''} ${selectedJob?.description ?? ''}`
        .toLocaleLowerCase('es')
        .includes(normalized)
    ) {
      handleCatalogJobChange(firstMatch.id);
    }
  }

  function handleCatalogSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedVisibleJob) {
      setCatalogError('Seleccioná un servicio activo del catálogo.');
      return;
    }
    const quantity = Number(catalogQuantity);
    const unitPrice = Number(catalogUnitPrice);

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
    setCatalogUnitPrice(String(selectedVisibleJob.defaultPrice));
    setCatalogError('');
  }

  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = manualName.trim();
    const quantity = Number(manualQuantity);
    const unitPrice = Number(manualUnitPrice);

    if (!name) {
      setManualError('Ingresá el nombre del servicio.');
      return;
    }

    if (
      !Number.isFinite(quantity) ||
      !Number.isFinite(unitPrice) ||
      manualUnitPrice.trim() === '' ||
      quantity <= 0 ||
      unitPrice < 0
    ) {
      setManualError('Ingresá una cantidad mayor a cero y un precio no negativo.');
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
      (jobs) => catalogLoadIssue !== 'invalid-root' && saveLaborCatalog(jobs),
      createLineId,
    );
    if (!addition.success) {
      setManualError(addition.message);
      return;
    }
    if (addition.catalogJobs) {
      setCatalogJobs(addition.catalogJobs);
      setCatalogLoadIssue(null);
    }
    setQuoteLines((currentLines) => [...currentLines, addition.line]);
    setManualName('');
    setManualDescription('');
    setManualUnit('squareMeter');
    setManualQuantity('1');
    setManualUnitPrice('');
    setSaveManualToCatalog(false);
    setManualError('');
  }

  function persistCatalog(nextJobs: CatalogJob[]): string | null {
    if (catalogLoadIssue === 'invalid-root') {
      return 'No se guardaron cambios para preservar el catálogo corrupto para diagnóstico.';
    }
    if (!saveLaborCatalog(nextJobs)) return 'No se pudo guardar el catálogo. Intentá nuevamente.';
    setCatalogJobs(nextJobs);
    setCatalogLoadIssue(null);
    const nextSelectedJob =
      nextJobs.find((job) => job.id === selectedJobId && job.isActive) ??
      nextJobs.find((job) => job.isActive);
    setSelectedJobId(nextSelectedJob?.id ?? '');
    setCatalogUnitPrice(nextSelectedJob ? String(nextSelectedJob.defaultPrice) : '');
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
    setEditQuantity(String(line.quantity));
    setEditUnitPrice(String(line.unitPrice));
    setEditError('');
  }

  function handleEditCancel() {
    setEditingLineId(null);
    setEditQuantity('');
    setEditUnitPrice('');
    setEditError('');
  }

  function handleEditSave(lineId: string) {
    const quantity = Number(editQuantity);
    const unitPrice = Number(editUnitPrice);

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
    setQuoteId(createQuoteId());
    setQuoteStatus('draft');
    setCommercialStatus('prepared');
    setCommercialStatusAudit(createPreparedCommercialAudit(new Date().toISOString()));
    setSentAudit(undefined);
    setQuoteLines([]);
    setClientName('');
    setProjectName('');
    setClientId(undefined);
    setOpportunityId(undefined);
    resetTransientState();
    setCurrentView('editor');
  }

  function handleSavedQuoteOpen(savedQuote: SavedQuote) {
    setQuoteId(savedQuote.id);
    setQuoteStatus(savedQuote.status);
    setCommercialStatus(savedQuote.commercialStatus);
    setCommercialStatusAudit(savedQuote.commercialStatusAudit);
    setSentAudit(savedQuote.sentAudit);
    setQuoteLines(savedQuote.lines);
    setClientId(savedQuote.clientId);
    setOpportunityId(savedQuote.opportunityId);
    setClientName(savedQuote.clientName);
    setProjectName(savedQuote.projectName);
    resetTransientState();
    setCurrentView(savedQuote.status === 'draft' ? 'editor' : 'summary');
  }

  function handleFollowUpOpen(item: FollowUpInboxItem) {
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
        'No hay un presupuesto asociado para abrir este contexto. La oportunidad sigue disponible en el seguimiento.',
    });
  }

  function handleFollowUpAction(
    item: FollowUpInboxItem,
    event: InboxActionEvent,
    input: InboxActionInput,
  ): boolean {
    const now = new Date().toISOString();
    try {
      if (item.cadenceStep) {
        const execution = loadCadenceExecutions().items.find(
          (value) => value.id === item.cadenceStep?.executionId,
        );
        if (!execution || event === 'notRelevant') return false;
        const updated =
          event === 'completed'
            ? completeCadenceAction(execution, input.actor, input.result, now)
            : updateCadenceAction(
                execution,
                event === 'rescheduled' ? 'rescheduled' : 'cancelled',
                input.actor,
                input.reason,
                now,
                event === 'rescheduled' ? input.dueAt : undefined,
              );
        if (!saveCadenceExecution(updated)) return false;
        if (execution.target.kind === 'opportunity') {
          const targetOpportunityId = execution.target.opportunityId;
          const opportunity = loadOpportunities().items.find(
            (value) => value.id === targetOpportunityId,
          );
          const action = updated.stepExecutions.find(
            (step) => step.id === updated.currentStepExecutionId,
          )?.nextAction;
          if (
            opportunity &&
            !saveOpportunity({ ...opportunity, nextAction: action, updatedAt: now })
          )
            return false;
        }
        recordCadenceActivity(
          execution.target.kind === 'opportunity'
            ? { kind: 'opportunity', opportunityId: execution.target.opportunityId }
            : { kind: 'quote', quoteId: execution.target.quoteId },
          `${execution.id}:${item.action?.id ?? item.cadenceStep.stepExecutionId}:${event}`,
          `Cadencia actualizada desde la bandeja.`,
        );
        setOpportunities(loadOpportunities().items);
        return true;
      }
      if (!item.opportunityId) return false;
      const current = loadOpportunities().items.find((value) => value.id === item.opportunityId);
      if (!current) return false;
      const next = transitionNextAction(
        current,
        event,
        input.actor,
        event === 'completed' ? 'Completada desde la bandeja.' : input.reason,
        now,
        {
          dueAt: event === 'rescheduled' ? input.dueAt : undefined,
          result: event === 'completed' ? input.result : undefined,
        },
      );
      if (
        !saveOpportunity(next) ||
        !next.nextAction ||
        !recordNextActionActivity(
          current.id,
          next.nextAction.id,
          event,
          `Próxima acción actualizada desde la bandeja.`,
        )
      )
        return false;
      setOpportunities(loadOpportunities().items);
      return true;
    } catch {
      return false;
    }
  }

  function handleDraftSave() {
    const draft = getCurrentQuote();

    if (draft.status !== 'draft') return;

    const isNewQuote = !savedQuotes.some((savedQuote) => savedQuote.id === draft.id);
    if (saveQuote(draft)) {
      const activitySaved =
        !isNewQuote ||
        recordAutomaticActivity(
          { kind: 'quote', quoteId: draft.id },
          'created',
          'Presupuesto creado.',
        );
      setSavedQuotes(loadSavedQuotes());
      setSaveFeedback({
        type: activitySaved ? 'success' : 'error',
        message: activitySaved
          ? 'Borrador guardado correctamente.'
          : 'Borrador guardado, pero no se pudo registrar la actividad de creación.',
      });
      return;
    }

    setSaveFeedback({
      type: 'error',
      message: 'No se pudo guardar el borrador. Intentá nuevamente.',
    });
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
      setSavedQuotes(loadSavedQuotes());
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
          `Estado comercial cambiado a ${commercialStatusLabels[nextStatus]}.`,
        )
      ) {
        return 'El estado comercial se guardó, pero no se pudo registrar su actividad.';
      }
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : 'No se pudo registrar el estado comercial.';
    }
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

  function handleFinalizationConfirm() {
    if (finalizationLockRef.current || quoteStatus !== 'draft') return;

    finalizationLockRef.current = true;
    setIsFinalizing(true);
    setFinalizationFeedback(null);

    try {
      const finalizedQuote = finalizeQuote(getCurrentQuote());
      const isNewQuote = !savedQuotes.some((savedQuote) => savedQuote.id === finalizedQuote.id);

      if (!saveQuote(finalizedQuote)) {
        setIsFinalizationConfirmationOpen(false);
        setFinalizationFeedback({
          type: 'error',
          message: 'No se pudo finalizar el presupuesto. Intentá nuevamente.',
        });
        return;
      }

      setQuoteStatus('finalized');
      setSavedQuotes(loadSavedQuotes());
      const creationActivitySaved =
        !isNewQuote ||
        recordAutomaticActivity(
          { kind: 'quote', quoteId: finalizedQuote.id },
          'created',
          'Presupuesto creado.',
        );
      const finalizationActivitySaved = recordAutomaticActivity(
        { kind: 'quote', quoteId: finalizedQuote.id },
        'finalized',
        'Presupuesto finalizado.',
      );
      const activitySaved = creationActivitySaved && finalizationActivitySaved;
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

  async function handleSavedQuotePdfDownload(savedQuote: SavedQuote) {
    if (downloadingSavedQuoteId !== null) return;

    setDownloadingSavedQuoteId(savedQuote.id);
    setSavedQuotePdfFeedback(null);

    try {
      await downloadQuotePdf(savedQuote);
      const activitySaved = recordAutomaticActivity(
        { kind: 'quote', quoteId: savedQuote.id },
        'pdfGenerated',
        'PDF generado.',
      );
      setSavedQuotePdfFeedback({
        quoteId: savedQuote.id,
        type: activitySaved ? 'success' : 'error',
        message: activitySaved
          ? 'El PDF se descargó correctamente.'
          : 'El PDF se descargó, pero no se pudo registrar la actividad.',
      });
    } catch (error) {
      setSavedQuotePdfFeedback({
        quoteId: savedQuote.id,
        type: 'error',
        message:
          error instanceof QuotePdfValidationError
            ? error.message
            : 'No se pudo generar el PDF. Intentá nuevamente.',
      });
    } finally {
      setDownloadingSavedQuoteId(null);
    }
  }

  const appHeader = (
    <AppHeader
      activeSection={resolveActiveNavigationSection(currentView)}
      onNewQuote={handleNewQuote}
      onShowSavedQuotes={() => setCurrentView('savedQuotes')}
      onShowCatalog={() => setCurrentView('catalog')}
      onShowNextActions={() => setCurrentView('nextActions')}
      onShowCadences={() => setCurrentView('cadences')}
    />
  );

  if (currentView === 'catalog') {
    return (
      <>
        {appHeader}
        <LaborCatalogView
          jobs={catalogJobs}
          loadIssue={catalogLoadIssue}
          onBack={() => setCurrentView(quoteStatus === 'draft' ? 'editor' : 'summary')}
          onCreate={handleCatalogCreate}
          onUpdate={handleCatalogUpdate}
          onSetActive={handleCatalogActivation}
        />
      </>
    );
  }

  if (currentView === 'nextActions') {
    return (
      <>
        {appHeader}
        <OpportunityNextActionsInbox
          opportunities={opportunities}
          clients={loadClients().items}
          quotes={savedQuotes}
          executions={loadCadenceExecutions().items}
          activities={loadActivities().items}
          issues={
            [loadClients().issue, loadCadenceExecutions().issue, loadActivities().issue].filter(
              (issue) => issue !== null,
            ) as string[]
          }
          onOpen={handleFollowUpOpen}
          onPrepareContact={setInboxContact}
          onAction={handleFollowUpAction}
        />
        {inboxContact && (
          <ContactAssistant
            context={{
              client: loadClients().items.find((item) => item.id === inboxContact.clientId),
              opportunity: opportunities.find((item) => item.id === inboxContact.opportunityId),
              quote: savedQuotes.find((item) => item.id === inboxContact.quoteId),
            }}
            subject={
              inboxContact.opportunityId
                ? { kind: 'opportunity', opportunityId: inboxContact.opportunityId }
                : { kind: 'quote', quoteId: inboxContact.quoteId! }
            }
            initialChannel={inboxContact.channel as 'call' | 'whatsapp'}
            restrictedChannel={inboxContact.channel as 'call' | 'whatsapp'}
            origin={
              inboxContact.cadenceStep
                ? {
                    kind: 'cadence',
                    cadenceExecutionId: inboxContact.cadenceStep.executionId,
                    stepExecutionId: inboxContact.cadenceStep.stepExecutionId,
                    templateStepId:
                      inboxContact.action?.cadenceOrigin?.templateStepId ??
                      inboxContact.cadenceStep.stepExecutionId,
                  }
                : { kind: 'manual' }
            }
            onClose={() => setInboxContact(null)}
            onRecorded={() => {
              setInboxContact(null);
              setOpportunities(loadOpportunities().items);
            }}
          />
        )}
      </>
    );
  }

  if (currentView === 'cadences') {
    return (
      <>
        {appHeader}
        <CadenceView onBack={() => setCurrentView('editor')} />
      </>
    );
  }

  if (currentView === 'savedQuotes') {
    return (
      <>
        {appHeader}
        <main className="app-shell saved-quotes-shell">
          <header className="saved-quotes-header">
            <div>
              <p className="eyebrow">Ingenya · Presupuestos</p>
              <h1>Mis presupuestos</h1>
              <p className="page-description">
                Continuá un borrador o consultá un presupuesto finalizado.
              </p>
            </div>
          </header>

          <section className="quote-card" aria-labelledby="saved-quotes-title">
            <div className="quote-heading">
              <div>
                <p className="eyebrow">Guardados localmente</p>
                <h2 id="saved-quotes-title">Tus presupuestos</h2>
              </div>
              <span className="line-count">
                {visibleSavedQuotes.length}{' '}
                {visibleSavedQuotes.length === 1 ? 'presupuesto' : 'presupuestos'}
              </span>
            </div>

            <div className="saved-quote-filters" aria-label="Filtrar presupuestos por estado">
              {(
                [
                  ['all', 'Todos'],
                  ['draft', 'Borradores'],
                  ['finalized', 'Finalizados'],
                ] as const
              ).map(([filter, label]) => (
                <button
                  key={filter}
                  className={`saved-quote-filter ${savedQuoteFilter === filter ? 'saved-quote-filter-active' : ''}`}
                  type="button"
                  aria-pressed={savedQuoteFilter === filter}
                  onClick={() => setSavedQuoteFilter(filter)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              className="saved-quote-filters"
              aria-label="Filtrar presupuestos por estado comercial"
            >
              {(
                [
                  'all',
                  'prepared',
                  'sent',
                  'followingUp',
                  'accepted',
                  'rejected',
                  'expired',
                  'paused',
                ] as const
              ).map((filter) => (
                <button
                  key={filter}
                  className={`saved-quote-filter ${savedQuoteCommercialFilter === filter ? 'saved-quote-filter-active' : ''}`}
                  type="button"
                  aria-pressed={savedQuoteCommercialFilter === filter}
                  onClick={() => setSavedQuoteCommercialFilter(filter)}
                >
                  {filter === 'all' ? 'Comerciales: todos' : commercialStatusLabels[filter]}
                </button>
              ))}
            </div>

            {visibleSavedQuotes.length === 0 ? (
              <div className="empty-state saved-quotes-empty-state">
                <span aria-hidden="true">⌁</span>
                <h3>No hay presupuestos en este estado</h3>
                <p>
                  {savedQuoteFilter === 'all'
                    ? 'Creá un presupuesto nuevo para comenzar.'
                    : 'Podés volver a ver todos los presupuestos o crear uno nuevo.'}
                </p>
                <div className="empty-state-actions">
                  {savedQuoteFilter !== 'all' && savedQuotes.length > 0 && (
                    <button
                      className="button button-line"
                      type="button"
                      onClick={() => setSavedQuoteFilter('all')}
                    >
                      Ver todos
                    </button>
                  )}
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={handleNewQuote}
                  >
                    Nuevo presupuesto
                  </button>
                </div>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="saved-quotes-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Cliente</th>
                      <th>Obra / Oportunidad</th>
                      <th>Estado</th>
                      <th>Estado comercial</th>
                      <th>Fecha</th>
                      <th className="numeric-cell">Total</th>
                      <th className="actions-cell">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSavedQuotes.map((savedQuote) => (
                      <tr key={savedQuote.id}>
                        <td data-label="ID">
                          <strong>{savedQuote.id}</strong>
                        </td>
                        <td data-label="Cliente">
                          {savedQuote.clientName.trim() || 'Sin cliente'}
                        </td>
                        <td data-label="Obra / Oportunidad">
                          {savedQuote.projectName.trim() || 'Sin obra'}
                          {savedQuote.opportunityId && (
                            <small>
                              Oportunidad:{' '}
                              {opportunities.find(
                                (item) =>
                                  item.id === savedQuote.opportunityId &&
                                  item.clientId === savedQuote.clientId,
                              )?.name ?? 'Asociación no disponible'}
                            </small>
                          )}
                        </td>
                        <td data-label="Estado">
                          <span className={`status-badge status-badge-${savedQuote.status}`}>
                            {savedQuote.status === 'draft' ? 'Borrador' : 'Finalizado'}
                          </span>
                        </td>
                        <td data-label="Estado comercial">
                          <span
                            className={`status-badge commercial-status-badge status-badge-${savedQuote.commercialStatus}`}
                          >
                            {commercialStatusLabels[savedQuote.commercialStatus]}
                          </span>
                        </td>
                        <td data-label="Fecha">
                          {dateFormatter.format(new Date(savedQuote.savedAt))}
                        </td>
                        <td data-label="Total" className="numeric-cell subtotal">
                          {currencyFormatter.format(calculateQuoteTotal(savedQuote.lines))}
                        </td>
                        <td data-label="Acciones" className="actions-cell saved-quote-actions-cell">
                          <div className="saved-quote-actions">
                            <button
                              className="button button-line"
                              type="button"
                              onClick={() => handleSavedQuoteOpen(savedQuote)}
                            >
                              {savedQuote.status === 'draft'
                                ? 'Continuar editando'
                                : 'Ver presupuesto'}
                            </button>
                            {savedQuote.status === 'finalized' && (
                              <button
                                className="button button-line"
                                type="button"
                                onClick={() => handleSavedQuotePdfDownload(savedQuote)}
                                disabled={downloadingSavedQuoteId !== null}
                              >
                                {downloadingSavedQuoteId === savedQuote.id ? 'Generando…' : 'PDF'}
                              </button>
                            )}
                          </div>
                          {savedQuotePdfFeedback?.quoteId === savedQuote.id && (
                            <p
                              className={`saved-quote-pdf-feedback save-feedback-${savedQuotePdfFeedback.type}`}
                              role={savedQuotePdfFeedback.type === 'error' ? 'alert' : 'status'}
                            >
                              {savedQuotePdfFeedback.message}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <button
            className="button button-link back-to-current"
            type="button"
            onClick={() => setCurrentView(quoteStatus === 'draft' ? 'editor' : 'summary')}
          >
            <span aria-hidden="true">←</span> Volver al presupuesto actual
          </button>
        </main>
      </>
    );
  }

  if (currentView === 'summary') {
    return (
      <>
        {appHeader}
        <main className="app-shell summary-shell">
          <header className="summary-header">
            <div>
              <p className="eyebrow">Ingenya · Presupuestos</p>
              <h1>
                {quoteStatus === 'draft' ? 'Revisá el presupuesto' : 'Presupuesto finalizado'}
              </h1>
              <p className="page-description">
                {quoteStatus === 'draft'
                  ? 'Confirmá los datos antes de finalizarlo.'
                  : 'Consultá el detalle o descargá el PDF del presupuesto.'}
              </p>
            </div>
            <div className="page-context">
              <div
                className="quote-identity"
                aria-label={`Presupuesto ${quoteId}, ${
                  quoteStatus === 'draft' ? 'Borrador' : 'Finalizado'
                }`}
              >
                <span>{quoteId}</span>
                <strong>{quoteStatus === 'draft' ? 'Borrador' : 'Finalizado'}</strong>
              </div>
            </div>
          </header>

          <div className="summary-layout">
            <div className="summary-main-column">
              <section
                className="quote-card summary-action-card"
                aria-label="Acciones del presupuesto"
              >
                <div className="summary-action-row">
                  {quoteStatus === 'draft' && (
                    <>
                      <button
                        className="button button-line"
                        type="button"
                        onClick={() => setCurrentView('editor')}
                      >
                        <span aria-hidden="true">←</span> Volver a editar
                      </button>
                      <button
                        className="button button-line"
                        type="button"
                        onClick={handleDraftSave}
                      >
                        Guardar borrador
                      </button>
                    </>
                  )}
                  <button
                    className="button button-secondary summary-pdf-button"
                    type="button"
                    onClick={handlePdfDownload}
                    disabled={quoteLines.length === 0 || isDownloadingPdf}
                  >
                    {isDownloadingPdf ? 'Generando PDF…' : 'Descargar PDF'}
                  </button>
                  {quoteStatus === 'draft' && (
                    <button
                      ref={finalizationTriggerRef}
                      className="button button-primary"
                      type="button"
                      onClick={handleFinalizationRequest}
                      disabled={isFinalizing}
                    >
                      Finalizar presupuesto
                    </button>
                  )}
                  {quoteStatus === 'finalized' && (
                    <button
                      className="button button-line"
                      type="button"
                      onClick={() => setCurrentView('savedQuotes')}
                    >
                      Ir a Mis presupuestos
                    </button>
                  )}
                </div>
                {quoteStatus === 'draft' && (
                  <p className="finalization-note">
                    Finalizar no envía el presupuesto al cliente ni registra un cobro.
                  </p>
                )}
                {saveFeedback && (
                  <p
                    className={`save-feedback save-feedback-${saveFeedback.type}`}
                    role={saveFeedback.type === 'error' ? 'alert' : 'status'}
                  >
                    {saveFeedback.message}
                  </p>
                )}
                {finalizationFeedback && (
                  <p
                    className={`save-feedback save-feedback-${finalizationFeedback.type}`}
                    role={finalizationFeedback.type === 'error' ? 'alert' : 'status'}
                  >
                    {finalizationFeedback.message}
                  </p>
                )}
                {pdfFeedback && (
                  <p
                    className={`save-feedback save-feedback-${pdfFeedback.type}`}
                    role={pdfFeedback.type === 'error' ? 'alert' : 'status'}
                  >
                    {pdfFeedback.message}
                  </p>
                )}
                <div className="optional-data-disclosure">
                  <button
                    className="optional-data-toggle"
                    type="button"
                    aria-expanded={isOptionalDataOpen}
                    aria-controls="optional-quote-data"
                    onClick={() => setIsOptionalDataOpen((isOpen) => !isOpen)}
                  >
                    <span>Datos opcionales</span>
                    <span aria-hidden="true">{isOptionalDataOpen ? '−' : '+'}</span>
                  </button>
                  {isOptionalDataOpen && (
                    <div id="optional-quote-data" className="optional-data-content">
                      <p className="commercial-note">
                        Estos textos se conservan aunque cambien el cliente o la oportunidad.
                      </p>
                      {quoteStatus === 'draft' ? (
                        <>
                          <label className="field">
                            <span>Cliente</span>
                            <input
                              type="text"
                              value={clientName}
                              onChange={(event) => setClientName(event.target.value)}
                              placeholder="Nombre del cliente"
                            />
                            <small>Podés dejar este campo vacío.</small>
                          </label>
                          <label className="field">
                            <span>Oportunidad</span>
                            <input
                              type="text"
                              value={projectName}
                              onChange={(event) => setProjectName(event.target.value)}
                              placeholder="Nombre o ubicación de la obra"
                            />
                            <small>Podés dejar este campo vacío.</small>
                          </label>
                        </>
                      ) : (
                        <dl className="summary-read-only-data">
                          <div>
                            <dt>Cliente</dt>
                            <dd>{clientName.trim() || 'Sin cliente'}</dd>
                          </div>
                          <div>
                            <dt>Oportunidad</dt>
                            <dd>{projectName.trim() || 'Sin oportunidad'}</dd>
                          </div>
                        </dl>
                      )}
                      <dl className="summary-read-only-data">
                        <div>
                          <dt>Vendedor responsable</dt>
                          <dd>{currentOpportunity?.responsibleSeller || 'Sin asignar'}</dd>
                        </div>
                      </dl>
                    </div>
                  )}
                </div>
              </section>

              <section className="quote-card summary-lines" aria-labelledby="summary-lines-title">
                <div className="quote-heading">
                  <div>
                    <p className="eyebrow">Detalle</p>
                    <h2 id="summary-lines-title">Servicios incluidos</h2>
                  </div>
                  <span className="line-count">
                    {quoteLines.length} {quoteLines.length === 1 ? 'servicio' : 'servicios'}
                  </span>
                </div>

                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Servicio</th>
                        <th>Unidad</th>
                        <th className="numeric-cell">Cantidad</th>
                        <th className="numeric-cell">Precio unitario</th>
                        <th className="numeric-cell">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quoteLines.map((line) => (
                        <tr key={line.id}>
                          <td>
                            <strong>{line.name}</strong>
                            {line.description && <small>{line.description}</small>}
                            <small>{line.source === 'catalog' ? 'Catálogo' : 'Manual'}</small>
                          </td>
                          <td>
                            {workUnitLabels[line.unit]} ({workUnitSymbols[line.unit]})
                          </td>
                          <td className="numeric-cell">{line.quantity}</td>
                          <td className="numeric-cell">
                            {currencyFormatter.format(line.unitPrice)}
                          </td>
                          <td className="numeric-cell subtotal">
                            {currencyFormatter.format(
                              calculateLineSubtotal(line.quantity, line.unitPrice),
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <footer className="summary-total">
                  <span>Total del presupuesto</span>
                  <strong>{currencyFormatter.format(quoteTotal)}</strong>
                </footer>
              </section>
            </div>

            <aside className="summary-sidebar" aria-label="Datos y acciones del presupuesto">
              <QuoteSidebar
                summary={
                  <QuoteCommercialContext
                    key={quoteId}
                    quote={getCurrentQuote()}
                    savedQuotes={savedQuotes}
                    onAssociate={handleAssociation}
                    onEntitiesChange={() => setOpportunities(loadOpportunities().items)}
                    onQuoteResult={handleCommercialStatusChange}
                  />
                }
                activities={<QuoteActivityPanel quote={getCurrentQuote()} />}
                commercialStatus={
                  <QuoteCommercialStatus
                    documentStatus={quoteStatus}
                    commercialStatus={commercialStatus}
                    commercialStatusAudit={commercialStatusAudit}
                    sentAudit={sentAudit}
                    hasOpportunity={Boolean(opportunityId)}
                    onChange={handleCommercialStatusChange}
                  />
                }
              />
            </aside>
          </div>
          {isFinalizationConfirmationOpen && (
            <div className="modal-backdrop">
              <section
                className="confirmation-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="finalization-title"
                aria-describedby="finalization-description"
              >
                <h2 id="finalization-title">¿Finalizar este presupuesto?</h2>
                <p id="finalization-description">
                  Se guardará con estado “Finalizado”. No se enviará al cliente y podrás descargar
                  el PDF después.
                </p>
                <div className="confirmation-actions">
                  <button
                    ref={finalizationCancelRef}
                    className="button button-line"
                    type="button"
                    onClick={() => setIsFinalizationConfirmationOpen(false)}
                    disabled={isFinalizing}
                  >
                    Cancelar
                  </button>
                  <button
                    ref={finalizationConfirmRef}
                    className="button button-primary"
                    type="button"
                    onClick={handleFinalizationConfirm}
                    disabled={isFinalizing}
                  >
                    {isFinalizing ? 'Finalizando…' : 'Sí, finalizar'}
                  </button>
                </div>
              </section>
            </div>
          )}
        </main>
      </>
    );
  }

  return (
    <>
      {appHeader}
      <main className="app-shell">
        <header className="page-header">
          <div>
            <p className="eyebrow">Ingenya · Presupuestos</p>
            <h1>Mano de obra</h1>
            <p className="page-description">
              Agregá los servicios, ajustá cantidades y precios, y revisá el total antes de
              continuar.
            </p>
          </div>
          <div className="page-context">
            <div
              className="header-total"
              aria-label={`Total actual: ${currencyFormatter.format(quoteTotal)}`}
            >
              <span>Total actual</span>
              <strong>{currencyFormatter.format(quoteTotal)}</strong>
            </div>
          </div>
        </header>

        <section className="entry-grid" aria-label="Agregar mano de obra">
          <form className="entry-card" onSubmit={handleCatalogSubmit}>
            <div className="card-heading">
              <span className="step-number">1</span>
              <div>
                <h2>Elegir del catálogo</h2>
                <p>Usá un servicio existente y ajustá su precio para este presupuesto.</p>
              </div>
            </div>

            <label className="field">
              <span>Buscar servicio activo</span>
              <input
                type="search"
                value={catalogSearch}
                onChange={(event) => handleCatalogSearchChange(event.target.value)}
                placeholder="Nombre o descripción"
              />
            </label>

            <label className="field catalog-quote-select">
              <span>Servicio</span>
              <select
                value={selectedJobId}
                onChange={(event) => handleCatalogJobChange(event.target.value)}
                disabled={visibleActiveCatalogJobs.length === 0}
              >
                {visibleActiveCatalogJobs.length === 0 && <option value="">Sin resultados</option>}
                {visibleActiveCatalogJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="form-grid">
              <div className="field read-only-field">
                <span>Unidad</span>
                <strong>
                  {selectedVisibleJob
                    ? `${workUnitLabels[selectedVisibleJob.unit]} (${workUnitSymbols[selectedVisibleJob.unit]})`
                    : 'Sin servicio seleccionado'}
                </strong>
              </div>
              <label className="field">
                <span>Cantidad</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={catalogQuantity}
                  onChange={(event) => setCatalogQuantity(event.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>Precio unitario</span>
                <div className="money-input">
                  <span>$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={catalogUnitPrice}
                    onChange={(event) => setCatalogUnitPrice(event.target.value)}
                    required
                  />
                </div>
                <small>Precio sugerido, editable para este presupuesto.</small>
              </label>
            </div>

            {catalogError && <p className="form-error">{catalogError}</p>}
            <button
              className="button button-secondary"
              type="submit"
              disabled={!selectedVisibleJob}
            >
              Agregar servicio
            </button>
          </form>

          <form className="entry-card" onSubmit={handleManualSubmit}>
            <div className="card-heading">
              <span className="step-number">2</span>
              <div>
                <h2>Agregar servicio manual</h2>
                <p>Creá una línea cuando el servicio no esté disponible en el catálogo.</p>
              </div>
            </div>

            <label className="field">
              <span>Nombre del servicio</span>
              <input
                type="text"
                value={manualName}
                onChange={(event) => setManualName(event.target.value)}
                placeholder="Ej.: Reparar revoque"
                required
              />
            </label>

            <label className="field quick-description">
              <span>Descripción (opcional)</span>
              <textarea
                value={manualDescription}
                onChange={(event) => setManualDescription(event.target.value)}
                placeholder="Detalle breve del trabajo"
                rows={3}
              />
            </label>

            <div className="form-grid">
              <label className="field">
                <span>Unidad</span>
                <select
                  value={manualUnit}
                  onChange={(event) => setManualUnit(event.target.value as WorkUnit)}
                >
                  {availableWorkUnits.map((unit) => (
                    <option key={unit} value={unit}>
                      {workUnitLabels[unit]} ({workUnitSymbols[unit]})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Cantidad</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={manualQuantity}
                  onChange={(event) => setManualQuantity(event.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>Precio unitario</span>
                <div className="money-input">
                  <span>$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={manualUnitPrice}
                    onChange={(event) => setManualUnitPrice(event.target.value)}
                    placeholder="0"
                    required
                  />
                </div>
              </label>
            </div>

            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={saveManualToCatalog}
                onChange={(event) => setSaveManualToCatalog(event.target.checked)}
              />
              <span>Guardar también en el catálogo para reutilizarlo</span>
            </label>

            {manualError && <p className="form-error">{manualError}</p>}
            <button className="button button-secondary" type="submit">
              Agregar servicio manual
            </button>
          </form>
        </section>

        <section className="quote-card" aria-labelledby="quote-lines-title">
          <div className="quote-heading">
            <div>
              <p className="eyebrow">Detalle</p>
              <h2 id="quote-lines-title">Servicios del presupuesto</h2>
            </div>
            <span className="line-count">
              {quoteLines.length} {quoteLines.length === 1 ? 'servicio' : 'servicios'}
            </span>
          </div>

          {quoteLines.length === 0 ? (
            <div className="empty-state">
              <span aria-hidden="true">＋</span>
              <h3>Todavía no agregaste servicios</h3>
              <p>Elegí uno del catálogo o cargalo manualmente para empezar el presupuesto.</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Servicio</th>
                    <th>Unidad</th>
                    <th className="numeric-cell">Cantidad</th>
                    <th className="numeric-cell">Precio unitario</th>
                    <th className="numeric-cell">Subtotal</th>
                    <th className="actions-cell">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {quoteLines.map((line) => {
                    const isEditing = editingLineId === line.id;

                    return (
                      <tr key={line.id}>
                        <td>
                          <strong>{line.name}</strong>
                          {line.description && <small>{line.description}</small>}
                          <small>{line.source === 'catalog' ? 'Catálogo' : 'Manual'}</small>
                        </td>
                        <td>{workUnitSymbols[line.unit]}</td>
                        <td className="numeric-cell">
                          {isEditing ? (
                            <input
                              className="line-edit-input"
                              type="number"
                              min="0"
                              step="0.01"
                              value={editQuantity}
                              onChange={(event) => setEditQuantity(event.target.value)}
                              aria-label={`Cantidad de ${line.name}`}
                            />
                          ) : (
                            line.quantity
                          )}
                        </td>
                        <td className="numeric-cell">
                          {isEditing ? (
                            <input
                              className="line-edit-input line-edit-price"
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={editUnitPrice}
                              onChange={(event) => setEditUnitPrice(event.target.value)}
                              aria-label={`Precio unitario de ${line.name}`}
                            />
                          ) : (
                            currencyFormatter.format(line.unitPrice)
                          )}
                        </td>
                        <td className="numeric-cell subtotal">
                          {currencyFormatter.format(
                            calculateLineSubtotal(line.quantity, line.unitPrice),
                          )}
                        </td>
                        <td className="actions-cell">
                          {isEditing ? (
                            <>
                              <div className="line-actions">
                                <button
                                  className="button button-line button-save"
                                  type="button"
                                  onClick={() => handleEditSave(line.id)}
                                >
                                  Guardar
                                </button>
                                <button
                                  className="button button-line"
                                  type="button"
                                  onClick={handleEditCancel}
                                >
                                  Cancelar
                                </button>
                              </div>
                              {editError && (
                                <small className="line-edit-error" role="alert">
                                  {editError}
                                </small>
                              )}
                            </>
                          ) : (
                            <div className="line-actions">
                              <button
                                className="button button-line"
                                type="button"
                                onClick={() => handleEditStart(line)}
                              >
                                Editar
                              </button>
                              <button
                                className="button button-line button-delete"
                                type="button"
                                onClick={() => handleLineDelete(line.id)}
                              >
                                Eliminar
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <footer className="quote-footer">
            <div className="grand-total">
              <span>Total del presupuesto</span>
              <strong>{currencyFormatter.format(quoteTotal)}</strong>
            </div>
            <button
              className="button button-primary"
              type="button"
              disabled={quoteLines.length === 0}
              onClick={() => setCurrentView('summary')}
            >
              Continuar presupuesto <span aria-hidden="true">→</span>
            </button>
          </footer>
        </section>
      </main>
    </>
  );
}

export default App;
