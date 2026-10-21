import { describe, expect, it } from 'vitest';
import type { Prospect } from '../types/prospect';
import {
  analyzeProspectCsv,
  argentinaDateTimeToIso,
  hasUsableContact,
  parseCsvLine,
  previewProspectCsv,
} from './prospectImport';

const existing: Prospect = {
  id: 'p1',
  name: 'Ana',
  company: 'Sur',
  phone: '3415550101',
  email: 'ana@sur.com',
  source: '',
  potentialService: '',
  notes: '',
  status: 'uncontacted',
  priority: 'medium',
  priorityReason: 'Manual',
  nextAction: '',
  nextActionAt: '',
  responsible: '',
  preferredChannel: '',
  activities: [],
  createdAt: '2026-10-15T00:00:00Z',
  updatedAt: '2026-10-15T00:00:00Z',
};

describe('prospect CSV import', () => {
  it('previews valid, invalid and duplicate rows before any write', () => {
    const rows = previewProspectCsv(
      'nombre,empresa,teléfono,email\nBea,Norte,3415550202,bea@norte.com\nSin teléfono,Norte,12,no\nAna,Sur,3415550101,ana@sur.com',
      [existing],
    );
    expect(rows).toHaveLength(3);
    expect(rows[0].reason).toBeUndefined();
    expect(rows[1].reason).toContain('teléfono');
    expect(rows[2].duplicate).toBe(true);
  });
  it('parses the required English headers and quoted values without a dependency', () => {
    const rows = previewProspectCsv(
      'name,company,phone,email,source,potentialService,notes\nBea,"Norte, SA",3415550202,bea@norte.com,Web,"Pintura, interior","Llamar luego"',
      [],
    );
    expect(rows[0].input).toMatchObject({
      name: 'Bea',
      company: 'Norte, SA',
      potentialService: 'Pintura, interior',
    });
    expect(parseCsvLine('"a""b",c', ',')).toEqual(['a"b', 'c']);
  });
  it('rejects empty files and incorrect headers before import', () => {
    expect(analyzeProspectCsv('', []).headerError).toContain('vacío');
    expect(analyzeProspectCsv('company,email\nSur,ana@sur.com', []).headerError).toContain(
      'encabezados',
    );
  });
  it('calculates compatible contacts for the selected channel only', () => {
    const input = {
      name: 'Ana',
      company: '',
      phone: '341 555 0101',
      email: 'ana@sur.com',
      source: '',
      potentialService: '',
      notes: '',
      status: 'uncontacted' as const,
      priority: 'medium' as const,
      priorityReason: '',
      nextAction: '',
      nextActionAt: '',
      responsible: '',
      preferredChannel: '' as const,
    };
    expect(hasUsableContact(input, 'phone')).toBe(true);
    expect(hasUsableContact({ ...input, phone: '' }, 'whatsapp')).toBe(false);
    expect(hasUsableContact({ ...input, email: 'none' }, 'email')).toBe(false);
  });
  it('stores selected Argentina time as a stable instant', () => {
    expect(argentinaDateTimeToIso('2026-10-21T10:00')).toEqual({
      ok: true,
      value: '2026-10-21T13:00:00.000Z',
    });
    expect(argentinaDateTimeToIso('2026-02-30T10:00').ok).toBe(false);
  });
});
