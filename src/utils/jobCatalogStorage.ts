import { initialJobCatalog } from '../data/jobCatalog';
import { emitLocalWrite } from './localWriteEvents';
import { isAuthConfigured } from './authService';
import type { CatalogJob } from '../types/quote';
import { isCatalogJob } from './jobCatalogValidation';
import { getActiveWorkspaceId, workspaceStorageKey } from './workspaceStorage';

export const LABOR_CATALOG_STORAGE_KEY = 'ingenya.laborCatalog.v1';

export type LaborCatalogLoadIssue =
  'invalid-root' | 'invalid-entries' | 'initialization-write-failed' | 'read-failed';

export interface LaborCatalogLoadResult {
  jobs: CatalogJob[];
  issue: LaborCatalogLoadIssue | null;
}

function seedCatalog(): CatalogJob[] {
  return initialJobCatalog.map((job) => ({ ...job }));
}

export function parseLaborCatalog(storedValue: string): LaborCatalogLoadResult {
  try {
    const parsed: unknown = JSON.parse(storedValue);
    if (!Array.isArray(parsed)) return { jobs: seedCatalog(), issue: 'invalid-root' };

    const jobs = parsed.filter(isCatalogJob).map((job) => ({ ...job }));
    return { jobs, issue: jobs.length === parsed.length ? null : 'invalid-entries' };
  } catch {
    return { jobs: seedCatalog(), issue: 'invalid-root' };
  }
}

export function loadLaborCatalog(): LaborCatalogLoadResult {
  try {
    const storedValue = localStorage.getItem(workspaceStorageKey(LABOR_CATALOG_STORAGE_KEY));
    if (storedValue !== null) return parseLaborCatalog(storedValue);

    const jobs = seedCatalog();
    // SCRUM-124: before signing in there is no workspace yet; the starter catalog is shown but
    // not stored, so nothing stays in the browser after signing out.
    if (isAuthConfigured() && !getActiveWorkspaceId()) return { jobs, issue: null };
    try {
      localStorage.setItem(workspaceStorageKey(LABOR_CATALOG_STORAGE_KEY), JSON.stringify(jobs));
      return { jobs, issue: null };
    } catch {
      return { jobs, issue: 'initialization-write-failed' };
    }
  } catch {
    return { jobs: seedCatalog(), issue: 'read-failed' };
  }
}

export function saveLaborCatalog(jobs: readonly CatalogJob[]): boolean {
  try {
    localStorage.setItem(workspaceStorageKey(LABOR_CATALOG_STORAGE_KEY), JSON.stringify(jobs));
    emitLocalWrite();
    return true;
  } catch {
    return false;
  }
}

export function addCatalogJob(jobs: readonly CatalogJob[], job: CatalogJob): CatalogJob[] {
  return [...jobs, { ...job }];
}

export function updateCatalogJob(
  jobs: readonly CatalogJob[],
  updatedJob: CatalogJob,
): CatalogJob[] {
  return jobs.map((job) => (job.id === updatedJob.id ? { ...updatedJob } : job));
}

export function setCatalogJobActive(
  jobs: readonly CatalogJob[],
  jobId: string,
  isActive: boolean,
): CatalogJob[] {
  return jobs.map((job) => (job.id === jobId ? { ...job, isActive } : job));
}
