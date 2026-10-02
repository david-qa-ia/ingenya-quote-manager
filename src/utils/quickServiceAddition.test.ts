import { describe, expect, it, vi } from 'vitest';
import { addQuickService } from './quickServiceAddition';

const input = {
  name: 'Reparar revoque',
  description: 'Sector exterior',
  unit: 'squareMeter' as const,
  quantity: 2,
  unitPrice: 15000,
};

describe('addQuickService', () => {
  it('adds only a manual quote line when catalog saving is not selected', () => {
    const persist = vi.fn();
    const result = addQuickService([], input, false, persist, () => 'line-1');
    expect(result).toMatchObject({ success: true, catalogJobs: null, line: { source: 'manual' } });
    expect(persist).not.toHaveBeenCalled();
  });

  it('persists the catalog before returning the catalog quote line', () => {
    const events: string[] = [];
    const ids = ['job-1', 'line-1'];
    const result = addQuickService(
      [],
      input,
      true,
      () => {
        events.push('persisted');
        return true;
      },
      () => ids.shift()!,
    );
    if (result.success) events.push('line-returned');
    expect(events).toEqual(['persisted', 'line-returned']);
    expect(result).toMatchObject({
      success: true,
      line: { catalogJobId: 'job-1', source: 'catalog' },
      catalogJobs: [{ id: 'job-1', isActive: true }],
    });
  });

  it('returns no line when catalog persistence fails', () => {
    expect(
      addQuickService(
        [],
        input,
        true,
        () => false,
        () => 'id',
      ),
    ).toEqual({
      success: false,
      message: 'No se pudo guardar el servicio en el catálogo. No se agregó al presupuesto.',
    });
  });

  it('allows a zero-price line only when it is not saved to the catalog', () => {
    expect(
      addQuickService(
        [],
        { ...input, unitPrice: 0 },
        false,
        () => true,
        () => 'line',
      ),
    ).toMatchObject({ success: true, line: { unitPrice: 0 } });
    expect(
      addQuickService(
        [],
        { ...input, unitPrice: 0 },
        true,
        () => true,
        () => 'id',
      ),
    ).toMatchObject({ success: false });
  });
});
