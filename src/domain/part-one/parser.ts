import type { DeclarationEntry, DeclarationSection, EvidenceSpan } from '../../contracts/PartOne.ts';

export const DECLARATION_PARSER_VERSION = 'part-one-spans-1';
export const DECLARATION_ALIAS_VERSION = 'observed-only-1';
export type SectionParseInput = {
  sectionId: string; observationId: string; imageId: string | null; sourceRevision: number;
  rawText: string; sourceOffset: number; kind: DeclarationSection['kind'];
  startCovered: boolean; endCovered: boolean; lineCoverageComplete: boolean;
  entryId: (order: number) => string; uncertaintyReasons?: string[];
};
/** Normalize only for later review, retaining an offset map; raw declarations never change. */
export function normalizeWithOffsets(raw: string, sourceOffset = 0): { text: string; mapping: EvidenceSpan['transformation'] } {
  const mapping: EvidenceSpan['transformation'] = [];
  let text = '';
  for (let i = 0; i < raw.length;) {
    const start = i;
    const point = String.fromCodePoint(raw.codePointAt(i)!);
    i += point.length;
    while (i < raw.length && /\p{M}/u.test(String.fromCodePoint(raw.codePointAt(i)!))) i += String.fromCodePoint(raw.codePointAt(i)!).length;
    let normalized = raw.slice(start, i).normalize('NFC');
    if (/^\s+$/u.test(normalized)) {
      while (i < raw.length && /\s/u.test(raw[i])) i++;
      normalized = ' ';
    }
    const normalizedStart = text.length;
    text += normalized;
    mapping.push({ normalizedStart, normalizedEnd: text.length, sourceStart: sourceOffset + start, sourceEnd: sourceOffset + i });
  }
  return { text, mapping };
}
/** Commas inside locants, decimal quantities and parentheses are chemical punctuation. */
function tokenRanges(raw: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  let start = 0, depth = 0;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth = Math.max(0, depth - 1);
    const numericComma = c === ',' && /\d/.test(raw[i - 1] ?? '') && /\d/.test(raw[i + 1] ?? '');
    if (depth === 0 && ((c === ',' && !numericComma) || c === ';')) { ranges.push([start, i]); start = i + 1; }
  }
  ranges.push([start, raw.length]);
  return ranges.map(([a, b]): [number, number] => { while (a < b && /\s/.test(raw[a])) a++; while (b > a && /\s/.test(raw[b - 1])) b--; return [a, b]; }).filter(([a, b]) => b > a);
}
export function parseDeclarationSection(input: SectionParseInput): DeclarationSection {
  let conditional: string | null = input.kind === 'may_contain' ? 'may contain' : null;
  const entries: DeclarationEntry[] = tokenRanges(input.rawText).map(([start, end], order) => {
    const rawToken = input.rawText.slice(start, end);
    const qualifier = rawToken.match(/\bmay\s+contain\b[^:]*:/i)?.[0];
    if (qualifier) conditional = qualifier;
    const normalized = normalizeWithOffsets(rawToken, input.sourceOffset + start);
    const q = rawToken.match(/((?:[<>≤≥]=?\s*)?\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?\s*(?:%|mg\/g|mg\/m[lL]|g\/g))(?:\s*(w\/w|w\/v))?\s*$/);
    const numbers = q?.[1].match(/\d+(?:[.,]\d+)?/g) ?? [];
    return { entryId: input.entryId(order), sectionId: input.sectionId, order, rawToken, sourceSpans: [{ observationId: input.observationId, imageId: input.imageId, sourceRevision: input.sourceRevision, start: input.sourceOffset + start, end: input.sourceOffset + end, region: null, transformation: normalized.mapping }], canonicalIngredientId: null, aliasVersion: DECLARATION_ALIAS_VERSION, mapping: 'unresolved', quantity: q ? { raw: q[0], value: numbers.length === 1 ? numbers[0] : null, min: numbers.length === 2 ? numbers[0] : null, max: numbers.length === 2 ? numbers[1] : null, unit: q[1].match(/%|mg\/g|mg\/m[lL]|g\/g/)?.[0] ?? null, operator: q[1].match(/^[<>≤≥]=?/)?.[0] ?? (numbers.length === 2 ? 'range' : '='), basis: q[2] ?? null, parse: 'exact' } : null, conditional, uncertaintyReasons: [...input.uncertaintyReasons ?? [], ...(unbalanced(rawToken) ? ['unbalanced_punctuation'] : [])] };
  });
  return { sectionId: input.sectionId, kind: input.kind, rawText: input.rawText, startCovered: input.startCovered, endCovered: input.endCovered, lineCoverageComplete: input.lineCoverageComplete, entries };
}
function unbalanced(token: string): boolean {
  const stack: string[] = [], closing: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  for (const c of token) { if ('([{'.includes(c)) stack.push(c); else if (')]}'.includes(c) && stack.pop() !== closing[c]) return true; }
  return stack.length > 0;
}
/** Extracting an inert range is separate from proving the entire product section. */
export function extractBoundedSection(source: string, input: { start: number; end: number; establishedStart: number | null; establishedEnd: number | null; sectionLabel: string; lineCoverageComplete: boolean }): { rawText: string; complete: boolean; reasons: string[]; start: number; end: number } {
  if (!Number.isInteger(input.start) || !Number.isInteger(input.end) || input.start < 0 || input.end <= input.start || input.end > source.length) throw new Error('invalid_source_span');
  const marketing = !/^(ingredients|inactive ingredients|active ingredients|may contain)$/i.test(input.sectionLabel.trim());
  const complete = !marketing && input.establishedStart === input.start && input.establishedEnd === input.end && input.lineCoverageComplete;
  return { rawText: source.slice(input.start, input.end), complete, reasons: [...marketing ? ['not_full_declaration_section'] : [], ...input.establishedStart !== input.start || input.establishedEnd !== input.end || !input.lineCoverageComplete ? ['missing_section'] : []], start: input.start, end: input.end };
}

/** A reviewed layout marks ingredient cells; explanatory columns retain source provenance only. */
export function parseIngredientTable(input: Omit<SectionParseInput, 'rawText' | 'sourceOffset'> & {
  sourceText: string; rows: Array<{ ingredientStart: number; ingredientEnd: number; explanationStart: number | null; explanationEnd: number | null }>;
}): DeclarationSection {
  const entries: DeclarationEntry[] = [];
  for (const row of input.rows) {
    if (row.ingredientStart < 0 || row.ingredientEnd <= row.ingredientStart || row.ingredientEnd > input.sourceText.length || !Number.isInteger(row.ingredientStart) || !Number.isInteger(row.ingredientEnd)) throw new Error('invalid_table_span');
    const parsed = parseDeclarationSection({ ...input, rawText: input.sourceText.slice(row.ingredientStart, row.ingredientEnd), sourceOffset: row.ingredientStart, entryId: order => input.entryId(entries.length + order) });
    for (const entry of parsed.entries) entries.push({ ...entry, order: entries.length });
  }
  return { sectionId: input.sectionId, kind: input.kind, rawText: input.sourceText, startCovered: input.startCovered, endCovered: input.endCovered, lineCoverageComplete: input.lineCoverageComplete, entries };
}
