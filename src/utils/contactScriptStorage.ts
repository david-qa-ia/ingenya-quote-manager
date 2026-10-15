import type { ContactScriptTemplate, ContactScriptVariable } from '../types/contactScript';
import { loadCollection, saveCollectionItem } from './localCollectionStorage';

export const CONTACT_SCRIPTS_STORAGE_KEY = 'ingenya.contactScripts.v1';
export const contactScriptVariables: ContactScriptVariable[] = [
  'cliente',
  'oportunidad',
  'servicio',
  'presupuesto',
  'total',
  'responsable',
  'proximaAccion',
];
const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const isIso = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

export function getContactScriptTokenErrors(content: string): string[] {
  const errors: string[] = [];
  if (!content.trim()) errors.push('El contenido no puede estar vacío.');
  const rest = content.replace(/{{\s*[a-zA-Z]+\s*}}/g, '');
  if (rest.includes('{{') || rest.includes('}}')) errors.push('Hay una variable sin cerrar.');
  for (const match of content.matchAll(/{{\s*([^}]+)\s*}}/g)) {
    if (!contactScriptVariables.includes(match[1].trim() as ContactScriptVariable))
      errors.push(`La variable {{${match[1].trim()}}} no está permitida.`);
  }
  return [...new Set(errors)];
}
export function getContactScriptVariables(content: string): ContactScriptVariable[] {
  return [
    ...new Set(
      [...content.matchAll(/{{\s*([^}]+)\s*}}/g)]
        .map((match) => match[1].trim())
        .filter((value): value is ContactScriptVariable =>
          contactScriptVariables.includes(value as ContactScriptVariable),
        ),
    ),
  ];
}
export function isContactScriptTemplate(value: unknown): value is ContactScriptTemplate {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    isText(item.id) &&
    isText(item.name) &&
    (item.channel === 'call' || item.channel === 'whatsapp') &&
    typeof item.content === 'string' &&
    getContactScriptTokenErrors(item.content).length === 0 &&
    Array.isArray(item.variables) &&
    item.variables.every((variable) =>
      contactScriptVariables.includes(variable as ContactScriptVariable),
    ) &&
    JSON.stringify([...item.variables].sort()) ===
      JSON.stringify([...getContactScriptVariables(item.content)].sort()) &&
    (item.status === 'active' || item.status === 'archived') &&
    isText(item.createdBy) &&
    isIso(item.createdAt) &&
    isIso(item.updatedAt) &&
    Number.isInteger(item.version) &&
    (item.version as number) > 0
  );
}
export const loadContactScripts = () =>
  loadCollection(CONTACT_SCRIPTS_STORAGE_KEY, isContactScriptTemplate);
export const saveContactScript = (template: ContactScriptTemplate) =>
  saveCollectionItem(
    CONTACT_SCRIPTS_STORAGE_KEY,
    structuredClone(template),
    isContactScriptTemplate,
  );
