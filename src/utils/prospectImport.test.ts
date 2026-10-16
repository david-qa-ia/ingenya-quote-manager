import { describe, expect, it } from 'vitest';
import type { Prospect } from '../types/prospect';
import { parseCsvLine, previewProspectCsv } from './prospectImport';

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
});
