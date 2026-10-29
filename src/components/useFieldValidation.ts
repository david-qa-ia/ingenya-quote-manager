import { useCallback, useRef, useState } from 'react';

type FieldElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * Shared behavior for field-level validation (SCRUM-107):
 * - an error is shown once the user leaves the field or tries to save, never before;
 * - errors are derived from the current values, so a message disappears as soon as the
 *   value is corrected;
 * - a failed save attempt moves the focus to the first invalid field.
 * The caller keeps its own validation rules and passes the current errors on each render.
 */
export function useFieldValidation<F extends string>(
  idPrefix: string,
  errors: Partial<Record<F, string>>,
  order: readonly F[],
) {
  const [touched, setTouched] = useState<Partial<Record<F, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const elements = useRef<Partial<Record<F, FieldElement | null>>>({});

  const visibleError = (field: F) => (submitted || touched[field] ? errors[field] : undefined);
  const errorId = (field: F) => `${idPrefix}-${field}-error`;

  const fieldProps = (field: F) => {
    const message = visibleError(field);
    return {
      ref: (element: FieldElement | null) => {
        elements.current[field] = element;
      },
      onBlur: () => setTouched((current) => ({ ...current, [field]: true })),
      'aria-invalid': message ? true : undefined,
      'aria-describedby': message ? errorId(field) : undefined,
    };
  };

  /** Returns true when the form can be saved; otherwise shows every error and focuses the first. */
  const validateForSubmit = (): boolean => {
    const firstInvalid = order.find((field) => errors[field]);
    if (!firstInvalid) return true;
    setSubmitted(true);
    // Wait for the messages to render before moving the focus.
    window.requestAnimationFrame(() => elements.current[firstInvalid]?.focus());
    return false;
  };

  const reset = useCallback(() => {
    setTouched({});
    setSubmitted(false);
  }, []);

  return { visibleError, errorId, fieldProps, validateForSubmit, reset };
}
