import type { QuoteTotals } from '../utils/quoteCalculations';
import { currencyFormatter } from '../utils/quoteFormatting';

interface Props {
  totals: QuoteTotals;
  /** Label of the final amount, as each screen already calls it. */
  totalLabel: string;
  className: string;
}

/**
 * The total of a quote. With a discount it shows subtotal, discount and final total
 * ("Descuento 10% −$10.000"); without one, only the total, as before.
 */
export function QuoteTotalsBreakdown({ totals, totalLabel, className }: Props) {
  return (
    <footer className={className}>
      {totals.discountAmount > 0 && (
        <dl className="quote-totals-breakdown">
          <div>
            <dt>Subtotal</dt>
            <dd>{currencyFormatter.format(totals.subtotal)}</dd>
          </div>
          <div className="quote-totals-discount">
            <dt>{totals.discountLabel}</dt>
            <dd>−{currencyFormatter.format(totals.discountAmount)}</dd>
          </div>
        </dl>
      )}
      <span>{totalLabel}</span>
      <strong>{currencyFormatter.format(totals.total)}</strong>
    </footer>
  );
}
