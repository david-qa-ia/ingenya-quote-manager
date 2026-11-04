import { describe, expect, it } from 'vitest';
import type { ProspectImportRecovery } from './prospectImportTransaction';
import { getSystemHealthCards, getSystemHealthOperations } from './systemHealth';

const recovery: ProspectImportRecovery = {
  importKey: 'import-1',
  fileName: 'prospectos.csv',
  csv: 'name,company',
  config: {
    schedule: false,
    channel: 'email',
    dueAt: '',
    responsible: '',
    note: '',
  },
  prepared: { importKey: 'import-1', prospects: [], scheduledCount: 0 },
  phase: 'remoteConfirmed',
};

describe('system health', () => {
  it('shows the active remote workspace and configured backend as available', () => {
    const cards = getSystemHealthCards({
      workspaceName: 'Brio',
      validWorkspace: true,
      backendConfigured: true,
      hasSession: true,
      recovery: null,
    });

    expect(cards[0]).toMatchObject({ label: 'Espacio activo', title: 'Brio', tone: 'good' });
    expect(cards[1]).toMatchObject({ label: 'Backend', title: 'Sesión vigente', tone: 'good' });
    expect(cards[3]).toMatchObject({
      label: 'Importaciones',
      title: 'Sin recuperaciones',
      tone: 'good',
    });
    expect(getSystemHealthOperations(true)).toEqual([
      expect.objectContaining({ title: 'Prospectos e importación CSV', available: true }),
      expect.objectContaining({ title: 'Presupuestos y envíos', available: true }),
      expect.objectContaining({ title: 'Archivos adjuntos', available: false }),
    ]);
  });

  it('surfaces missing workspace access and a pending import recovery', () => {
    const cards = getSystemHealthCards({
      workspaceName: 'Brio',
      validWorkspace: false,
      backendConfigured: true,
      hasSession: false,
      recovery,
    });

    expect(cards[0]).toMatchObject({ label: 'Espacio activo', tone: 'attention' });
    expect(cards[1]).toMatchObject({
      label: 'Backend',
      title: 'Sesión pendiente',
      tone: 'attention',
    });
    expect(cards[3]).toMatchObject({
      label: 'Importaciones',
      title: 'Necesita recuperación',
      tone: 'attention',
    });
    expect(
      getSystemHealthOperations(false).every(
        (operation) => !operation.available || operation.title === 'Archivos adjuntos',
      ),
    ).toBe(true);
  });
});

describe('local mode is not reported as a fault (SCRUM-119)', () => {
  it('shows local mode as working, not as needing attention', () => {
    const cards = getSystemHealthCards({
      workspaceName: 'Ventro',
      validWorkspace: false,
      backendConfigured: false,
      hasSession: false,
      recovery: null,
    });
    expect(cards.map((card) => card.tone)).toEqual(['good', 'neutral', 'neutral', 'good']);
    expect(cards[1].title).toBe('Modo local');
    const operations = getSystemHealthOperations(false, false);
    expect(operations.map((operation) => operation.available)).toEqual([true, true, false]);
  });
});
