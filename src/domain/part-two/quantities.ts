/** Bounded decimal arithmetic preserves every printed digit; no IEEE754 values. */
export function compareDecimalStrings(left: string, right: string): number {
  const parts = (value: string) => { const [integer, fraction = ''] = value.split('.'); return { integer: integer.replace(/^0+(?=\d)/, ''), fraction: fraction.replace(/0+$/, '') }; };
  const a = parts(left), b = parts(right);
  if (a.integer.length !== b.integer.length) return a.integer.length < b.integer.length ? -1 : 1;
  if (a.integer !== b.integer) return a.integer < b.integer ? -1 : 1;
  const width = Math.max(a.fraction.length, b.fraction.length), af = a.fraction.padEnd(width, '0'), bf = b.fraction.padEnd(width, '0');
  return af === bf ? 0 : af < bf ? -1 : 1;
}
export function mgPerGramToPercent(value: string): string {
  const digits = value.replace('.', ''), scale = value.includes('.') ? value.length - value.indexOf('.') - 1 : 0, padded = digits.padStart(scale + 2, '0');
  return `${padded.slice(0, -(scale + 1))}.${padded.slice(-(scale + 1))}`.replace(/0+$/, '').replace(/\.$/, '').replace(/^0+(?=\d)/, '');
}
type QuantityMeaning = { span: { raw: string }; value: string | null; min: string | null; max: string | null; operator: string; unit: string; basis: string; status: string; convertedPercentWw: string | null };
/** Supported interpreted quantities must agree with their own exact literal. */
export function quantityValidationIssue(q: QuantityMeaning): string | null {
  if (q.status !== 'parsed' && q.status !== 'validated') return null;
  const m = q.span.raw.match(/^(?:(about|approximately|approx\.)\s*)?([<>≤≥])?\s*(-?\d+(?:[.,]\d+)?)(?:\s*([-–])\s*(\d+(?:[.,]\d+)?))?\s*(%|mg\s*\/\s*(?:g|mL))(?:\s*(w\/w|w\/v))?$/i);
  if (!m) return 'unsupported_interpreted_quantity_literal';
  const [, approximation, op, value, range, maximum, rawUnit, rawBasis] = m;
  if (q.span.raw.includes(',') || value.startsWith('-') || (range && (op || approximation)) || (approximation && op)) return 'uncertain_interpreted_quantity';
  const operator = range ? 'range' : approximation ? 'approximate' : op ? ({ '<': 'less_than', '≤': 'less_than_or_equal', '>': 'greater_than', '≥': 'greater_than_or_equal' } as Record<string,string>)[op] : 'exact';
  const unit = rawUnit === '%' ? '%' : rawUnit.replace(/\s/g,'').toLowerCase() === 'mg/g' ? 'mg/g' : 'mg/mL';
  const basis = unit === 'mg/g' ? 'w/w' : unit === 'mg/mL' ? 'w/v' : rawBasis?.toLowerCase() ?? 'unknown';
  if (rawBasis && rawBasis.toLowerCase() !== basis) return 'quantity_unit_basis_conflict';
  if (q.operator !== operator || q.value !== (range ? null : value) || q.min !== (range ? value : null) || q.max !== (maximum ?? null) || q.unit !== unit || q.basis !== basis) return 'quantity_meaning_differs_from_literal';
  if ((range && compareDecimalStrings(value, maximum) > 0) || (unit === '%' && compareDecimalStrings(maximum ?? value, '100') > 0) || (unit === 'mg/g' && compareDecimalStrings(maximum ?? value, '1000') > 0)) return 'quantity_outside_exact_bounds';
  if (q.status !== (unit !== '%' || basis !== 'unknown' ? 'validated' : 'parsed')) return 'quantity_validation_state_differs_from_basis';
  const converted = unit === 'mg/g' && operator === 'exact' ? mgPerGramToPercent(value) : null;
  if (q.convertedPercentWw !== converted) return 'unsupported_quantity_conversion';
  return null;
}
