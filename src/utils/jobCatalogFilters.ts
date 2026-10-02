import type { CatalogJob } from '../types/quote';

export type CatalogJobFilter = 'all' | 'active' | 'inactive';

export function filterCatalogJobs(
  jobs: readonly CatalogJob[],
  search: string,
  filter: CatalogJobFilter,
): CatalogJob[] {
  const normalizedSearch = search.trim().toLocaleLowerCase('es');

  return jobs.filter((job) => {
    const matchesStatus = filter === 'all' || (filter === 'active' ? job.isActive : !job.isActive);
    const searchableText = `${job.name} ${job.description ?? ''}`.toLocaleLowerCase('es');
    return matchesStatus && (!normalizedSearch || searchableText.includes(normalizedSearch));
  });
}
