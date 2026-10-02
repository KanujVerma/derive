import type { PartTwoOccurrence, PartTwoQuantity, PartTwoSpan } from '../../contracts/PartTwo.ts';
import { compareDecimalStrings, mgPerGramToPercent } from './quantities.ts';
import { lookupName, type DictionaryRelease } from './dictionary.ts';

export const PART_TWO_LIMITS = Object.freeze({ sourceBytes: 256 * 1024, codePoints: 50000, sections: 20, occurrences: 1000, occurrenceCodePoints: 2000, bracketDepth: 8, dependencies: 1000 });
export const PARSER_VERSION = 'bounded-lossless-v2';
export const QUANTITY_VERSION = 'exact-printed-v2';
export type ParserSection = { sectionId: string; kind: 'ingredients' | 'active' | 'inactive' | 'may_contain'; rawText: string; sourceOffset?: number; observationId: string; sourceRevision: number; transcription: 'clear' | 'uncertain' | 'conflict'; entryRefs: { entryId: string; start: number; end: number; uncertaintyReasons: string[]; conditional: string | null }[] };
export class ParseLimitError extends Error {}
export function decodePartTwoText(bytes: Uint8Array): string { if (bytes.byteLength > PART_TWO_LIMITS.sourceBytes) throw new ParseLimitError('source_byte_limit'); return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
export function unsafeUnicode(text: string): boolean { return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u.test(text) || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text); }
function span(section: ParserSection, start: number, end: number, entryId: string | null): PartTwoSpan { return { observationId: section.observationId, sourceRevision: section.sourceRevision, sectionId: section.sectionId, entryId, start: start + (section.sourceOffset ?? 0), end: end + (section.sourceOffset ?? 0), raw: section.rawText.slice(start, end) }; }
function trimRange(raw: string, start: number, end: number): [number, number] { while (start < end && /\s/u.test(raw[start])) start++; while (end > start && /\s/u.test(raw[end - 1])) end--; return [start, end]; }
function ranges(raw: string): { start: number; end: number; syntaxError: boolean }[] {
  let start = 0, stack: string[] = [], error = false;
  const result: { start: number; end: number; syntaxError: boolean }[] = [];
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '(' || c === '[' || c === '{') { stack.push(c); if (stack.length > PART_TWO_LIMITS.bracketDepth) throw new ParseLimitError('bracket_depth_limit'); }
    else if (c === ')' || c === ']' || c === '}') { if (stack.pop() !== ({ ')': '(', ']': '[', '}': '{' } as Record<string, string>)[c]) error = true; }
    if (stack.length === 0 && (c === ',' || c === ';' || c === '\n')) {
      // Numeric chemical locants and printed decimal commas are indivisible.
      if (c === ',' && /\d/.test(raw[i - 1] ?? '') && /^\d+(?:,\d+)*-/.test(raw.slice(i + 1))) continue;
      if (c === ',' && /\d/.test(raw[i - 1] ?? '') && /^\d+\s*(?:%|mg\/)/.test(raw.slice(i + 1))) continue;
      result.push({ start, end: i, syntaxError: error }); start = i + 1; error = false;
    }
  }
  result.push({ start, end: raw.length, syntaxError: error || stack.length > 0 }); return result;
}
const amountSource = '(?:(?:about|approximately|approx\\.)\\s*)?(?:[<>≤≥]\\s*)?-?\\d+(?:[.,]\\d+)?(?:\\s*[-–]\\s*\\d+(?:[.,]\\d+)?)?\\s*(?:%|mg\\s*\\/\\s*(?:g|mL))(?:\\s*(?:w\\/w|w\\/v))?';
const prefixAmount = new RegExp(`^(${amountSource})\\s+`, 'i');
const suffixAmount = new RegExp(`\\s+(${amountSource})$`, 'i');
const parentheticalAmount = new RegExp(`\\s*\\((${amountSource})\\)$`, 'i');
function amount(section: ParserSection, start: number, end: number, name: string, entryId: string | null): PartTwoQuantity {
  const raw = section.rawText.slice(start, end);
  const match = raw.match(/^(?:(about|approximately|approx\.)\s*)?([<>≤≥])?\s*(-?\d+(?:[.,]\d+)?)(?:\s*([-–])\s*(\d+(?:[.,]\d+)?))?\s*(%|mg\s*\/\s*(?:g|mL))(?:\s*(w\/w|w\/v))?$/i);
  const q: PartTwoQuantity = { span: span(section, start, end, entryId), value: null, min: null, max: null, operator: 'unresolved', unit: 'unresolved', basis: 'unknown', subject: /\b(complex|solution|blend)\b/i.test(name) ? 'blend' : 'ingredient', status: 'unresolved', reasons: [], convertedPercentWw: null };
  if (!match) { q.reasons.push('unsupported_quantity_syntax'); return q; }
  const [, approximation, op, value, range, maximum, unit, basis] = match;
  q.operator = range ? 'range' : approximation ? 'approximate' : op ? ({ '<': 'less_than', '≤': 'less_than_or_equal', '>': 'greater_than', '≥': 'greater_than_or_equal' } as const)[op as '<'|'≤'|'>'|'≥'] : 'exact';
  q.value = range ? null : value; q.min = range ? value : null; q.max = maximum ?? null;
  q.unit = unit === '%' ? '%' : unit.replace(/\s/g, '').toLowerCase() === 'mg/g' ? 'mg/g' : 'mg/mL'; q.basis = basis ? basis.toLowerCase() as 'w/w' | 'w/v' : 'unknown'; q.status = 'parsed';
  if (raw.includes(',')) { q.status = 'unresolved'; q.reasons.push('decimal_comma_context_unknown'); return q; }
  if ((range && (op || approximation)) || (approximation && op)) { q.status = 'unresolved'; q.operator = 'unresolved'; q.reasons.push('combined_quantity_operators'); return q; }
  const negative = value.startsWith('-');
  const reversed = !negative && !!range && compareDecimalStrings(value, maximum) > 0;
  const overLimit = !negative && ((q.unit === 'mg/g' && (compareDecimalStrings(value, '1000') > 0 || compareDecimalStrings(maximum ?? value, '1000') > 0)) || (q.unit === '%' && (compareDecimalStrings(value, '100') > 0 || compareDecimalStrings(maximum ?? value, '100') > 0)));
  if (negative || reversed || overLimit) { q.status = 'invalid'; q.reasons.push(reversed ? 'reversed_range' : negative ? 'negative_amount' : q.unit === 'mg/g' ? 'impossible_mass_fraction' : 'impossible_percent'); return q; }
  if (q.unit === 'mg/g') { if (basis && basis.toLowerCase() !== 'w/w') { q.status = 'conflict'; q.reasons.push('unit_basis_conflict'); return q; } q.basis = 'w/w'; q.status = 'validated'; if (q.operator === 'exact') { q.convertedPercentWw = mgPerGramToPercent(value); } }
  if (q.unit === 'mg/mL') { if (basis && basis.toLowerCase() !== 'w/v') { q.status = 'conflict'; q.reasons.push('unit_basis_conflict'); return q; } q.basis = 'w/v'; q.status = 'validated'; }
  if (q.unit === '%' && q.basis !== 'unknown') q.status = 'validated';
  return q;
}
export function parseSections(sections: ParserSection[], dictionary: DictionaryRelease): { occurrences: PartTwoOccurrence[]; unresolvedSpans: PartTwoSpan[] } {
  if (sections.length > PART_TWO_LIMITS.sections) throw new ParseLimitError('section_limit');
  let sourceCodePoints = 0, sourceBytes = 0;
  for (const s of sections) { sourceCodePoints += Array.from(s.rawText).length; sourceBytes += new TextEncoder().encode(s.rawText).byteLength; }
  if (sourceCodePoints > PART_TWO_LIMITS.codePoints) throw new ParseLimitError('source_codepoint_limit');
  if (sourceBytes > PART_TWO_LIMITS.sourceBytes) throw new ParseLimitError('source_byte_limit');
  const occurrences: PartTwoOccurrence[] = [], unresolvedSpans: PartTwoSpan[] = [];
  for (const section of sections) {
    let conditional = section.kind === 'may_contain' ? 'May contain' : null;
    for (const range of ranges(section.rawText)) {
      let [start, end] = trimRange(section.rawText, range.start, range.end); if (start === end) continue;
      const qualifier = section.rawText.slice(start, end).match(/^(?:may contain(?:\s*\(\+\/-\))?|\+\/-)\s*:?\s*/i);
      if (qualifier) { conditional = qualifier[0].trim(); unresolvedSpans.push(span(section, start, start + qualifier[0].length, null)); start += qualifier[0].length; [start, end] = trimRange(section.rawText, start, end); if (start === end) continue; }
      const header = section.rawText.slice(start, end).match(/^(ingredients|inactive ingredients|active ingredients)\s*:\s*/i);
      if (header) { conditional = null; unresolvedSpans.push(span(section, start, start + header[0].length, null)); start += header[0].length; }
      const rawToken = section.rawText.slice(start, end);
      if (Array.from(rawToken).length > PART_TWO_LIMITS.occurrenceCodePoints) throw new ParseLimitError('occurrence_codepoint_limit');
      const alternatives = !range.syntaxError && /\s+or\s+/i.test(rawToken) ? rawToken.split(/\s+or\s+/i) : [rawToken];
      let alternativeStart = start;
      for (const alternative of alternatives) {
        if (occurrences.length >= PART_TWO_LIMITS.occurrences) throw new ParseLimitError('occurrence_limit');
        const tokenStart = section.rawText.indexOf(alternative, alternativeStart); const tokenEnd = tokenStart + alternative.length; alternativeStart = tokenEnd;
        const entryRefs = section.entryRefs.filter(e => e.start <= tokenStart && e.end >= tokenEnd);
        const entryId = entryRefs.length === 1 ? entryRefs[0].entryId : null;
        const limitations = [...new Set(entryRefs.flatMap(e => e.uncertaintyReasons))];
        let nameStart = tokenStart, nameEnd = tokenEnd;
        const quantities: PartTwoQuantity[] = [];
        const prefix = alternative.match(prefixAmount); if (prefix) nameStart += prefix[0].length;
        const suffix = section.rawText.slice(nameStart, nameEnd).match(suffixAmount);
        const parenthetical = section.rawText.slice(nameStart, nameEnd).match(parentheticalAmount);
        let amountStart = -1, amountEnd = -1;
        if (parenthetical) { amountStart = nameEnd - parenthetical[0].length + parenthetical[0].indexOf(parenthetical[1]); amountEnd = amountStart + parenthetical[1].length; nameEnd -= parenthetical[0].length; }
        else if (suffix) { amountStart = nameEnd - suffix[1].length; amountEnd = nameEnd; nameEnd -= suffix[0].length; }
        [nameStart, nameEnd] = trimRange(section.rawText, nameStart, nameEnd);
        const name = section.rawText.slice(nameStart, nameEnd);
        if (prefix) quantities.push(amount(section, tokenStart, tokenStart + prefix[1].length, name, entryId));
        if (amountStart >= 0) quantities.push(amount(section, amountStart, amountEnd, name, entryId));
        if (quantities.length > 1) for (const quantity of quantities) { quantity.status = 'conflict'; quantity.reasons.push('multiple_amounts_for_subject'); quantity.convertedPercentWw = null; }
        let modality: PartTwoOccurrence['modality'] = alternatives.length > 1 ? 'alternative' : conditional ? 'may_contain' : 'unconditional';
        const ownConditional = entryRefs.find(e => e.conditional)?.conditional;
        if (ownConditional) { modality = /may contain|\+\/-/i.test(ownConditional) ? 'may_contain' : /\bor\b/i.test(ownConditional) ? 'alternative' : 'unresolved'; }
        let transcription = section.transcription;
        if (entryRefs.some(e => e.uncertaintyReasons.length)) transcription = 'uncertain';
        if (range.syntaxError) { modality = 'unresolved'; limitations.push('unsupported_bracket_syntax'); }
        if (unsafeUnicode(alternative)) { transcription = 'uncertain'; limitations.push('unsafe_or_obscuring_unicode'); }
        if (/\b(?:free[- ]from|fragrance[- ]free|parfum[- ]free)\b|\(and\)|https?:\/\/|<[^>]*>|\d+[.,]?\d*\s*[%]|[０-９]/i.test(name)) { modality = 'unresolved'; limitations.push('unsupported_name_or_amount_syntax'); }
        if (!name) { modality = 'unresolved'; limitations.push('quantity_subject_unresolved'); quantities.forEach(q => { q.subject = 'unresolved'; q.status = 'unresolved'; q.convertedPercentWw = null; }); }
        const lookup = lookupName(name);
        const aliases = dictionary.aliases.filter(a => a.status === 'active' && a.lookupKey === lookup.key && dictionary.identities.some(i => i.ingredientId === a.ingredientId && i.status === 'active')).sort((a,b) => a.aliasRecordId < b.aliasRecordId ? -1 : 1);
        const candidates = [...new Set(aliases.map(a => a.ingredientId))];
        const mapping: PartTwoOccurrence['mapping'] = transcription !== 'clear' ? { state: 'unresolved', reason: 'transcription_uncertain' } : modality === 'unresolved' ? { state: 'unresolved', reason: 'unsupported_syntax' } : candidates.length > 1 ? { state: 'ambiguous', candidateIds: candidates.slice(0, 5) } : candidates.length === 1 ? { state: 'resolved', ingredientId: candidates[0], aliasRecordId: aliases[0].aliasRecordId, lookupKey: lookup.key, rule: aliases[0].rule, offsetMap: lookup.offsetMap.map(m => ({ ...m, sourceStart: m.sourceStart + nameStart + (section.sourceOffset ?? 0), sourceEnd: m.sourceEnd + nameStart + (section.sourceOffset ?? 0) })) } : { state: 'unresolved', reason: 'name_not_in_release' };
        const occurrence: PartTwoOccurrence = { occurrenceId: `${section.sectionId}:${occurrences.length}`, order: occurrences.length, sectionId: section.sectionId, sectionKind: section.kind, rawToken: section.rawText.slice(tokenStart, tokenEnd), observedName: name, nameSpan: span(section, nameStart, nameEnd, entryId), spans: [span(section, tokenStart, tokenEnd, entryId)], entryRefs: entryRefs.map(e => e.entryId), transcription, modality, qualifier: ownConditional ?? conditional ?? (alternatives.length > 1 ? 'or' : null), mapping, quantities, limitations };
        occurrences.push(occurrence);
        if (modality === 'unresolved' || transcription !== 'clear' || mapping.state !== 'resolved') unresolvedSpans.push(...occurrence.spans);
      }
    }
  }
  return { occurrences, unresolvedSpans };
}
