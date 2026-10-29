import { UiIcon } from './UiIcon';

/**
 * Field-level validation message (SCRUM-107). Rendered under the field it describes and
 * referenced from the field through aria-describedby; the icon and text keep the error
 * understandable without relying on color.
 */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span id={id} className="field-error">
      <UiIcon name="x-circle" />
      {message}
    </span>
  );
}
