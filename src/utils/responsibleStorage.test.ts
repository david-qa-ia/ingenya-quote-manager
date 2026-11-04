import { describe, expect, it } from 'vitest';
import {
  addResponsible,
  primaryResponsibleName,
  removeResponsible,
  responsibleOptions,
  seedResponsiblesFromNames,
  setPrimaryResponsible,
  type Responsible,
} from './responsibleStorage';

let counter = 0;
const id = () => `r${++counter}`;
const unwrap = (change: ReturnType<typeof addResponsible>) => {
  if (!change.ok) throw new Error(change.error);
  return change.list;
};

describe('responsibles (SCRUM-117)', () => {
  it('makes the first person the primary and keeps a single primary', () => {
    let list: Responsible[] = [];
    list = unwrap(addResponsible(list, '  David ', id));
    list = unwrap(addResponsible(list, 'Daniel', id));
    expect(primaryResponsibleName(list)).toBe('David');
    list = unwrap(setPrimaryResponsible(list, list[1].id));
    expect(primaryResponsibleName(list)).toBe('Daniel');
    expect(list.filter((item) => item.isPrimary)).toHaveLength(1);
  });

  it('rejects empty and duplicate names, ignoring case and spaces', () => {
    const list = unwrap(addResponsible([], 'David', id));
    expect(addResponsible(list, '   ', id)).toEqual({
      ok: false,
      error: 'Escribí el nombre del responsable.',
    });
    expect(addResponsible(list, ' david ', id).ok).toBe(false);
  });

  it('removing someone deactivates them, keeps one primary and never empties the list', () => {
    let list = unwrap(addResponsible([], 'David', id));
    list = unwrap(addResponsible(list, 'Daniel', id));
    const david = list[0];
    list = unwrap(removeResponsible(list, david.id));
    expect(list.find((item) => item.id === david.id)).toMatchObject({ active: false });
    expect(primaryResponsibleName(list)).toBe('Daniel');
    expect(removeResponsible(list, list[1].id)).toEqual({
      ok: false,
      error: 'Tiene que quedar al menos un responsable.',
    });
  });

  it('re-adding a removed name reactivates the same record', () => {
    let list = unwrap(addResponsible([], 'David', id));
    list = unwrap(addResponsible(list, 'Daniel', id));
    const danielId = list[1].id;
    list = unwrap(removeResponsible(list, danielId));
    list = unwrap(addResponsible(list, 'daniel', id));
    expect(list).toHaveLength(2);
    expect(list[1]).toMatchObject({ id: danielId, active: true });
  });

  it('seeds the list from names already typed, most used first, skipping placeholders', () => {
    const list = seedResponsiblesFromNames(
      ['Daniel', 'David', 'david', ' David ', 'Sin asignar', 'Sistema local', ''],
      id,
    );
    expect(list.map((item) => item.name)).toEqual(['David', 'Daniel']);
    expect(primaryResponsibleName(list)).toBe('David');
  });

  it('keeps a legacy value visible in the options', () => {
    const list = unwrap(addResponsible([], 'David', id));
    expect(responsibleOptions(list, 'Ana')).toEqual(['David', 'Ana']);
    expect(responsibleOptions(list, 'david')).toEqual(['David']);
  });
});
