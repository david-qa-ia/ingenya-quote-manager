/**
 * SCRUM-117: numbers typed the Argentine way.
 *
 * People write "12,5" (decimal comma) and "120.000" or "1.250,50" (dot as thousands
 * separator). A native number input reads "12,5" as 125 and "120.000" as 120, which
 * silently multiplies or divides quote totals. Amount fields therefore use text inputs
 * and this parser, which returns `null` instead of guessing when the text is unclear.
 *
 * Rules:
 * - Spaces and a leading "$" are ignored.
 * - Comma and dot together: the last one is the decimal separator ("1.250,50" and
 *   "1,250.50" are both 1250.5).
 * - Only commas: a single comma is the decimal separator ("12,5" is 12.5); several
 *   commas are thousands separators ("1,250,000").
 * - Only dots: several dots, or one dot followed by exactly three digits, are thousands
 *   separators ("120.000" is 120000); otherwise the dot is decimal ("12.5" is 12.5,
 *   and "0.125" stays 0.125 because a group cannot start with zero alone).
 * - Thousands groups must have three digits, so "12.34.5" is rejected.
 */
export function parseLocaleNumber(text: string): number | null {
  const cleaned = text.replace(/\s/g, '').replace(/^\$/, '');
  if (cleaned === '') return null;
  const negative = cleaned.startsWith('-');
  const body = negative ? cleaned.slice(1) : cleaned;
  if (!/^[\d.,]+$/.test(body) || !/\d/.test(body)) return null;

  const lastDot = body.lastIndexOf('.');
  const lastComma = body.lastIndexOf(',');
  let integerPart = body;
  let decimalPart = '';
  let thousands: '.' | ',' | null = null;

  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSeparator = lastDot > lastComma ? '.' : ',';
    thousands = decimalSeparator === '.' ? ',' : '.';
    const index = body.lastIndexOf(decimalSeparator);
    integerPart = body.slice(0, index);
    decimalPart = body.slice(index + 1);
    if (integerPart.includes(decimalSeparator)) return null;
  } else if (lastComma >= 0 || lastDot >= 0) {
    const separator = lastComma >= 0 ? ',' : '.';
    const count = body.split(separator).length - 1;
    const afterLast = body.slice(body.lastIndexOf(separator) + 1);
    const isThousands =
      count > 1 ||
      (separator === '.' && afterLast.length === 3 && !/^0*\./.test(body) && body.indexOf('.') > 0);
    if (isThousands) {
      thousands = separator;
    } else {
      const index = body.lastIndexOf(separator);
      integerPart = body.slice(0, index);
      decimalPart = body.slice(index + 1);
    }
  }

  if (thousands) {
    const groups = integerPart.split(thousands);
    if (
      groups.some((group, index) =>
        index === 0 ? !/^\d{1,3}$/.test(group) : !/^\d{3}$/.test(group),
      )
    )
      return null;
    integerPart = groups.join('');
  }
  if (integerPart === '') integerPart = '0';
  if (!/^\d+$/.test(integerPart) || !/^\d*$/.test(decimalPart)) return null;

  const value = Number(`${integerPart}.${decimalPart || '0'}`);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

const inputFormatter = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 4,
  useGrouping: true,
});

/** Formats a stored number for an editable amount field, the way it would be typed ("12,5", "30.000"). */
export function formatNumberInput(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '';
  return inputFormatter.format(value);
}
