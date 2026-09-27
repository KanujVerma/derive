/** Pure provider-neutral proposals. No provider, image IO, client or fixture imports. */
export type ExtractionEvidenceRole = 'front_label' | 'ingredients' | 'packaging';
export type ExtractionAbstentionReason = 'unreadable' | 'unsupported' | 'conflicting_evidence' | 'no_product_evidence';
export interface ExtractedNumberCandidate {
  /** Literal observations, not inferred/normalized concentrations. */
  text: string;
  unitText: string;
  contextText: string;
}
export interface ProductEvidenceExtractionCandidate {
  schemaVersion: 1;
  /** Opaque evidence binding, never a path or signed URL. */
  evidenceId: string;
  role: ExtractionEvidenceRole;
  outcome: 'candidate' | 'abstained';
  abstentionReason?: ExtractionAbstentionReason;
  barcodeText?: string;
  brandText?: string;
  productNameText?: string;
  variantText?: string;
  regionText?: string;
  labelText?: string;
  orderedIngredients?: string[];
  numbers?: ExtractedNumberCandidate[];
}
export interface ExtractionEvidenceBinding { evidenceId: string; role: ExtractionEvidenceRole }
export interface ExtractionCandidateResolverEvidence { labelText?: string; ingredientList?: string[] }
const roles = ['front_label', 'ingredients', 'packaging'];
const reasons = ['unreadable', 'unsupported', 'conflicting_evidence', 'no_product_evidence'];
const textFields = ['barcodeText', 'brandText', 'productNameText', 'variantText', 'regionText', 'labelText'] as const;
const fields = ['schemaVersion', 'evidenceId', 'role', 'outcome', 'abstentionReason', ...textFields, 'orderedIngredients', 'numbers'];
export const EXTRACTION_LIMITS = Object.freeze({ fieldText: 4096, ingredientText: 300, numberText: 300,
  ingredients: 300, numbers: 100, totalText: 16384 });
/** Stable error excludes raw output, provider messages and private context. */
export class ProductEvidenceExtractionError extends Error {
  readonly code = 'INVALID_EXTRACTION_OUTPUT';
  constructor() { super('Product evidence extraction could not be confirmed'); }
}
function reject(): never { throw new ProductEvidenceExtractionError(); }
/** Inspect own data descriptors: no inherited fields, symbols or accessors. */
function dataObject(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return reject();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return reject();
  const copy: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string' || !allowed.includes(key)) return reject();
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) return reject();
    copy[key] = descriptor.value;
  }
  return copy;
}
function dataArray(value: unknown, limit: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype
    || value.length === 0 || value.length > limit || Reflect.ownKeys(value).length !== value.length + 1) return reject();
  const copy: unknown[] = [];
  for (let index = 0; index < value.length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) return reject();
    copy.push(descriptor.value);
  }
  return copy;
}
/** Expected binding comes from the server's authorized evidence, not model output. */
export function parseProductEvidenceExtraction(value: unknown, expected: ExtractionEvidenceBinding): ProductEvidenceExtractionCandidate {
  try {
    const binding = dataObject(expected, ['evidenceId', 'role']);
    if (typeof binding.evidenceId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(binding.evidenceId)
      || !roles.includes(binding.role as string)) return reject();
    const source = dataObject(value, fields);
    if (source.schemaVersion !== 1 || source.evidenceId !== binding.evidenceId || source.role !== binding.role
      || !['candidate', 'abstained'].includes(source.outcome as string)) return reject();
    let total = 0;
    const literal = (input: unknown, max: number): string => {
      if (typeof input !== 'string' || !input.trim() || input.length > max
        || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input)
        || /(?:file|ph|content|https?):\/\/|(?:^|\s)\/(?:Users|private|tmp|var|home)\/|[a-f0-9-]{36}\/(?:free_scan|front_label|ingredients|packaging)\//i.test(input)) return reject();
      total += input.length;
      if (total > EXTRACTION_LIMITS.totalText) return reject();
      return input;
    };
    const result: ProductEvidenceExtractionCandidate = { schemaVersion: 1, evidenceId: binding.evidenceId,
      role: binding.role as ExtractionEvidenceRole, outcome: source.outcome as 'candidate' | 'abstained' };
    const observations = [...textFields, 'orderedIngredients', 'numbers'];
    if (source.outcome === 'abstained') {
      if (!reasons.includes(source.abstentionReason as string) || observations.some(field => Object.hasOwn(source, field))) return reject();
      result.abstentionReason = source.abstentionReason as ExtractionAbstentionReason;
      return result;
    }
    if (Object.hasOwn(source, 'abstentionReason') && source.abstentionReason !== undefined) return reject();
    if (!observations.some(field => Object.hasOwn(source, field) && source[field] !== undefined)) return reject();
    for (const field of textFields) if (Object.hasOwn(source, field)) result[field] = literal(source[field], EXTRACTION_LIMITS.fieldText);
    if (Object.hasOwn(source, 'orderedIngredients')) result.orderedIngredients = dataArray(source.orderedIngredients, EXTRACTION_LIMITS.ingredients)
      .map(item => literal(item, EXTRACTION_LIMITS.ingredientText));
    if (Object.hasOwn(source, 'numbers')) result.numbers = dataArray(source.numbers, EXTRACTION_LIMITS.numbers).map(item => {
      const number = dataObject(item, ['text', 'unitText', 'contextText']);
      return { text: literal(number.text, EXTRACTION_LIMITS.numberText), unitText: literal(number.unitText, EXTRACTION_LIMITS.numberText),
        contextText: literal(number.contextText, EXTRACTION_LIMITS.numberText) };
    });
    return result;
  } catch { return reject(); }
}
/** Revalidate before projection. No authoritative barcode, typed identity or concentration fields. */
export function projectProductEvidenceExtraction(value: unknown, expected: ExtractionEvidenceBinding): ExtractionCandidateResolverEvidence {
  const candidate = parseProductEvidenceExtraction(value, expected);
  if (candidate.outcome === 'abstained') return {};
  return {
    labelText: [candidate.labelText, candidate.brandText, candidate.productNameText, candidate.variantText, candidate.regionText, candidate.barcodeText]
      .filter(part => part !== undefined).join(' ') || undefined,
    ingredientList: candidate.orderedIngredients ? [...candidate.orderedIngredients] : undefined,
  };
}
