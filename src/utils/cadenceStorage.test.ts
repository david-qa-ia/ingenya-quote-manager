import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CADENCE_TEMPLATES_STORAGE_KEY,
  loadCadenceTemplates,
  saveCadenceTemplate,
} from './cadenceStorage';

const stored = new Map<string, string>();
const template = {
  id: 'template',
  name: 'Seguimiento',
  description: '',
  status: 'active' as const,
  createdAt: '2026-10-14T00:00:00.000Z',
  updatedAt: '2026-10-14T00:00:00.000Z',
  steps: [
    {
      id: 'step',
      order: 1,
      channel: 'call' as const,
      description: 'Llamar',
      waitAmount: 1,
      waitUnit: 'hours' as const,
      responsible: 'Daniel',
      status: 'active' as const,
    },
  ],
};
beforeEach(() => {
  stored.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());
describe('cadence storage', () => {
  it('rejects empty or invalid waits and retains valid entries in a mixed collection', () => {
    expect(saveCadenceTemplate({ ...template, steps: [] })).toBe(false);
    expect(
      saveCadenceTemplate({ ...template, steps: [{ ...template.steps[0], waitAmount: 0 }] }),
    ).toBe(false);
    stored.set(CADENCE_TEMPLATES_STORAGE_KEY, JSON.stringify([{ id: 'bad' }, template]));
    expect(loadCadenceTemplates()).toEqual({ items: [template], issue: 'invalid-entries' });
  });
  it('does not overwrite a corrupt root', () => {
    stored.set(CADENCE_TEMPLATES_STORAGE_KEY, '{bad');
    expect(saveCadenceTemplate(template)).toBe(false);
    expect(stored.get(CADENCE_TEMPLATES_STORAGE_KEY)).toBe('{bad');
  });
});
