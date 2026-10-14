import { describe, expect, it } from 'vitest';
import { getSidebarTabAfterKey, quoteSidebarTabs } from '../utils/quoteSidebarTabs';

describe('quote sidebar tabs', () => {
  it('keeps the three commercial areas available in a stable order', () => {
    expect(quoteSidebarTabs).toEqual([
      { id: 'summary', label: 'Resumen' },
      { id: 'activities', label: 'Actividades' },
      { id: 'commercialStatus', label: 'Estado comercial' },
    ]);
  });

  it('supports cyclic arrow-key navigation and Home/End shortcuts', () => {
    expect(getSidebarTabAfterKey('summary', 'ArrowRight')).toBe('activities');
    expect(getSidebarTabAfterKey('summary', 'ArrowLeft')).toBe('commercialStatus');
    expect(getSidebarTabAfterKey('activities', 'Home')).toBe('summary');
    expect(getSidebarTabAfterKey('activities', 'End')).toBe('commercialStatus');
    expect(getSidebarTabAfterKey('summary', 'Tab')).toBeNull();
  });
});
