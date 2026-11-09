import { workspaceStorageKey } from './workspaceStorage';

/**
 * SCRUM-117: people who register results in a shared account.
 *
 * The list is managed in Configuración, one person is the primary (the default in every
 * "Responsable" field) and removing someone only deactivates them, so history keeps their name.
 * Supabase is the source of truth when configured; this browser copy keeps the app usable
 * offline and in local mode.
 */
export interface Responsible {
  id: string;
  name: string;
  isPrimary: boolean;
  active: boolean;
}

export const RESPONSIBLES_STORAGE_KEY = 'ingenya.responsibles.v1';
export const RESPONSIBLES_UPDATED_EVENT = 'ventro:responsibles-updated';
const MAX_NAME_LENGTH = 80;

const sameName = (a: string, b: string) =>
  a.trim().toLocaleLowerCase('es') === b.trim().toLocaleLowerCase('es');

function isResponsible(value: unknown): value is Responsible {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    record.name.trim().length > 0 &&
    typeof record.isPrimary === 'boolean' &&
    typeof record.active === 'boolean'
  );
}

export function loadResponsibles(): Responsible[] {
  try {
    const stored = localStorage.getItem(workspaceStorageKey(RESPONSIBLES_STORAGE_KEY));
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isResponsible) : [];
  } catch {
    return [];
  }
}

export function saveResponsibles(list: readonly Responsible[]): boolean {
  try {
    localStorage.setItem(workspaceStorageKey(RESPONSIBLES_STORAGE_KEY), JSON.stringify(list));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(RESPONSIBLES_UPDATED_EVENT));
    return true;
  } catch {
    return false;
  }
}

export const activeResponsibles = (list: readonly Responsible[]) =>
  list.filter((item) => item.active);

export function primaryResponsibleName(list: readonly Responsible[]): string {
  const active = activeResponsibles(list);
  return (active.find((item) => item.isPrimary) ?? active[0])?.name ?? '';
}

export type ResponsibleChange = { ok: true; list: Responsible[] } | { ok: false; error: string };

export function addResponsible(
  list: readonly Responsible[],
  name: string,
  createId: () => string = () => crypto.randomUUID(),
): ResponsibleChange {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed) return { ok: false, error: 'Escribí el nombre del responsable.' };
  if (trimmed.length > MAX_NAME_LENGTH)
    return { ok: false, error: `Usá un nombre de hasta ${MAX_NAME_LENGTH} caracteres.` };
  if (activeResponsibles(list).some((item) => sameName(item.name, trimmed)))
    return { ok: false, error: `${trimmed} ya está en la lista.` };
  const inactive = list.find((item) => !item.active && sameName(item.name, trimmed));
  const isFirst = activeResponsibles(list).length === 0;
  if (inactive)
    return {
      ok: true,
      list: list.map((item) =>
        item.id === inactive.id
          ? { ...item, name: trimmed, active: true, isPrimary: isFirst }
          : item,
      ),
    };
  return {
    ok: true,
    list: [...list, { id: createId(), name: trimmed, isPrimary: isFirst, active: true }],
  };
}

export function setPrimaryResponsible(list: readonly Responsible[], id: string): ResponsibleChange {
  const target = list.find((item) => item.id === id && item.active);
  if (!target) return { ok: false, error: 'Ese responsable ya no está en la lista.' };
  return { ok: true, list: list.map((item) => ({ ...item, isPrimary: item.id === id })) };
}

export function removeResponsible(list: readonly Responsible[], id: string): ResponsibleChange {
  const target = list.find((item) => item.id === id && item.active);
  if (!target) return { ok: false, error: 'Ese responsable ya no está en la lista.' };
  if (activeResponsibles(list).length === 1)
    return { ok: false, error: 'Tiene que quedar al menos un responsable.' };
  const next = list.map((item) =>
    item.id === id ? { ...item, active: false, isPrimary: false } : item,
  );
  if (target.isPrimary) {
    const firstActive = next.find((item) => item.active);
    return {
      ok: true,
      list: next.map((item) => (item.id === firstActive?.id ? { ...item, isPrimary: true } : item)),
    };
  }
  return { ok: true, list: next };
}

/**
 * First use: names already typed in the free-text field become the initial list, so nothing
 * recorded before SCRUM-117 is lost. The most used name becomes the primary.
 */
export function seedResponsiblesFromNames(
  names: readonly string[],
  createId: () => string = () => crypto.randomUUID(),
): Responsible[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const raw of names) {
    const name = raw?.trim().replace(/\s+/g, ' ');
    if (!name || name.length > MAX_NAME_LENGTH || /^(sin asignar|sistema local)$/i.test(name))
      continue;
    const key = name.toLocaleLowerCase('es');
    const current = counts.get(key);
    counts.set(key, { name: current?.name ?? name, count: (current?.count ?? 0) + 1 });
  }
  const ordered = [...counts.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'),
  );
  return ordered.map((item, index) => ({
    id: createId(),
    name: item.name,
    isPrimary: index === 0,
    active: true,
  }));
}

/**
 * Options for a "Responsable" select: active people, plus a legacy value so it is never lost.
 * Without a team list there are no options, so the field stays free text while the name is typed
 * (a typed "D" must not become the only choice and cut "Daniel" short).
 */
export function responsibleOptions(list: readonly Responsible[], current: string): string[] {
  const names = activeResponsibles(list).map((item) => item.name);
  if (!names.length) return [];
  const value = current.trim();
  if (value && !names.some((name) => sameName(name, value))) names.push(value);
  return names;
}

export const RESPONSIBLES_VERSION_STORAGE_KEY = 'ingenya.responsiblesVersion.v1';

/** Remote list version last seen on this device (null: never saved remotely). */
export function loadResponsiblesVersion(): number | null {
  try {
    const stored = localStorage.getItem(workspaceStorageKey(RESPONSIBLES_VERSION_STORAGE_KEY));
    const value = stored === null ? Number.NaN : Number(stored);
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function saveResponsiblesVersion(version: number | null): void {
  try {
    const key = workspaceStorageKey(RESPONSIBLES_VERSION_STORAGE_KEY);
    if (version === null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(version));
  } catch {
    // The remote list stays authoritative; a missing version only causes a conflict and reload.
  }
}
