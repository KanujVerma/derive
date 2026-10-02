import { z } from 'zod';
import { NormalizationInputSchema, NormalizationResultSchema, labelAssertionContextLimit, type NormalizationInput, type NormalizationResult, type PartTwoBinding, type PartTwoSnapshot, type PartTwoOccurrence, type PartTwoFact } from '../../contracts/PartTwo.ts';
import { validateDictionaryRelease, deepFreeze, LOCAL_DICTIONARY_RELEASE, LOOKUP_VERSION, type DictionaryRelease } from './dictionary.ts';
import { parseSections, alternativeScopeRanges, conditionalScopeRanges, ParseLimitError, PART_TWO_LIMITS, PARSER_VERSION, QUANTITY_VERSION, type ParserSection } from './parser.ts';
import { canonicalJson, sha256 } from './hash.ts';
export { LOCAL_DICTIONARY_RELEASE, validateDictionaryRelease, dictionaryReleaseHash, lookupName, DictionaryReleaseSchema } from './dictionary.ts';
export type { DictionaryRelease } from './dictionary.ts';
export { PART_TWO_LIMITS, decodePartTwoText, ParseLimitError } from './parser.ts';
export { sha256, canonicalJson } from './hash.ts';
export const PART_TWO_VERSIONS = Object.freeze({ parser: PARSER_VERSION, dictionary: LOCAL_DICTIONARY_RELEASE.version, resolver: LOOKUP_VERSION, quantity: QUANTITY_VERSION, explanation: LOCAL_DICTIONARY_RELEASE.explanationVersion, factPolicy: 'attributed-positive-facts-v6' });
export const FACT_POLICY_VERSION = 'attributed-positive-facts-v6';
export const WithdrawalDependenciesSchema = z.array(z.string().min(1).max(200)).max(1000).refine(ids => new Set(ids).size === ids.length, 'Duplicate explanation withdrawal').readonly();
export const NormalizationMetadataSchema = z.strictObject({ snapshotId: z.string().min(1).max(150), createdAt: z.iso.datetime({ offset: false }), resultRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), withdrawnExplanationDependencies: WithdrawalDependenciesSchema.default([]) });
export type NormalizationMetadata = { snapshotId: string; createdAt: string; resultRevision: number; withdrawnExplanationDependencies?: readonly string[] };
function relevantExplanationWithdrawals(dictionary: DictionaryRelease, values: readonly string[]): string[] {
  const ids = WithdrawalDependenciesSchema.parse(values);
  const relevant = new Set(dictionary.explanations.flatMap(card => [card.explanationId, card.policyId, ...card.dependencies, ...(dictionary.explanationPolicies.find(policy => policy.policyId === card.policyId)?.withdrawalDependencies ?? [])]));
  return ids.filter(id => relevant.has(id)).sort();
}
export function normalizationVersions(input: NormalizationInput, dictionary: DictionaryRelease) { return { partOneParser: input.kind === 'bound_declaration' ? input.declaration.parserVersion : 'immutable-observations-v1', parser: PARSER_VERSION, dictionary: dictionary.version, resolver: LOOKUP_VERSION, quantity: QUANTITY_VERSION, explanation: dictionary.explanationVersion, factPolicy: FACT_POLICY_VERSION }; }
/** Opaque request tickets do not change interpretation or its immutable cache key. */
export function normalizationKey(inputValue: NormalizationInput, release: DictionaryRelease = LOCAL_DICTIONARY_RELEASE, withdrawnExplanationDependencies: readonly string[] = []): string {
  const input = NormalizationInputSchema.parse(inputValue), dictionary = validateDictionaryRelease(release);
  const { requestId: _requestId, ...binding } = input.binding;
  return sha256(canonicalJson({ input: { ...input, binding }, versions: normalizationVersions(input, dictionary), dictionaryHash: dictionary.contentHash, labelAssertionPermissions: input.kind === 'bound_declaration' ? input.labelAssertions.map(assertion => ({ assertionId: assertion.assertionId, ...assertion.fieldPermission })) : [], withdrawnExplanationDependencies: relevantExplanationWithdrawals(dictionary, withdrawnExplanationDependencies) }));
}
export function normalizationResultBinding(binding: PartTwoBinding, resultRevision: number) { return { schemaVersion: 2 as const, scanId: binding.scanId, captureSessionId: binding.captureSessionId, requestId: binding.requestId, authenticatedOwnerId: binding.authenticatedOwnerId, bindingKey: binding.bindingKey, generation: binding.generation, evidenceRevision: binding.evidenceRevision, resultRevision, expiresAt: binding.expiresAt }; }
export function normalizationLiteral(input: NormalizationInput) { return { sections: (input.kind === 'source_reading' ? input.sections.map(s => ({ sectionId: s.sectionId, kind: s.kind, text: s.rawText })) : input.declaration.sections.map(s => ({ sectionId: s.sectionId, kind: s.kind, text: s.rawText }))), expiresAt: input.binding.expiresAt }; }
function parsedInput(input: NormalizationInput, dictionary: DictionaryRelease) {
  if (input.kind === 'source_reading') return parseSections(input.sections, dictionary);
  const occurrences: PartTwoOccurrence[] = [], unresolvedSpans: PartTwoSnapshot['unresolvedSpans'] = [];
  const sections = input.declaration.sections;
  if (sections.length > PART_TWO_LIMITS.sections || sections.reduce((n,s) => n + Array.from(s.rawText).length,0) > PART_TWO_LIMITS.codePoints || sections.reduce((n,s) => n + new TextEncoder().encode(s.rawText).byteLength,0) > PART_TWO_LIMITS.sourceBytes) throw new ParseLimitError('section_or_source_limit');
  // Prefer authoritative structured rows. Explanation columns and layout gaps
  // are never interpreted as additional ingredient cells.
  for (const section of sections) {
   const alternativeScopes = alternativeScopeRanges(section.rawText, dictionary);
   const conditionalScopes = conditionalScopeRanges(section.rawText, dictionary);
   let entryCursor = 0;
   for (const entry of section.entries) {
    const entryStart = section.rawText.indexOf(entry.rawToken, entryCursor);
    entryCursor = entryStart + entry.rawToken.length;
    const splitAlternative = alternativeScopes.some(range => range.start < entryCursor && range.end > entryStart);
    const surroundingConditional = conditionalScopes.find(range => range.start < entryCursor && range.end > entryStart)?.qualifier ?? null;
    const original = entry.sourceSpans[0];
    if (entry.sourceSpans.length !== 1 || original.start === null || original.end === null || original.end - original.start !== entry.rawToken.length) throw new Error('unsupported_multispan_or_nonliteral_entry');
    const parserSection: ParserSection = { sectionId: section.sectionId, kind: section.kind, rawText: entry.rawToken, observationId: original.observationId, sourceRevision: original.sourceRevision, transcription: input.bundle.state === 'conflict' ? 'conflict' : input.declaration.transcriptionUncertainty.length ? 'uncertain' : 'clear', entryRefs: [{ entryId: entry.entryId, start: 0, end: entry.rawToken.length, uncertaintyReasons: entry.uncertaintyReasons, conditional: entry.conditional ?? surroundingConditional }] };
    const parsed = parseSections([parserSection], dictionary);
    const offset = original.start;
    const shift = <T extends { start: number; end: number }>(s: T): T => ({ ...s, start: s.start + offset, end: s.end + offset });
    for (const o of parsed.occurrences) {
      if (occurrences.length >= PART_TWO_LIMITS.occurrences) throw new ParseLimitError('occurrence_limit');
      o.occurrenceId = `${section.sectionId}:${occurrences.length}`; o.order = occurrences.length;
      o.nameSpan = shift(o.nameSpan); o.spans = o.spans.map(shift); o.quantities = o.quantities.map(q => ({ ...q, span: shift(q.span) }));
      if (o.mapping.state === 'resolved') o.mapping.offsetMap = o.mapping.offsetMap.map(m => ({ ...m, sourceStart: m.sourceStart + offset, sourceEnd: m.sourceEnd + offset }));
      if (splitAlternative && o.modality !== 'alternative') {
        o.modality = 'unresolved'; o.qualifier = 'or';
        o.mapping = { state: 'unresolved', reason: 'alternative_scope_unresolved' };
        o.limitations.push('alternative_scope_unresolved');
        for (const quantity of o.quantities) { quantity.subject = 'unresolved'; quantity.status = 'unresolved'; quantity.reasons.push('alternative_quantity_attachment_unresolved'); quantity.convertedPercentWw = null; }
        unresolvedSpans.push(...o.spans);
      }
      occurrences.push(o);
    }
    unresolvedSpans.push(...parsed.unresolvedSpans.map(shift));
   }
  }
  for (const section of sections) {
    const first = section.entries[0];
    if (!first) { if (/\S/u.test(section.rawText)) throw new Error('section_without_literal_entry_binding'); continue; }
    const original = first.sourceSpans[0];
    const firstLocal = section.rawText.indexOf(first.rawToken);
    const sourceOffset = original.start! - firstLocal;
    let cursor = 0;
    for (const entry of section.entries) {
      const localStart = section.rawText.indexOf(entry.rawToken, cursor);
      const gap = section.rawText.slice(cursor, localStart);
      if (/[^\s,;]/u.test(gap)) unresolvedSpans.push({ observationId: original.observationId, sourceRevision: original.sourceRevision, sectionId: section.sectionId, entryId: null, start: sourceOffset + cursor, end: sourceOffset + localStart, raw: gap });
      cursor = localStart + entry.rawToken.length;
    }
    const tail = section.rawText.slice(cursor);
    if (/[^\s,;]/u.test(tail)) unresolvedSpans.push({ observationId: original.observationId, sourceRevision: original.sourceRevision, sectionId: section.sectionId, entryId: null, start: sourceOffset + cursor, end: sourceOffset + section.rawText.length, raw: tail });
  }
  return { occurrences, unresolvedSpans };
}
function literalSections(input: NormalizationInput): PartTwoSnapshot['literalSections'] {
  if (input.kind === 'source_reading') return input.sections.map(section => ({ sectionId: section.sectionId, kind: section.kind, rawText: section.rawText, sourceOffset: section.sourceOffset, observationId: section.observationId, sourceRevision: section.sourceRevision }));
  return input.declaration.sections.filter(section => section.entries.length > 0).map(section => { const first = section.entries[0], source = first.sourceSpans[0]; return { sectionId: section.sectionId, kind: section.kind, rawText: section.rawText, sourceOffset: source.start! - section.rawText.indexOf(first.rawToken), observationId: source.observationId, sourceRevision: source.sourceRevision }; });
}
function factsFor(input: NormalizationInput, occurrences: PartTwoOccurrence[], dictionary: DictionaryRelease, snapshotId: string, product: boolean, withdrawals: readonly string[]): PartTwoFact[] {
  const facts: PartTwoFact[] = [];
  const canAssociate = input.kind === 'bound_declaration' && ['partial', 'uncertain', 'accepted'].includes(input.bundle.state) && input.bundle.predicate.association.passed && input.bundle.predicate.noContradiction.passed && input.bundle.predicate.variantMarket.passed && input.bundle.predicate.rightsFreshness.passed && !input.bundle.conflictIds.length && !input.declaration.conflictIds.length && input.binding.packageConfirmation !== 'conflict';
  if (product && !canAssociate) return facts;
  for (const o of occurrences) {
    if (o.transcription !== 'clear' || o.modality === 'unresolved' || !o.observedName) continue;
    const subject = product && input.kind === 'bound_declaration' ? { kind: 'bound_declaration_entry' as const, declarationId: input.declaration.declarationId, declarationRevision: input.declaration.revision, occurrenceId: o.occurrenceId } : { kind: 'reading_entry' as const, occurrenceId: o.occurrenceId };
    const limitations = [...o.limitations, ...(o.modality !== 'unconditional' ? ['conditional_not_definite_presence'] : []), ...(input.kind === 'source_reading' ? ['source_reading_not_product_presence', 'whole_list_completeness_unestablished'] : input.bundle.state !== 'accepted' ? ['whole_list_may_be_incomplete'] : []), ...(input.kind === 'bound_declaration' && input.bundle.scope === 'public' && input.bundle.packageConfirmation === 'unconfirmed' ? ['published_source_not_confirmed_package'] : [])];
    const base = { occurrenceId: o.occurrenceId, spans: o.spans, rule: FACT_POLICY_VERSION, sourceDependencies: [...new Set(o.spans.map(s => s.observationId))], dictionaryDependencies: [] as string[], limitations, validUntil: input.binding.expiresAt };
    facts.push({ ...base, factId: `${snapshotId}:${product ? 'product' : 'reading'}:${o.occurrenceId}:declared`, kind: 'declared_ingredient', subject, value: { rawName: o.observedName, order: o.order, sectionKind: o.sectionKind, modality: o.modality } });
    if (o.mapping.state === 'resolved') {
      const mapping = o.mapping;
      facts.push({ ...base, factId: `${snapshotId}:${product ? 'product' : 'reading'}:${o.occurrenceId}:identity`, kind: 'resolved_ingredient_identity', subject, value: { ingredientId: mapping.ingredientId, aliasRecordId: mapping.aliasRecordId }, dictionaryDependencies: [mapping.ingredientId, mapping.aliasRecordId] });
      for (const card of dictionary.explanations) if (card.ingredientId === mapping.ingredientId && card.state === 'active' && card.permissionApproved && ![card.explanationId, card.policyId, ...card.dependencies].some(id => withdrawals.includes(id)) && Date.parse(card.expiresAt) >= Date.parse(input.binding.expiresAt) && dictionary.explanationPolicies.some(policy => policy.policyId === card.policyId && !policy.withdrawalDependencies.some(id => withdrawals.includes(id)) && !policy.revoked && Object.values(policy.operations).every(Boolean) && Date.parse(policy.expiresAt) >= Date.parse(input.binding.expiresAt))) { const policy = dictionary.explanationPolicies.find(policy => policy.policyId === card.policyId)!; facts.push({ ...base, factId: `${snapshotId}:${product ? 'product' : 'reading'}:${o.occurrenceId}:function:${card.explanationId}`, kind: 'reference_function', subject: { kind: 'ingredient_reference', ingredientId: mapping.ingredientId }, value: { roleId: card.roleId, explanationId: card.explanationId, explanationRevision: card.revision, sentence: card.sentence, reviewDate: card.reviewDate, evidenceKind: card.evidenceKind, sourceUrl: card.sourceUrl, sourceAttribution: policy.attribution, licenseUrl: policy.licenseUrl, roleDefinitionUrl: policy.roleDefinitionUrl, reviewOwner: policy.reviewOwner, policyId: policy.policyId, policyHash: policy.policyHash, sourceInventoryHash: policy.sourceInventoryHash }, dictionaryDependencies: [mapping.ingredientId, mapping.aliasRecordId, card.explanationId, ...card.dependencies, ...policy.withdrawalDependencies], limitations: [...limitations, 'reference_role_not_product_performance'] }); }
    }
    for (const [index, q] of o.quantities.entries()) if (q.status === 'parsed' || q.status === 'validated') facts.push({ ...base, spans: [q.span], factId: `${snapshotId}:${product ? 'product' : 'reading'}:${o.occurrenceId}:quantity:${index}`, kind: 'declared_quantity', subject, value: q, limitations: [...limitations, ...(q.basis === 'unknown' ? ['quantity_basis_unknown'] : []), ...(q.subject === 'blend' ? ['blend_amount_not_constituent_amount'] : q.subject === 'group' ? ['group_amount_not_constituent_amount'] : [])] });
  }
  if (product && canAssociate && input.kind === 'bound_declaration') for (const assertion of input.labelAssertions ?? []) {
    if (assertion.transcription !== 'clear' || assertion.conditional !== null) continue;
    facts.push({ factId: `${snapshotId}:product:label:${assertion.assertionId}`, occurrenceId: assertion.assertionId, kind: 'product_label_assertion', subject: { kind: 'bound_label_assertion', assertionId: assertion.assertionId, declarationId: input.declaration.declarationId, declarationRevision: input.declaration.revision }, value: { text: assertion.text, attribution: 'label_says', assertionKind: assertion.assertionKind }, spans: [assertion.span], rule: FACT_POLICY_VERSION, sourceDependencies: [assertion.span.observationId], dictionaryDependencies: [], limitations: ['label_claim_not_verified', 'no_ingredient_absence_inference', ...(input.bundle.scope === 'public' && input.bundle.packageConfirmation === 'unconfirmed' ? ['published_source_not_confirmed_package'] : [])], validUntil: input.binding.expiresAt });
  }
  return facts;
}
export function normalize(inputValue: NormalizationInput, release: DictionaryRelease = LOCAL_DICTIONARY_RELEASE, metadata: NormalizationMetadata): NormalizationResult {
  metadata = NormalizationMetadataSchema.parse(metadata);
  const input = NormalizationInputSchema.parse(inputValue);
  const resultBinding = normalizationResultBinding(input.binding, metadata.resultRevision);
  const terminal = (state: 'expired' | 'blocked' | 'parse_limit' | 'failed' | 'no_declaration', reasons: string[], permitted = false): NormalizationResult => deepFreeze(NormalizationResultSchema.parse({ ...resultBinding, state, reasonCodes: reasons, permittedText: permitted && (input.kind === 'source_reading' ? input.sections.length : input.declaration.sections.length) <= PART_TWO_LIMITS.sections ? normalizationLiteral(input) : null }));
  if (!Number.isFinite(Date.parse(metadata.createdAt))) return terminal('failed', ['invalid_created_at']);
  if (Date.parse(metadata.createdAt) >= Date.parse(input.binding.expiresAt)) return terminal('expired', ['evidence_expired']);
  if (input.binding.observations.length + input.binding.attributedEdits.length + input.sourceRefs.length > PART_TWO_LIMITS.dependencies) return terminal('parse_limit', ['dependency_limit'], true);
  if (input.kind === 'bound_declaration' && input.bundle.state === 'none') return terminal('no_declaration', ['no_ingredient_declaration'], true);
  if (input.kind === 'source_reading' && input.evidenceOutcome === 'blocked') return terminal('blocked', ['evidence_blocked']);
  if (input.kind === 'bound_declaration' && !input.bundle.predicate.rightsFreshness.passed) return terminal('blocked', ['source_permission_or_freshness']);
  let dictionary: DictionaryRelease;
  try { dictionary = validateDictionaryRelease(release); } catch { return terminal('blocked', ['dictionary_release_invalid'], true); }
  if (dictionary.provenance.expiresAt && Date.parse(dictionary.provenance.expiresAt) < Date.parse(input.binding.expiresAt)) return terminal('blocked', ['dictionary_deadline_exceeded'], true);
  try {
    const withdrawals = relevantExplanationWithdrawals(dictionary, metadata.withdrawnExplanationDependencies ?? []);
    if (input.kind === 'bound_declaration') { const limit = labelAssertionContextLimit(input.labelAssertions, literalSections(input)); if (limit) throw new ParseLimitError(limit); }
    const parsed = parsedInput(input, dictionary);
    const readingFacts = factsFor(input, parsed.occurrences, dictionary, metadata.snapshotId, false, withdrawals);
    const refs = input.sourceRefs;
    const snapshot: PartTwoSnapshot = { schemaVersion: 2, snapshotId: metadata.snapshotId, binding: input.binding, scope: input.kind === 'source_reading' ? 'private_package' : input.binding.scope, evidenceState: input.kind === 'source_reading' ? input.evidenceOutcome : input.bundle.state === 'none' ? 'blocked' : input.bundle.state, evidenceBasis: input.kind === 'source_reading' || input.binding.scope === 'private_package' ? 'private_package' : 'public_source', packageConfirmation: input.kind === 'source_reading' ? 'unconfirmed' : input.binding.packageConfirmation, claimLimits: { productPresenceAllowed: false, declarationCompleteness: input.kind === 'source_reading' ? 'unestablished' : input.bundle.state === 'accepted' ? 'accepted' : 'partial', negativeClaimsAllowed: false }, literalSections: literalSections(input), labelAssertions: input.kind === 'bound_declaration' ? input.labelAssertions : [], occurrences: parsed.occurrences, facts: readingFacts, unresolvedSpans: parsed.unresolvedSpans, blockers: input.kind === 'source_reading' && input.evidenceOutcome === 'conflict' ? ['source_conflict'] : input.kind === 'bound_declaration' ? input.bundle.uncertaintyReasons : [], versions: normalizationVersions(input, dictionary), dependencyManifest: { sourceRefs: refs, dictionaryRecordIds: [...new Set(readingFacts.flatMap(f => f.dictionaryDependencies))].sort(), dictionaryHash: dictionary.contentHash, labelAssertionPermissions: input.kind === 'bound_declaration' ? input.labelAssertions.map(assertion => ({ assertionId: assertion.assertionId, ...assertion.fieldPermission })) : [], withdrawnExplanationDependencies: withdrawals, explanationPolicies: dictionary.explanationPolicies, dependencyDigest: input.binding.dependencyDigest, deletionEpoch: input.binding.deletionEpoch, policyEpoch: input.binding.policyEpoch, dictionaryEpoch: input.binding.dictionaryEpoch }, observedAt: refs.map(s => s.observedAt).sort()[0], sourceUpdatedAt: input.kind === 'source_reading' ? null : input.declaration.sourceUpdatedAt, createdAt: metadata.createdAt, expiresAt: input.binding.expiresAt };
    const productFacts = input.kind === 'bound_declaration' ? factsFor(input, parsed.occurrences, dictionary, metadata.snapshotId, true, withdrawals) : null;
    return deepFreeze(NormalizationResultSchema.parse({ ...resultBinding, state: 'ready', output: productFacts ? { kind: 'bound', reading: snapshot, productFacts: { ...snapshot, snapshotId: `${metadata.snapshotId}:product`, facts: productFacts, claimLimits: { ...snapshot.claimLimits, productPresenceAllowed: productFacts.some(f => f.kind === 'declared_ingredient' && f.value.modality === 'unconditional') } } } : { kind: 'reading_only', reading: snapshot } }));
  } catch (error) { return terminal(error instanceof ParseLimitError ? 'parse_limit' : 'failed', [error instanceof ParseLimitError ? error.message : 'normalization_failed'], true); }
}
/** Equal revisions are acceptable only when immutable meaning is identical. */
export function normalizationReplayContent(result: NormalizationResult): string {
  const clean = JSON.parse(JSON.stringify(result));
  delete clean.requestId;
  if (clean.state === 'ready') { delete clean.output.reading.binding.requestId; if (clean.output.kind === 'bound') delete clean.output.productFacts.binding.requestId; }
  return canonicalJson(clean);
}


/** Server-authorized current view of an immutable saved interpretation. The
 * caller allocates a monotonic revision and fresh projection ID; history stays
 * untouched. Only dependent reference cards disappear, never label facts. */
export function projectExplanationWithdrawals(resultValue: NormalizationResult, metadataValue: NormalizationMetadata): { result: NormalizationResult; changed: boolean } {
  const result = NormalizationResultSchema.parse(resultValue), metadata = NormalizationMetadataSchema.parse(metadataValue);
  if (result.state !== 'ready') return { result: deepFreeze(result), changed: false };
  const withdrawn = new Set(metadata.withdrawnExplanationDependencies);
  const isWithdrawn = (fact: PartTwoFact, snapshot: PartTwoSnapshot) => fact.kind === 'reference_function' && (fact.dictionaryDependencies.some(id => withdrawn.has(id)) || withdrawn.has(fact.value.explanationId) || withdrawn.has(fact.value.policyId) || snapshot.dependencyManifest.explanationPolicies.some(policy => policy.policyId === fact.value.policyId && policy.withdrawalDependencies.some(id => withdrawn.has(id))));
  const output = result.output, product = output.kind === 'bound' ? output.productFacts : null;
  const changed = output.reading.facts.some(fact => isWithdrawn(fact, output.reading)) || product !== null && product.facts.some(fact => isWithdrawn(fact, product));
  if (!changed) return { result: deepFreeze(result), changed: false };
  if (metadata.resultRevision <= result.resultRevision) throw new Error('Explanation withdrawal requires a new monotonic result revision');
  if (Date.parse(metadata.createdAt) >= Date.parse(result.expiresAt)) throw new Error('Expired interpretation cannot produce a current withdrawal projection');
  const relevant = new Set(result.output.reading.facts.filter(fact => fact.kind === 'reference_function').flatMap(fact => [fact.value.explanationId, fact.value.policyId, ...fact.dictionaryDependencies]));
  for (const policy of result.output.reading.dependencyManifest.explanationPolicies) policy.withdrawalDependencies.forEach(id => relevant.add(id));
  const withdrawals = [...new Set([...result.output.reading.dependencyManifest.withdrawnExplanationDependencies, ...[...withdrawn].filter(id => relevant.has(id))])].sort();
  const retainedDictionaryRecordIds = [...new Set(output.reading.facts.filter(fact => !isWithdrawn(fact, output.reading)).flatMap(fact => fact.dictionaryDependencies))].sort();
  const project = (snapshot: PartTwoSnapshot, product: boolean): PartTwoSnapshot => {
    const facts = snapshot.facts.filter(fact => !isWithdrawn(fact, snapshot));
    return { ...snapshot, snapshotId: product ? `${metadata.snapshotId}:product` : metadata.snapshotId, createdAt: metadata.createdAt, facts, versions: { ...snapshot.versions, factPolicy: FACT_POLICY_VERSION }, dependencyManifest: { ...snapshot.dependencyManifest, dictionaryRecordIds: retainedDictionaryRecordIds, withdrawnExplanationDependencies: withdrawals } };
  };
  const reading = project(result.output.reading, false), productFacts = result.output.kind === 'bound' ? project(result.output.productFacts, true) : null;
  const projection = NormalizationResultSchema.parse({ ...result, resultRevision: metadata.resultRevision, output: productFacts ? { kind: 'bound', reading, productFacts } : { kind: 'reading_only', reading } });
  return { result: deepFreeze(projection), changed: true };
}
