import { useEffect, type ReactNode, type SelectHTMLAttributes } from 'react';
import { useResponsibles } from '../utils/useResponsibles';
import {
  hasSingleResponsible,
  primaryResponsibleName,
  responsibleOptions,
} from '../utils/responsibleStorage';
import type React from 'react';

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> & {
  value: string;
  onChange: (value: string) => void;
  /** Fill an empty value with the primary responsible (default true). */
  defaultToPrimary?: boolean;
  ref?: React.Ref<HTMLSelectElement & HTMLInputElement>;
};

/**
 * SCRUM-117: "Responsable" is chosen from the team list managed in Configuración. It starts
 * with the primary person and changes with one click. Without a list (first run, before anyone
 * is added) it falls back to a text field so nothing blocks the user.
 */
export function ResponsibleSelect({
  value,
  onChange,
  defaultToPrimary = true,
  disabled,
  ...rest
}: Props) {
  const list = useResponsibles();
  const primary = primaryResponsibleName(list);
  const options = responsibleOptions(list, value);

  useEffect(() => {
    if (defaultToPrimary && !value.trim() && primary) onChange(primary);
  }, [defaultToPrimary, value, primary, onChange]);

  if (!options.length)
    return (
      <input
        {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Agregá responsables en Configuración"
      />
    );

  return (
    <select
      {...rest}
      value={value.trim() ? (options.find((name) => sameName(name, value)) ?? value) : ''}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      {!value.trim() && <option value="">Elegí un responsable</option>}
      {options.map((name) => (
        <option key={name} value={name}>
          {name}
          {name === primary ? ' (principal)' : ''}
        </option>
      ))}
    </select>
  );
}

const sameName = (a: string, b: string) =>
  a.trim().toLocaleLowerCase('es') === b.trim().toLocaleLowerCase('es');

/**
 * A "Responsable" (or "Autor") field. While the team has a single person it is hidden and
 * filled with that person, since there is nobody else to pick (one shared user).
 */
export function ResponsibleField({
  label,
  error,
  defaultToPrimary = true,
  ...props
}: Props & { label: string; error?: ReactNode }) {
  const single = hasSingleResponsible(useResponsibles());
  const select = <ResponsibleSelect {...props} defaultToPrimary={single || defaultToPrimary} />;
  if (single) return <div hidden>{select}</div>;
  return (
    <label className="field">
      <span>{label}</span>
      {select}
      {error}
    </label>
  );
}
