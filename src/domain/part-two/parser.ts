import type { PartTwoOccurrence, PartTwoQuantity, PartTwoSpan } from '../../contracts/PartTwo.ts';
import { compareDecimalStrings, mgPerGramToPercent } from './quantities.ts';
import { lookupName, type DictionaryRelease } from './dictionary.ts';

export const PART_TWO_LIMITS = Object.freeze({ sourceBytes: 256 * 1024, codePoints: 50000, sections: 20, occurrences: 1000, occurrenceCodePoints: 2000, bracketDepth: 8, dependencies: 1000 });
export const PARSER_VERSION = 'bounded-lossless-v3';
export const QUANTITY_VERSION = 'exact-printed-v2';
export type ParserSection = { sectionId: string; kind: 'ingredients' | 'active' | 'inactive' | 'may_contain'; rawText: string; sourceOffset?: number; observationId: string; sourceRevision: number; transcription: 'clear' | 'uncertain' | 'conflict'; entryRefs: { entryId: string; start: number; end: number; uncertaintyReasons: string[]; conditional: string | null }[] };
export class ParseLimitError extends Error {}
export function decodePartTwoText(bytes: Uint8Array): string { if (bytes.byteLength > PART_TWO_LIMITS.sourceBytes) throw new ParseLimitError('source_byte_limit'); return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
export function unsafeUnicode(text: string): boolean { return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/u.test(text) || /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(text); }
function span(section: ParserSection, start: number, end: number, entryId: string | null): PartTwoSpan { return { observationId: section.observationId, sourceRevision: section.sourceRevision, sectionId: section.sectionId, entryId, start: start + (section.sourceOffset ?? 0), end: end + (section.sourceOffset ?? 0), raw: section.rawText.slice(start, end) }; }
function trimRange(raw: string, start: number, end: number): [number, number] { while (start < end && /\s/u.test(raw[start])) start++; while (end > start && /\s/u.test(raw[end - 1])) end--; return [start, end]; }
function ranges(raw: string, dictionary?: DictionaryRelease, entryRefs: ParserSection['entryRefs'] = []): { start: number; end: number; syntaxError: boolean }[] {
  let start = 0, stack: string[] = [], error = false, tokenCodePoints = 0;
  const activeIds = new Set(dictionary?.identities.filter(identity => identity.status === 'active').map(identity => identity.ingredientId));
  const exactKeys = new Set(dictionary?.aliases.filter(alias => alias.status === 'active' && activeIds.has(alias.ingredientId)).map(alias => alias.lookupKey));
  const exactName = (name: string) => exactKeys.size > 0 && exactKeys.has(lookupName(name).key);
  const result: { start: number; end: number; syntaxError: boolean }[] = [];
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (!/[\uDC00-\uDFFF]/u.test(c) || i === 0 || !/[\uD800-\uDBFF]/u.test(raw[i - 1])) tokenCodePoints++;
    if (tokenCodePoints > PART_TWO_LIMITS.occurrenceCodePoints) throw new ParseLimitError('occurrence_codepoint_limit');
    if (c === '(' || c === '[' || c === '{') { stack.push(c); if (stack.length > PART_TWO_LIMITS.bracketDepth) throw new ParseLimitError('bracket_depth_limit'); }
    else if (c === ')' || c === ']' || c === '}') { if (stack.pop() !== ({ ')': '(', ']': '[', '}': '{' } as Record<string, string>)[c]) error = true; }
    if (stack.length === 0 && (c === ',' || c === ';' || c === '\n')) {
      // Numeric chemical locants and printed decimal commas are indivisible.
      if (c === ',' && /\d/.test(raw[i - 1] ?? '') && /^\d+(?:,\d+)*-/.test(raw.slice(i + 1))) continue;
      if (c === ',' && /\d/.test(raw[i - 1] ?? '') && /^\d+\s*(?:%|mg\/)/.test(raw.slice(i + 1))) continue;
      // An OCR line wrap around a literal "or" is not a list boundary.
      // Explicit section headings still reset scope; a dangling connector
      // remains unresolved rather than borrowing a name from the next section.
      if (c === '\n' && !/^\s*(?:ingredients|inactive ingredients|active ingredients|may contain)\s*:/i.test(raw.slice(i + 1)) &&
        (/\bor\s*$/i.test(raw.slice(start, i)) || /^\s*or\b/i.test(raw.slice(i + 1)))) continue;
      if (c === '\n' && !/^\s*(?:ingredients|inactive ingredients|active ingredients|may contain)\s*:/i.test(raw.slice(i + 1))) {
        // A layout line is not a chemical delimiter. Only explicit independent
        // rows or complete finite exact-name rows support a list boundary;
        // otherwise retain modifiers and tails in the original whole token.
        const nextBoundary = raw.slice(i + 1).search(/[,;\n]/u);
        const left = raw.slice(start, i).trim(), rightEnd = nextBoundary < 0 ? raw.length : i + 1 + nextBoundary;
        const right = raw.slice(i + 1, rightEnd).trim();
        const independentRows = entryRefs.some(e => e.start < i && e.end <= i) && entryRefs.some(e => e.start > i && e.start < rightEnd);
        if (!independentRows && !(exactName(left) && exactName(right))) continue;
      }
      result.push({ start, end: i, syntaxError: error }); start = i + 1; error = false; tokenCodePoints = 0;
    }
  }
  result.push({ start, end: raw.length, syntaxError: error || stack.length > 0 }); return result;
}
/** Context only: structured entry rows may split a wrapped alternative. Do not
 * reinterpret layout gaps as ingredients; abstain on affected fragments. */
export function alternativeScopeRanges(raw: string, dictionary?: DictionaryRelease): { start: number; end: number }[] {
  return ranges(raw, dictionary).filter(range => /\bor\b/i.test(raw.slice(range.start, range.end)));
}
const qualifierPrefix = /^(?:may contain(?:\s*(?:\(\+\/-\)|\(±\)|±|\+\/-))?|\(\+\/-\)|\(±\)|±|\+\/-)\s*:?\s*/i;
const sectionHeader = /^(ingredients|inactive ingredients|active ingredients)\s*:\s*/i;
/** Bound ingredient cells inherit only literal surrounding qualifier context;
 * gaps are not additional ingredients. An explicit header resets the scope. */
export function conditionalScopeRanges(raw: string, dictionary?: DictionaryRelease): { start: number; end: number; qualifier: string }[] {
  const result: { start: number; end: number; qualifier: string }[] = [];
  let current: { start: number; qualifier: string } | null = null;
  for (const range of ranges(raw, dictionary)) {
    let [start, end] = trimRange(raw, range.start, range.end);
    const header = raw.slice(start, end).match(sectionHeader);
    if (header) { if (current) result.push({ ...current, end: start }); current = null; start += header[0].length; }
    const qualifier = raw.slice(start, end).match(qualifierPrefix);
    if (qualifier) { if (current) result.push({ ...current, end: start }); current = { start, qualifier: qualifier[0].trim() }; }
  }
  if (current) result.push({ ...current, end: raw.length });
  return result;
}
/** Split only literal top-level alternatives. Bracket contents are one
 * opaque subject; their internal connector must never attach to a fragment. */
function alternatives(raw: string): string[] {
  let depth = 0, start = 0;
  const tokens: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    if ('([{'.includes(raw[i])) depth++;
    else if (')]}'.includes(raw[i])) depth--;
    if (depth === 0 && /\s/u.test(raw[i])) {
      const match = raw.slice(i).match(/^\s+or\s+/i);
      if (match) { tokens.push(raw.slice(start, i)); i += match[0].length - 1; start = i + 1; }
    }
  }
  if (!tokens.length) return [raw];
  tokens.push(raw.slice(start)); return tokens;
}
const amountSource = '(?:(?:about|approximately|approx\\.)\\s*)?(?:[<>≤≥]\\s*)?-?\\d+(?:[.,]\\d+)?(?:\\s*[-–]\\s*\\d+(?:[.,]\\d+)?)?\\s*(?:%|mg\\s*\\/\\s*(?:g|mL))(?:\\s*(?:w\\/w|w\\/v))?';
const prefixAmount = new RegExp(`^(${amountSource})\\s+`, 'i');
const suffixAmount = new RegExp(`\\s+(${amountSource})$`, 'i');
const parentheticalAmount = new RegExp(`\\s*\\((${amountSource})\\)$`, 'i');
function amount(section: ParserSection, start: number, end: number, name: string, entryId: string | null): PartTwoQuantity {
  const raw = section.rawText.slice(start, end);
  const match = raw.match(/^(?:(about|approximately|approx\.)\s*)?([<>≤≥])?\s*(-?\d+(?:[.,]\d+)?)(?:\s*([-–])\s*(\d+(?:[.,]\d+)?))?\s*(%|mg\s*\/\s*(?:g|mL))(?:\s*(w\/w|w\/v))?$/i);
  const q: PartTwoQuantity = { span: span(section, start, end, entryId), value: null, min: null, max: null, operator: 'unresolved', unit: 'unresolved', basis: 'unknown', subject: /\+|\b(?:and|or)\b/i.test(name) ? 'group' : /\b(complex|solution|blend)\b/i.test(name) ? 'blend' : 'ingredient', status: 'unresolved', reasons: [], convertedPercentWw: null };
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
    let sectionKind = section.kind, explicitHeaderReset = false;
    for (const range of ranges(section.rawText, dictionary, section.entryRefs)) {
      let [start, end] = trimRange(section.rawText, range.start, range.end); if (start === end) continue;
      const header = section.rawText.slice(start, end).match(sectionHeader);
      if (header) { conditional = null; explicitHeaderReset = true; sectionKind = /^inactive/i.test(header[1]) ? 'inactive' : /^active/i.test(header[1]) ? 'active' : 'ingredients'; unresolvedSpans.push(span(section, start, start + header[0].length, null)); start += header[0].length; [start, end] = trimRange(section.rawText, start, end); if (start === end) continue; }
      const qualifier = section.rawText.slice(start, end).match(qualifierPrefix);
      if (qualifier) { conditional = qualifier[0].trim(); explicitHeaderReset = false; unresolvedSpans.push(span(section, start, start + qualifier[0].length, null)); start += qualifier[0].length; [start, end] = trimRange(section.rawText, start, end); if (start === end) continue; }
      const rawToken = section.rawText.slice(start, end);
      if (Array.from(rawToken).length > PART_TWO_LIMITS.occurrenceCodePoints) throw new ParseLimitError('occurrence_codepoint_limit');
      const alternativeTokens = !range.syntaxError ? alternatives(rawToken) : [rawToken];
      let alternativeStart = start;
      for (const alternative of alternativeTokens) {
        if (occurrences.length >= PART_TWO_LIMITS.occurrences) throw new ParseLimitError('occurrence_limit');
        const tokenStart = section.rawText.indexOf(alternative, alternativeStart); const tokenEnd = tokenStart + alternative.length; alternativeStart = tokenEnd;
        const entryRefs = section.entryRefs.filter(e => e.start < tokenEnd && e.end > tokenStart);
        const entryId = entryRefs.length === 1 ? entryRefs[0].entryId : null;
        const limitations = [...new Set(entryRefs.flatMap(e => e.uncertaintyReasons))];
        if (sectionKind !== section.kind) limitations.push('printed_section_heading_not_regulatory_verification');
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
        if (alternativeTokens.length > 1) for (const quantity of quantities) { quantity.subject = 'unresolved'; quantity.status = 'unresolved'; quantity.reasons.push('alternative_quantity_attachment_unresolved'); quantity.convertedPercentWw = null; }
        if (quantities.some(q => q.subject === 'group')) limitations.push('group_amount_not_constituent_amount');
        if (quantities.length > 1) for (const quantity of quantities) { quantity.status = 'conflict'; quantity.reasons.push('multiple_amounts_for_subject'); quantity.convertedPercentWw = null; }
        let modality: PartTwoOccurrence['modality'] = alternativeTokens.length > 1 ? 'alternative' : conditional ? 'may_contain' : 'unconditional';
        const ownConditionals = [...new Set(entryRefs.map(e => e.conditional).filter((value): value is string => !!value))];
        const ownConditional = ownConditionals.length ? ownConditionals.join(' | ') : null;
        if (ownConditional) {
          const kinds = ownConditionals.map(value => /may contain|\+\/-|±/i.test(value) ? 'may_contain' : /\bor\b/i.test(value) ? 'alternative' : 'unresolved');
          modality = kinds.every(kind => kind === kinds[0]) ? kinds[0] : 'unresolved';
          if (explicitHeaderReset && conditional === null && alternativeTokens.length === 1) { modality = 'unresolved'; limitations.push('conditional_context_conflict'); for (const quantity of quantities) { quantity.status = 'conflict'; quantity.reasons.push('conditional_context_conflict'); quantity.convertedPercentWw = null; } }
        }
        let transcription = section.transcription;
        if (entryRefs.some(e => e.uncertaintyReasons.length)) transcription = 'uncertain';
        if (range.syntaxError) { modality = 'unresolved'; limitations.push('unsupported_bracket_syntax'); }
        if (alternativeTokens.length === 1 && /\bor\b/i.test(name)) { modality = 'unresolved'; limitations.push('alternative_scope_unresolved'); for (const quantity of quantities) { quantity.status = 'unresolved'; quantity.reasons.push('alternative_quantity_attachment_unresolved'); quantity.convertedPercentWw = null; } }
        if (unsafeUnicode(alternative)) { transcription = 'uncertain'; limitations.push('unsafe_or_obscuring_unicode'); }
        if (/\b(?:free[- ]from|fragrance[- ]free|parfum[- ]free)\b|\(and\)|https?:\/\/|<[^>]*>|\d+[.,]?\d*\s*[%]|[０-９]/i.test(name)) { modality = 'unresolved'; limitations.push('unsupported_name_or_amount_syntax'); }
        if (!name) { modality = 'unresolved'; limitations.push('quantity_subject_unresolved'); quantities.forEach(q => { q.subject = 'unresolved'; q.status = 'unresolved'; q.convertedPercentWw = null; }); }
        if (transcription !== 'clear') for (const quantity of quantities) { quantity.status = transcription === 'conflict' || limitations.some(reason => /digit|amount|quantity/i.test(reason)) ? 'conflict' : 'unresolved'; quantity.reasons.push('quantity_transcription_uncertain'); quantity.convertedPercentWw = null; }
        const lookup = lookupName(name);
        const aliases = dictionary.aliases.filter(a => a.status === 'active' && a.lookupKey === lookup.key && dictionary.identities.some(i => i.ingredientId === a.ingredientId && i.status === 'active')).sort((a,b) => a.aliasRecordId < b.aliasRecordId ? -1 : 1);
        const candidates = [...new Set(aliases.map(a => a.ingredientId))];
        const mapping: PartTwoOccurrence['mapping'] = transcription !== 'clear' ? { state: 'unresolved', reason: 'transcription_uncertain' } : modality === 'unresolved' ? { state: 'unresolved', reason: 'unsupported_syntax' } : candidates.length > 1 ? { state: 'ambiguous', candidateIds: candidates.slice(0, 5) } : candidates.length === 1 ? { state: 'resolved', ingredientId: candidates[0], preferredName: dictionary.identities.find(identity => identity.ingredientId === candidates[0])!.preferredName, aliasRecordId: aliases[0].aliasRecordId, lookupKey: lookup.key, rule: aliases[0].rule, offsetMap: lookup.offsetMap.map(m => ({ ...m, sourceStart: m.sourceStart + nameStart + (section.sourceOffset ?? 0), sourceEnd: m.sourceEnd + nameStart + (section.sourceOffset ?? 0) })) } : { state: 'unresolved', reason: 'name_not_in_release' };
        const occurrence: PartTwoOccurrence = { occurrenceId: `${section.sectionId}:${occurrences.length}`, order: occurrences.length, sectionId: section.sectionId, sectionKind, rawToken: section.rawText.slice(tokenStart, tokenEnd), observedName: name, nameSpan: span(section, nameStart, nameEnd, entryId), spans: [span(section, tokenStart, tokenEnd, entryId)], entryRefs: entryRefs.map(e => e.entryId), transcription, modality, qualifier: ownConditional ?? conditional ?? (alternativeTokens.length > 1 ? 'or' : null), mapping, quantities, limitations };
        occurrences.push(occurrence);
        if (modality === 'unresolved' || transcription !== 'clear' || mapping.state !== 'resolved') unresolvedSpans.push(...occurrence.spans);
      }
    }
  }
  return { occurrences, unresolvedSpans };
}
