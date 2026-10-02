import { initialJobCatalog } from '../data/jobCatalog';
import type { CatalogJob } from '../types/quote';
import { isCatalogJob } from './jobCatalogValidation';

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
    const storedValue = localStorage.getItem(LABOR_CATALOG_STORAGE_KEY);
    if (storedValue !== null) return parseLaborCatalog(storedValue);

    const jobs = seedCatalog();
    try {
      localStorage.setItem(LABOR_CATALOG_STORAGE_KEY, JSON.stringify(jobs));
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
    localStorage.setItem(LABOR_CATALOG_STORAGE_KEY, JSON.stringify(jobs));
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
