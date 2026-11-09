import { useCallback, useState } from 'react';
import type { CatalogJob } from '../types/quote';
import { loadLaborCatalog, saveLaborCatalog } from './jobCatalogStorage';

/**
 * The service catalog as the browser copy has it. A catalog whose stored value could not be
 * read at all ("invalid-root") is never overwritten, so it stays available for diagnosis.
 */
export function useLaborCatalog() {
  const [initialLoad] = useState(loadLaborCatalog);
  const [catalogJobs, setCatalogJobs] = useState<CatalogJob[]>(initialLoad.jobs);
  const [catalogLoadIssue, setCatalogLoadIssue] = useState(initialLoad.issue);

  /** Read the catalog again after a sync or a workspace change. */
  const reloadCatalog = useCallback(() => {
    const catalog = loadLaborCatalog();
    setCatalogJobs(catalog.jobs);
    setCatalogLoadIssue(catalog.issue);
  }, []);

  /** Writes to storage for a quick service saved to the catalog; false keeps it untouched. */
  const writeCatalog = (jobs: readonly CatalogJob[]) =>
    catalogLoadIssue !== 'invalid-root' && saveLaborCatalog(jobs);

  /** Show jobs that were already written to storage. */
  function showSavedCatalog(jobs: CatalogJob[]) {
    setCatalogJobs(jobs);
    setCatalogLoadIssue(null);
  }

  /** Save a change from Configuración › Servicios; returns the message to show, if any. */
  function saveCatalog(nextJobs: CatalogJob[]): string | null {
    if (catalogLoadIssue === 'invalid-root') {
      return 'No se guardaron cambios para preservar el catálogo corrupto para diagnóstico.';
    }
    if (!saveLaborCatalog(nextJobs)) return 'No se pudo guardar el catálogo. Intentá nuevamente.';
    showSavedCatalog(nextJobs);
    return null;
  }

  return {
    catalogJobs,
    catalogLoadIssue,
    reloadCatalog,
    writeCatalog,
    showSavedCatalog,
    saveCatalog,
  };
}
