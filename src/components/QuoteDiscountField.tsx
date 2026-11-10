import { useState } from 'react';
import type { QuoteDiscount } from '../types/quote';
import { formatNumberInput, parseLocaleNumber } from '../utils/localeNumber';
import { FieldError } from './FieldError';

interface Props {
  discount: QuoteDiscount | undefined;
  onChange: (discount: QuoteDiscount | undefined) => void;
  /** Rule error from the quote (percentage over 100%, amount over the subtotal). */
  error: string | null;
}

/** "Descuento" on the whole quote, as a percentage or a fixed amount (owner, 2026-11-09). */
export function QuoteDiscountField({ discount, onChange, error }: Props) {
  const [type, setType] = useState<QuoteDiscount['type']>(discount?.type ?? 'percent');
  const [text, setText] = useState(discount ? formatNumberInput(discount.value) : '');
  const [typingError, setTypingError] = useState('');
  const message = typingError || error || '';

  function apply(nextText: string, nextType: QuoteDiscount['type']) {
    if (!nextText.trim()) {
      setTypingError('');
      onChange(undefined);
      return;
    }
    const value = parseLocaleNumber(nextText);
    if (value === null || value < 0) {
      setTypingError('Ingresá solo números, por ejemplo 10 o 15.000.');
      return;
    }
    setTypingError('');
    onChange(value === 0 ? undefined : { type: nextType, value });
  }

  return (
    <div className="quote-discount-field">
      <label className="field" htmlFor="quote-discount">
        <span>Descuento</span>
        <span className="quote-discount-input">
          <input
            id="quote-discount"
            inputMode="decimal"
            placeholder="0"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              apply(event.target.value, type);
            }}
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? 'quote-discount-error' : 'quote-discount-hint'}
          />
          <span className="quote-discount-type" role="group" aria-label="Tipo de descuento">
            {(
              [
                ['percent', '%', 'Porcentaje'],
                ['amount', '$', 'Monto fijo'],
              ] as const
            ).map(([value, symbol, label]) => (
              <button
                key={value}
                type="button"
                aria-label={label}
                aria-pressed={type === value}
                className={type === value ? 'quote-discount-type-active' : ''}
                onClick={() => {
                  setType(value);
                  apply(text, value);
                }}
              >
                {symbol}
              </button>
            ))}
          </span>
        </span>
        {!message && (
          <small id="quote-discount-hint">
            {type === 'percent'
              ? 'Se recalcula si cambian los servicios.'
              : 'Queda fijo aunque cambien los servicios.'}
          </small>
        )}
        <FieldError id="quote-discount-error" message={message || undefined} />
      </label>
    </div>
  );
}
