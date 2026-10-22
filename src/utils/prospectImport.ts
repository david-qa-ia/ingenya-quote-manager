import type { Prospect, ProspectInput } from '../types/prospect';
import { getProspectValidationError, normalizeProspectInput } from './prospectStorage';
import { isDuplicateProspect } from './prospectWorkflow';

export interface ProspectImportRow {
  line: number;
  input: ProspectInput;
  reason?: string;
  duplicate?: boolean;
}
export interface ProspectCsvPreview {
  rows: ProspectImportRow[];
  headerError?: string;
}
export type FirstContactChannel = 'phone' | 'whatsapp' | 'email';
const headerMap: Record<string, keyof ProspectInput> = {
  nombre: 'name',
  name: 'name',
  empresa: 'company',
  company: 'company',
  telefono: 'phone',
  teléfono: 'phone',
  phone: 'phone',
  email: 'email',
  fuente: 'source',
  source: 'source',
  servicio: 'potentialService',
  'servicio potencial': 'potentialService',
  potentialservice: 'potentialService',
  observaciones: 'notes',
  notas: 'notes',
  notes: 'notes',
  prioridad: 'priority',
  canal: 'preferredChannel',
  estado: 'status',
  'proxima accion': 'nextAction',
  'próxima acción': 'nextAction',
  fecha: 'nextActionAt',
  responsable: 'responsible',
};
const blankInput = (): ProspectInput => ({
  name: '',
  company: '',
  phone: '',
  email: '',
  instagram: '',
  source: '',
  potentialService: '',
  notes: '',
  status: 'uncontacted',
  priority: 'medium',
  priorityReason: 'Prioridad manual',
  nextAction: '',
  nextActionAt: '',
  responsible: '',
  preferredChannel: '',
});

export function parseCsvLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      values.push(value);
      value = '';
    } else value += character;
  }
  values.push(value);
  return values;
}
export function analyzeProspectCsv(csv: string, existing: readonly Prospect[]): ProspectCsvPreview {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { rows: [], headerError: 'El archivo CSV está vacío.' };
  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = parseCsvLine(lines[0], delimiter).map(
    (value) => headerMap[value.trim().toLocaleLowerCase('es')],
  );
  if (!headers.includes('name') || headers.every((header) => !header))
    return {
      rows: [],
      headerError:
        'El CSV debe incluir los encabezados: name, company, phone, email, source, potentialService y notes.',
    };
  const accepted: Prospect[] = [];
  const rows = lines.slice(1).map((line, index) => {
    const input = blankInput();
    parseCsvLine(line, delimiter).forEach((value, position) => {
      const key = headers[position];
      if (key) (input[key] as string) = value.trim();
    });
    const normalized = normalizeProspectInput(input);
    const reason = getProspectValidationError(normalized);
    const duplicate = !reason && isDuplicateProspect(normalized, [...existing, ...accepted]);
    if (!reason && !duplicate)
      accepted.push({
        ...normalized,
        id: `preview-${index}`,
        activities: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    return {
      line: index + 2,
      input: normalized,
      ...(reason ? { reason } : {}),
      ...(duplicate ? { duplicate: true } : {}),
    };
  });
  return { rows };
}

export function previewProspectCsv(
  csv: string,
  existing: readonly Prospect[],
): ProspectImportRow[] {
  return analyzeProspectCsv(csv, existing).rows;
}

export function hasUsableContact(input: ProspectInput, channel: FirstContactChannel): boolean {
  if (channel === 'email')
    return (
      Boolean(input.email) &&
      input.email !== 'none' &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)
    );
  return (
    Boolean(input.phone) &&
    /^\d{7,15}$/.test(input.phone.replace(/\D/g, '')) &&
    input.phone !== '1111111111'
  );
}

export function argentinaDateTimeToIso(
  value: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return { ok: false, error: 'Elegí una fecha y hora válida.' };
  const [, rawYear, rawMonth, rawDay, rawHour, rawMinute] = match;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  const check = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute
  )
    return { ok: false, error: 'Elegí una fecha y hora válida.' };
  return { ok: true, value: new Date(`${value}:00-03:00`).toISOString() };
}
