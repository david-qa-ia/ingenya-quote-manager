import type { Client } from '../types/client';
import { canContactClient, isPendingEmail, isPendingPhone } from './clientValidation';
import { isOpenJob, normalizeSearchText, type JobRow } from './jobList';

/**
 * The Clientes screen: everyone who already has a client record, with their jobs (trabajos).
 * Jobs come from `buildJobList`, so a client's stages match the Trabajos screen exactly.
 */
export type ClientFilter = 'withOpenJobs' | 'customers' | 'withoutJobs' | 'all';

export const clientFilterOrder: readonly ClientFilter[] = [
  'withOpenJobs',
  'customers',
  'withoutJobs',
  'all',
];

export const clientFilterLabels: Record<ClientFilter, string> = {
  withOpenJobs: 'Con trabajos abiertos',
  customers: 'Con trabajos ganados',
  withoutJobs: 'Sin trabajos',
  all: 'Todos',
};

export interface ClientRow {
  client: Client;
  /** The client's jobs in the Trabajos order: open first, most urgent next step on top. */
  jobs: JobRow[];
  openJobs: number;
  wonJobs: number;
  /** Sum of the amounts of the won jobs. */
  wonAmount: number;
  /** The earliest pending next step among the client's open jobs. */
  nextStep?: { description: string; dueAt: string };
  /** The latest change to the client or any of their jobs. */
  lastActivityAt: string;
}

const latest = (a: string, b: string) => (b > a ? b : a);

function clientRow(client: Client, jobs: JobRow[]): ClientRow {
  const open = jobs.filter(isOpenJob);
  const won = jobs.filter((job) => job.stage === 'won');
  const nextStep = open
    .map((job) => job.nextStep)
    .filter((step) => step !== undefined)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
  return {
    client,
    jobs,
    openJobs: open.length,
    wonJobs: won.length,
    wonAmount: won.reduce((total, job) => total + (job.amount ?? 0), 0),
    nextStep,
    lastActivityAt: jobs.reduce((value, job) => latest(value, job.updatedAt), client.updatedAt),
  };
}

/** Clients with open jobs first, the most urgent next step on top; the rest by latest activity. */
function compareClients(a: ClientRow, b: ClientRow): number {
  const openDifference = Number(b.openJobs > 0) - Number(a.openJobs > 0);
  if (openDifference) return openDifference;
  if (a.openJobs > 0) {
    if (a.nextStep && b.nextStep) return a.nextStep.dueAt.localeCompare(b.nextStep.dueAt);
    if (a.nextStep || b.nextStep) return a.nextStep ? -1 : 1;
  }
  return (
    b.lastActivityAt.localeCompare(a.lastActivityAt) ||
    a.client.name.localeCompare(b.client.name, 'es')
  );
}

export function buildClientList(clients: readonly Client[], jobs: readonly JobRow[]): ClientRow[] {
  const jobsByClient = new Map<string, JobRow[]>();
  for (const job of jobs) {
    if (!job.clientId) continue;
    jobsByClient.set(job.clientId, [...(jobsByClient.get(job.clientId) ?? []), job]);
  }
  return clients
    .map((client) => clientRow(client, jobsByClient.get(client.id) ?? []))
    .sort(compareClients);
}

function matchesFilter(row: ClientRow, filter: ClientFilter): boolean {
  if (filter === 'withOpenJobs') return row.openJobs > 0;
  if (filter === 'customers') return row.wonJobs > 0;
  if (filter === 'withoutJobs') return row.jobs.length === 0;
  return true;
}

/** Searchable text: names, contact data the user typed (never the internal pending values) and services. */
function searchText(row: ClientRow): string {
  const { client } = row;
  const phone = isPendingPhone(client.phone) ? '' : client.phone;
  const parts = [
    client.name,
    client.company ?? '',
    phone,
    phone.replace(/\D/g, ''),
    isPendingEmail(client.email) ? '' : client.email,
    ...row.jobs.map((job) => job.service),
  ];
  return normalizeSearchText(parts.join(' '));
}

export function filterClients(
  rows: readonly ClientRow[],
  options: { filter: ClientFilter; query: string },
): ClientRow[] {
  const query = normalizeSearchText(options.query.trim());
  return rows.filter(
    (row) => matchesFilter(row, options.filter) && (!query || searchText(row).includes(query)),
  );
}

export function countClients(rows: readonly ClientRow[]): Record<ClientFilter, number> {
  return Object.fromEntries(
    clientFilterOrder.map((filter) => [
      filter,
      rows.filter((row) => matchesFilter(row, filter)).length,
    ]),
  ) as Record<ClientFilter, number>;
}

export type ContactChannel = 'phone' | 'whatsapp' | 'email';

export interface ContactLink {
  channel: ContactChannel;
  label: string;
  href: string;
}

const channelLabels: Record<ContactChannel, string> = {
  phone: 'Llamar',
  whatsapp: 'WhatsApp',
  email: 'Correo',
};

/**
 * Links that open the dialer, a WhatsApp chat or a mail draft; the user sends the message. None
 * when the client asked not to be contacted or the data is missing. The preferred channel first.
 */
export function getClientContactLinks(client: Client): ContactLink[] {
  const digits = client.phone.replace(/\D/g, '');
  const hrefs: Record<ContactChannel, string> = {
    phone: `tel:${digits}`,
    whatsapp: `https://wa.me/${digits}`,
    email: `mailto:${client.email.trim()}`,
  };
  const channels: ContactChannel[] = ['whatsapp', 'phone', 'email'];
  return channels
    .filter((channel) => canContactClient(client, channel) && (channel === 'email' || digits))
    .sort((a, b) => Number(b === client.preferredChannel) - Number(a === client.preferredChannel))
    .map((channel) => ({ channel, label: channelLabels[channel], href: hrefs[channel] }));
}
