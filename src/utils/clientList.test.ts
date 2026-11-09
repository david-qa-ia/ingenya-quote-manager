import { describe, expect, it } from 'vitest';
import type { Client } from '../types/client';
import type { JobRow } from './jobList';
import { buildClientList, countClients, filterClients, getClientContactLinks } from './clientList';

const client = (overrides: Partial<Client>): Client => ({
  id: 'c1',
  name: 'Marta Gómez',
  company: 'Consorcio Belgrano',
  phone: '341 555-1234',
  email: 'marta@example.com',
  preferredChannel: '',
  contactConsent: false,
  createdAt: '2026-11-01T12:00:00.000Z',
  updatedAt: '2026-11-01T12:00:00.000Z',
  ...overrides,
});

const job = (overrides: Partial<JobRow>): JobRow => ({
  kind: 'opportunity',
  id: 'o1',
  clientId: 'c1',
  name: 'Marta Gómez',
  company: 'Consorcio Belgrano',
  service: 'Pintura de palier',
  stage: 'quoting',
  updatedAt: '2026-11-02T12:00:00.000Z',
  ...overrides,
});

describe('buildClientList', () => {
  it('groups jobs by client and sums only won amounts', () => {
    const [row] = buildClientList(
      [client({})],
      [
        job({ id: 'o1', stage: 'won', amount: 500000 }),
        job({ id: 'o2', stage: 'won', amount: 250000 }),
        job({ id: 'o3', stage: 'sent', amount: 900000 }),
        job({ id: 'o4', stage: 'lost', amount: 100000 }),
        job({ id: 'p1', kind: 'prospect', clientId: undefined }),
      ],
    );

    expect(row.jobs.map((item) => item.id)).toEqual(['o1', 'o2', 'o3', 'o4']);
    expect(row).toMatchObject({ openJobs: 1, wonJobs: 2, wonAmount: 750000 });
  });

  it('takes the earliest next step from open jobs only', () => {
    const [row] = buildClientList(
      [client({})],
      [
        job({
          id: 'o1',
          stage: 'won',
          nextStep: { description: 'Cobrar', dueAt: '2026-11-03T12:00:00.000Z' },
        }),
        job({
          id: 'o2',
          nextStep: { description: 'Llamar', dueAt: '2026-11-10T12:00:00.000Z' },
        }),
        job({
          id: 'o3',
          nextStep: { description: 'Visitar', dueAt: '2026-11-08T12:00:00.000Z' },
        }),
      ],
    );

    expect(row.nextStep?.description).toBe('Visitar');
  });

  it('puts clients with open jobs first, by next step, then the rest by latest activity', () => {
    const rows = buildClientList(
      [
        client({ id: 'idle-old', updatedAt: '2026-10-01T12:00:00.000Z' }),
        client({ id: 'open-late' }),
        client({ id: 'idle-recent', updatedAt: '2026-11-05T12:00:00.000Z' }),
        client({ id: 'open-soon' }),
      ],
      [
        job({
          id: 'a',
          clientId: 'open-late',
          nextStep: { description: 'Llamar', dueAt: '2026-11-20T12:00:00.000Z' },
        }),
        job({
          id: 'b',
          clientId: 'open-soon',
          nextStep: { description: 'Llamar', dueAt: '2026-11-10T12:00:00.000Z' },
        }),
        job({ id: 'c', clientId: 'idle-old', stage: 'won', updatedAt: '2026-11-07T12:00:00.000Z' }),
      ],
    );

    expect(rows.map((row) => row.client.id)).toEqual([
      'open-soon',
      'open-late',
      'idle-old',
      'idle-recent',
    ]);
  });
});

describe('filterClients and countClients', () => {
  const rows = buildClientList(
    [
      client({ id: 'open', name: 'José Pérez', company: '' }),
      client({ id: 'won', name: 'Lucía Ramos', company: 'Edificio Sol', phone: '1111111111' }),
      client({ id: 'none', name: 'Pedro Díaz', company: '', email: 'none' }),
    ],
    [
      job({ id: 'o1', clientId: 'open', service: 'Durlock' }),
      job({ id: 'o2', clientId: 'won', stage: 'won', amount: 100 }),
    ],
  );

  it('counts every filter over the whole list', () => {
    expect(countClients(rows)).toEqual({ withOpenJobs: 1, customers: 1, withoutJobs: 1, all: 3 });
  });

  it('searches without accents across name, company, phone digits, email and services', () => {
    const find = (query: string) =>
      filterClients(rows, { filter: 'all', query }).map((row) => row.client.id);

    expect(find('jose perez')).toEqual(['open']);
    expect(find('edificio')).toEqual(['won']);
    expect(find('3415551234')).toEqual(['open', 'none']);
    expect(find('durlock')).toEqual(['open']);
  });

  it('never matches the internal pending phone or email values', () => {
    expect(filterClients(rows, { filter: 'all', query: '1111111111' })).toEqual([]);
    expect(filterClients(rows, { filter: 'all', query: 'none' })).toEqual([]);
  });
});

describe('getClientContactLinks', () => {
  it('opens dialer, WhatsApp and mail draft, with the preferred channel first', () => {
    expect(getClientContactLinks(client({ preferredChannel: 'email' }))).toEqual([
      { channel: 'email', label: 'Correo', href: 'mailto:marta@example.com' },
      { channel: 'whatsapp', label: 'WhatsApp', href: 'https://wa.me/5493415551234' },
      { channel: 'phone', label: 'Llamar', href: 'tel:3415551234' },
    ]);
  });

  it('opens the WhatsApp chat with the message ready', () => {
    const whatsapp = getClientContactLinks(client({}), 'Hola Marta, ¿cómo estás?').find(
      (link) => link.channel === 'whatsapp',
    );
    expect(whatsapp?.href).toBe(
      `https://wa.me/5493415551234?text=${encodeURIComponent('Hola Marta, ¿cómo estás?')}`,
    );
  });

  it('leaves out channels whose data is still pending', () => {
    expect(
      getClientContactLinks(client({ phone: '1111111111' })).map((link) => link.channel),
    ).toEqual(['email']);
  });

  it('offers no contact when the client asked not to be contacted', () => {
    const doNotContact = { reason: 'Lo pidió', recordedAt: '', recordedBy: 'Daniel' };
    expect(getClientContactLinks(client({ doNotContact }))).toEqual([]);
  });
});
