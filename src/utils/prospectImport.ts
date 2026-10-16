import type { Prospect, ProspectInput } from '../types/prospect';
import { getProspectValidationError, normalizeProspectInput } from './prospectStorage';
import { isDuplicateProspect } from './prospectWorkflow';

export interface ProspectImportRow {
  line: number;
  input: ProspectInput;
  reason?: string;
  duplicate?: boolean;
}
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
export function previewProspectCsv(
  csv: string,
  existing: readonly Prospect[],
): ProspectImportRow[] {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = parseCsvLine(lines[0], delimiter).map(
    (value) => headerMap[value.trim().toLocaleLowerCase('es')],
  );
  const accepted: Prospect[] = [];
  return lines.slice(1).map((line, index) => {
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
}
