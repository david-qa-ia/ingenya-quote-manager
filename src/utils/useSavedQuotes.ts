import { useCallback, useState } from 'react';
import type { SavedQuote } from '../types/quote';
import { recordAutomaticActivity } from './activityStorage';
import { loadSavedQuotes } from './quoteDraftStorage';
import { downloadQuotePdf } from './quotePdf';
import { QuotePdfValidationError } from './quotePdfModel';
import { loadResponsibles, primaryResponsibleName } from './responsibleStorage';
import {
  filterSavedQuotes,
  filterSavedQuotesByCommercialStatus,
  type SavedQuoteCommercialFilter,
  type SavedQuoteFilter,
} from './savedQuoteFilters';

export interface SavedQuotePdfFeedback {
  quoteId: string;
  type: 'success' | 'error';
  message: string;
}

/**
 * Saved quotes as the browser copy has them, the "Presupuestos guardados" filters (kept while
 * the user moves between screens) and the PDF download from that list.
 */
export function useSavedQuotes() {
  const [savedQuotes, setSavedQuotes] = useState(loadSavedQuotes);
  const [documentFilter, setDocumentFilter] = useState<SavedQuoteFilter>('all');
  const [commercialFilter, setCommercialFilter] = useState<SavedQuoteCommercialFilter>('all');
  const [downloadingQuoteId, setDownloadingQuoteId] = useState<string | null>(null);
  const [pdfFeedback, setPdfFeedback] = useState<SavedQuotePdfFeedback | null>(null);

  /** Read the quotes again after a save, a sync or a workspace change. */
  const reloadSavedQuotes = useCallback(() => setSavedQuotes(loadSavedQuotes()), []);

  const visibleSavedQuotes = filterSavedQuotesByCommercialStatus(
    filterSavedQuotes(savedQuotes, documentFilter),
    commercialFilter,
  );

  async function downloadSavedQuotePdf(savedQuote: SavedQuote) {
    if (downloadingQuoteId !== null) return;

    setDownloadingQuoteId(savedQuote.id);
    setPdfFeedback(null);

    try {
      await downloadQuotePdf(savedQuote);
      const activitySaved = recordAutomaticActivity(
        { kind: 'quote', quoteId: savedQuote.id },
        'pdfGenerated',
        'PDF generado.',
        primaryResponsibleName(loadResponsibles()),
      );
      setPdfFeedback({
        quoteId: savedQuote.id,
        type: activitySaved ? 'success' : 'error',
        message: activitySaved
          ? 'El PDF se descargó correctamente.'
          : 'El PDF se descargó, pero no se pudo registrar la actividad.',
      });
    } catch (error) {
      setPdfFeedback({
        quoteId: savedQuote.id,
        type: 'error',
        message:
          error instanceof QuotePdfValidationError
            ? error.message
            : 'No se pudo generar el PDF. Intentá nuevamente.',
      });
    } finally {
      setDownloadingQuoteId(null);
    }
  }

  return {
    savedQuotes,
    reloadSavedQuotes,
    visibleSavedQuotes,
    documentFilter,
    setDocumentFilter,
    commercialFilter,
    setCommercialFilter,
    downloadingQuoteId,
    pdfFeedback,
    downloadSavedQuotePdf,
  };
}
