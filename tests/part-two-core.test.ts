import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import fc from 'fast-check';
import { NormalizationInputSchema, NormalizationResultSchema, type NormalizationInput } from '../src/contracts/PartTwo.ts';
import { normalize, normalizationKey, normalizationReplayContent, LOCAL_DICTIONARY_RELEASE, validateDictionaryRelease, dictionaryReleaseHash, lookupName, sha256, canonicalJson, decodePartTwoText, projectExplanationWithdrawals, NormalizationMetadataSchema } from '../src/domain/part-two/index.ts';
import { sourceReading, boundDeclaration, boundLabelDeclaration, p2metadata, p2id } from './fixtures/part-two-core.ts';
const ready = (input: NormalizationInput = sourceReading()) => { const result = normalize(input, LOCAL_DICTIONARY_RELEASE, p2metadata); assert.equal(result.state, 'ready'); if (result.state !== 'ready') throw new Error(JSON.stringify(result)); return result; };
const occurrences = (text: string) => ready(sourceReading(text)).output.reading.occurrences;

test('A01 source-only is private attributed reading; strict boundary forbids product IDs and forged presence', () => {
 const result = ready(); assert.equal(result.output.kind, 'reading_only'); assert.equal(result.output.reading.binding.kind, 'capture'); assert.equal(result.output.reading.claimLimits.negativeClaimsAllowed, false); assert.ok(result.output.reading.facts.every(f => f.subject.kind === 'reading_entry')); assert.equal(result.output.reading.occurrences[0].mapping.state, 'resolved');
 const forged = sourceReading(); assert.equal(NormalizationInputSchema.safeParse({ ...forged, itemId: p2id(10) }).success, false); assert.equal(NormalizationInputSchema.safeParse({ ...forged, claimLimits: { ...forged.claimLimits, productPresenceAllowed: true } }).success, false);
});
test('A02-A04 partial bound entry facts and published package limits survive; no completeness uplift', () => {
 for (const scope of ['public','private_package'] as const) { const result = normalize(boundDeclaration('Niacinamide, Unknown ingredient', scope), LOCAL_DICTIONARY_RELEASE, p2metadata); assert.equal(result.state,'ready'); if(result.state!=='ready'||result.output.kind!=='bound') throw Error('missing bound'); assert.equal(result.output.productFacts.claimLimits.declarationCompleteness,'partial'); assert.equal(result.output.productFacts.claimLimits.negativeClaimsAllowed,false); assert.ok(result.output.productFacts.facts.every(f=>f.subject.kind !== 'reading_entry')); if(scope==='public') assert.ok(result.output.productFacts.facts.every(f=>f.limitations.includes('published_source_not_confirmed_package'))); }
 const result=normalize(boundDeclaration(),LOCAL_DICTIONARY_RELEASE,p2metadata); assert.equal(result.state,'ready');
});
test('A05 whole parenthetical equivalent and numeric locant preserve original spans', () => {
 const list=occurrences('Aqua (Water, Eau), 1,2-Hexanediol'); assert.equal(list.length,2); assert.deepEqual(list.map(o=>o.mapping.state==='resolved'?o.mapping.ingredientId:null),['water','hexanediol']); assert.equal(list[0].nameSpan.raw,'Aqua (Water, Eau)'); assert.equal(list[1].nameSpan.start,19);
});
test('A06-A08 whole polymer, botanical and unsupported blend retain names; hard negatives never fuzzy repair', () => {
 for(const text of ['Acrylates/C10-30 Alkyl Acrylate Crosspolymer','Aloe Barbadensis Leaf Extract']) assert.equal(occurrences(text)[0].mapping.state,'resolved');
 const blend=occurrences('Glycerin (and) Water')[0]; assert.equal(blend.mapping.state,'unresolved'); assert.equal(blend.rawToken,'Glycerin (and) Water');
 const distinct=occurrences('Retinol, Retinyl Palmitate, Hyaluronic Acid, Sodium Hyaluronate, Alcohol, Alcohol Denat., Cetyl Alcohol, Benzyl Alcohol, PEG-8, PEG-80'); assert.equal(new Set(distinct.map(o=>o.mapping.state==='resolved'?o.mapping.ingredientId:null)).size,10);
 for(const text of ['PG-6-Decyltetradecanol','PEG-8O','Retin0l','Aloe Barbadensis Seed Oil']) assert.equal(occurrences(text)[0].mapping.state,'unresolved');
 const input=sourceReading('Niacinamide'); input.sections[0].transcription='uncertain'; assert.equal(ready(input).output.reading.facts.length,0);
});
test('A09 alternatives and may-contain scopes never become definite union and reset at next section', () => {
 const input=sourceReading('May contain (+/-): CI 77491, CI 77492'); input.sections.push({...input.sections[0],sectionId:p2id(20),rawText:'Niacinamide'}); const list=ready(input).output.reading.occurrences; assert.deepEqual(list.map(o=>o.modality),['may_contain','may_contain','unconditional']); assert.ok(occurrences('Retinol or Retinyl Palmitate').every(o=>o.modality==='alternative')); assert.ok(occurrences('Retinol OR Retinyl Palmitate').every(o=>o.modality==='alternative')); assert.ok(ready(input).output.reading.facts.filter(f=>f.kind==='declared_ingredient').slice(0,2).every(f=>f.limitations.includes('conditional_not_definite_presence')));
});
test('review wrapped alternatives never emit definite presence in source or authoritative row paths', () => {
 for (const text of ['Retinol or\nRetinyl Palmitate', 'Retinol\nor Retinyl Palmitate', 'Retinol\nOR\nRetinyl Palmitate', 'Retinol or\r\nRetinyl Palmitate']) {
  for (const factory of [sourceReading, boundDeclaration]) {
   const result=ready(factory(text));
   assert.ok(result.output.reading.occurrences.every(o=>o.modality!=='unconditional'), `${factory.name}: ${text}`);
   assert.ok(result.output.reading.facts.every(f=>f.limitations.includes('conditional_not_definite_presence')), `${factory.name}: definite fact`);
   if(result.output.kind==='bound') assert.equal(result.output.productFacts.claimLimits.productPresenceAllowed,false);
   for(const o of result.output.reading.occurrences) assert.equal(text.slice(o.nameSpan.start,o.nameSpan.end),o.observedName);
  }
 }
});
test('review alternative wrap scope stops at a section header or independent list separator', () => {
 for (const text of ['Retinol or\nRetinyl Palmitate, Water', 'Retinol\nor Retinyl Palmitate; Water', 'Retinol or\nRetinyl Palmitate\nInactive ingredients: Water']) {
  const list=occurrences(text);assert.ok(list.filter(o=>o.observedName.includes('Retin')).every(o=>o.modality!=='unconditional'));assert.equal(list.at(-1)?.observedName,'Water');assert.equal(list.at(-1)?.modality,'unconditional');
 }
 const header=occurrences('Retinol or\nInactive ingredients: Water');assert.notEqual(header[0].modality,'unconditional');assert.equal(header.at(-1)?.modality,'unconditional');
 const input=sourceReading('Retinol or');input.sections.push({...input.sections[0],sectionId:p2id(21),rawText:'Water'});assert.equal(ready(input).output.reading.occurrences.at(-1)?.modality,'unconditional');
});
test('property review whitespace wrapping cannot strengthen an alternative to unconditional facts', () => {
 fc.assert(fc.property(fc.constantFrom('Retinol','Glycerin','Niacinamide'),fc.constantFrom('Retinyl Palmitate','Water','Salicylic Acid'),fc.constantFrom(' ','\n','\r\n','\n  '),fc.constantFrom(' ','\n','\r\n','  \n'),fc.constantFrom('or','OR','Or'),(left,right,before,after,or)=>{
  const text=`${left}${before}${or}${after}${right}`;
  for(const factory of [sourceReading,boundDeclaration]) {const r=ready(factory(text));assert.ok(r.output.reading.occurrences.every(o=>o.modality!=='unconditional'));assert.ok(r.output.reading.facts.every(f=>f.limitations.includes('conditional_not_definite_presence')));}
 }),{seed:20261002,numRuns:200});
});
test('review layout wraps cannot drop chemical modifiers or invent a shorter reviewed identity', () => {
 for(const text of ['Hydrolyzed\nHyaluronic Acid','Sodium Hyaluronate\nCrosspolymer','Unknown prefix\nRetinol'])for(const factory of [sourceReading,boundDeclaration]){
  const r=ready(factory(text));assert.ok(r.output.reading.occurrences.every(o=>o.mapping.state!=='resolved'));assert.equal(r.output.reading.facts.filter(f=>f.kind==='resolved_ingredient_identity').length,0);
  for(const o of r.output.reading.occurrences)assert.equal(text.slice(o.nameSpan.start,o.nameSpan.end),o.observedName);
 }
 const full=occurrences('Sodium\nHyaluronate');assert.equal(full.length,1);assert.equal(full[0].observedName,'Sodium\nHyaluronate');assert.equal(full[0].mapping.state,'resolved');
 const structured=ready(boundDeclaration('Retinol\nGlycerin'));assert.deepEqual(structured.output.reading.occurrences.map(o=>o.mapping.state),['resolved','resolved']);
 const boundary=occurrences('Unknown prefix\nInactive ingredients: Hyaluronic Acid');assert.equal(boundary.at(-1)?.mapping.state,'resolved');assert.equal(boundary.at(-1)?.observedName,'Hyaluronic Acid');
});
test('review printed plus/minus scopes cover every following pigment and stop at explicit section boundaries',()=>{
 for(const sign of ['(+/-)','±','+/-']) {
  const r=ready(sourceReading(`${sign}: CI 77491, CI 77492\nInactive ingredients: Water`));assert.deepEqual(r.output.reading.occurrences.map(o=>o.modality),['may_contain','may_contain','unconditional']);
  assert.ok(r.output.reading.facts.filter(f=>f.occurrenceId!==r.output.reading.occurrences.at(-1)?.occurrenceId).every(f=>f.limitations.includes('conditional_not_definite_presence')));
 }
});
test('A10-A12 quantities attach exact spans/subjects; density and blend composition never guessed', () => {
 for(const text of ['Salicylic Acid 2%','2% Salicylic Acid','Salicylic Acid (2% w/w)']) { const o=occurrences(text)[0]; assert.equal(o.observedName,'Salicylic Acid'); assert.equal(o.quantities[0].value,'2'); assert.equal(text.slice(o.quantities[0].span.start,o.quantities[0].span.end),o.quantities[0].span.raw); }
 const mg=occurrences('Niacinamide 20 mg/g')[0].quantities[0]; assert.equal(mg.convertedPercentWw,'2'); assert.equal(mg.basis,'w/w');
 const volume=occurrences('Niacinamide 20 mg/mL')[0].quantities[0]; assert.equal(volume.convertedPercentWw,null); assert.equal(volume.basis,'w/v');
 assert.equal(occurrences('Niacinamide 2%')[0].quantities[0].basis,'unknown'); assert.equal(occurrences('Niacinamide <1%')[0].quantities[0].operator,'less_than'); assert.equal(occurrences('Niacinamide 1–2%')[0].quantities[0].operator,'range'); assert.equal(occurrences('Niacinamide 2,5%')[0].quantities[0].status,'unresolved');
 const complex=occurrences('15% Vitamin C Complex')[0]; assert.equal(complex.quantities[0].subject,'blend'); assert.equal(complex.mapping.state,'unresolved');
});
test('A13-A15 no inferred concentration/active role, numeric repairs or negative fact variants', () => {
 const input=sourceReading('Niacinamide, Glycerin'); input.sections[0].kind='inactive'; const list=ready(input).output.reading.occurrences; assert.ok(list.every(o=>o.sectionKind==='inactive'&&o.quantities.length===0));
 for(const text of ['Niacinamide 101%','Niacinamide 2–1%','Niacinamide -1%','Niacinamide 1001 mg/g']) { const result=ready(sourceReading(text)); assert.equal(result.output.reading.occurrences[0].quantities[0].status,'invalid'); assert.ok(result.output.reading.facts.every(f=>f.kind!=='declared_quantity')); }
 const empty=ready(sourceReading('')); assert.equal(empty.output.reading.facts.length,0);
 const literal=ready(sourceReading('fragrance-free')); assert.ok(literal.output.reading.facts.every(f=>!JSON.stringify(f).includes('contains'))); assert.equal(literal.output.reading.occurrences[0].mapping.state,'unresolved');
 assert.equal(NormalizationResultSchema.safeParse({...empty,output:{...empty.output,reading:{...empty.output.reading,claimLimits:{...empty.output.reading.claimLimits,negativeClaimsAllowed:true}}}}).success,false);
});
test('A16-A17 releases verify exact hash/collisions and unknown keys remain version scoped', () => {
 const clone=structuredClone(LOCAL_DICTIONARY_RELEASE); clone.aliases.push({...clone.aliases[0],aliasRecordId:'bad',ingredientId:'niacinamide'}); clone.contentHash=dictionaryReleaseHash(clone); assert.throws(()=>validateDictionaryRelease(clone),/collision/);
 const release=structuredClone(LOCAL_DICTIONARY_RELEASE); release.version='v2'; release.aliases.forEach(a=>a.release='v2'); release.contentHash=dictionaryReleaseHash(release); assert.notEqual(normalizationKey(sourceReading(),release),normalizationKey(sourceReading())); assert.equal(Object.isFrozen(LOCAL_DICTIONARY_RELEASE.aliases[0]),true);
});
test('A25 stale/foreign/excess source spans, owner and exact evidence revision fail boundary', () => {
 const input=sourceReading(); assert.equal(NormalizationInputSchema.safeParse({...input,binding:{...input.binding,ownerId:p2id(91)}}).success,false); assert.equal(NormalizationInputSchema.safeParse({...input,sourceRefs:[{...input.sourceRefs[0],sourceRevision:99}]}).success,false);
 const bound=boundDeclaration(); bound.bundle.declarationRevision++; assert.equal(NormalizationInputSchema.safeParse(bound).success,false);
 const foreign=boundDeclaration(); foreign.declaration.sections[0].entries[0].sourceSpans[0].observationId=p2id(99); assert.equal(NormalizationInputSchema.safeParse(foreign).success,false);
});
test('A26 caps and malformed brackets produce typed refusal, preserve permitted text, remain inert', () => {
 for(const text of ['x'.repeat(2001),'('.repeat(9)+'Glycerin'+')'.repeat(9),Array(1002).fill('Aqua').join(',')]) { const result=normalize(sourceReading(text),LOCAL_DICTIONARY_RELEASE,p2metadata); assert.equal(result.state,'parse_limit'); if(result.state==='parse_limit') assert.notEqual(result.permittedText,null); }
 assert.throws(()=>decodePartTwoText(new Uint8Array(262145))); assert.throws(()=>decodePartTwoText(new Uint8Array([0xFF])));
 assert.equal(occurrences('Glycerin (')[0].modality,'unresolved'); assert.equal(occurrences('<script>fetch(secret)</script>')[0].mapping.state,'unresolved');
});
test('A27 Unicode offsets, duplicates and immutable output; no control or uncertain digit identity repair', () => {
 const raw='💧, Cafe\u0301, Niacinamide, Niacinamide'; const list=occurrences(raw); assert.equal(list.length,4); list.forEach(o=>assert.equal(raw.slice(o.nameSpan.start,o.nameSpan.end),o.nameSpan.raw)); assert.equal(list[2].nameSpan.start,11); assert.notEqual(list[2].occurrenceId,list[3].occurrenceId);
 for(const text of ['Niacin\u202Eamide','Niacinamide\uD800','PEG-８']) assert.equal(occurrences(text)[0].mapping.state,'unresolved');
 const lookup=lookupName('  CAFE\u0301   '); assert.equal(lookup.key,'café'); assert.equal(lookup.offsetMap.at(-1)?.sourceEnd,7); assert.equal(Object.isFrozen(ready().output.reading.occurrences[0]),true);
});
test('A31-A32 empty/withdrawn explanations stay empty; qualifiers and fact IDs remain reusable', () => {
 assert.ok(ready().output.reading.facts.every(f=>f.kind!=='reference_function')); const input=sourceReading('May contain: Niacinamide'); const a=ready(input),b=ready(input); assert.deepEqual(a,b); assert.ok(a.output.reading.facts.every(f=>f.limitations.includes('conditional_not_definite_presence')));
});
test('SHA256 and deterministic keys/replay are independent from object ordering/request IDs but private owner matters', () => {
 for(const text of ['', 'abc', '💧']) assert.equal(sha256(text),createHash('sha256').update(text).digest('hex'));
 const input=sourceReading(); const other=structuredClone(input); other.binding.requestId=p2id(80); assert.equal(normalizationKey(input),normalizationKey(other)); assert.equal(normalizationReplayContent(ready(input)),normalizationReplayContent(ready(other)));
 other.binding.ownerId=p2id(81); other.binding.authenticatedOwnerId=p2id(81); assert.notEqual(normalizationKey(input),normalizationKey(other)); assert.equal(canonicalJson({b:1,a:2}),canonicalJson({a:2,b:1}));
});
test('generated lossless Unicode/span/dependency/no-negative invariants (seed 20261002)', () => {
 fc.assert(fc.property(fc.array(fc.oneof(fc.constant('Niacinamide'),fc.constant('Aqua (Water, Eau)'),fc.constant('1,2-Hexanediol'),fc.string({maxLength:40})),{minLength:0,maxLength:25}), names=>{ const raw=names.join('; '); const result=normalize(sourceReading(raw),LOCAL_DICTIONARY_RELEASE,p2metadata); assert.ok(NormalizationResultSchema.safeParse(result).success); if(result.state==='ready'){ const s=result.output.reading; assert.equal(s.claimLimits.negativeClaimsAllowed,false); for(const o of s.occurrences){assert.equal(raw.slice(o.nameSpan.start,o.nameSpan.end),o.nameSpan.raw);o.spans.forEach(span=>assert.equal(raw.slice(span.start,span.end),span.raw));} for(const fact of s.facts)assert.ok(s.occurrences.some(o=>o.occurrenceId===fact.occurrenceId)); } }),{seed:20261002,numRuns:250});
});

test('explicit Unicode generator keeps original UTF16 slices and abstains from obscured exact names', () => {
 fc.assert(fc.property(fc.array(fc.constantFrom('💧','e\u0301','\uD800','\uDC00','\u202E','\u0000','Niacinamide','  ','PEG-８'),{minLength:1,maxLength:30}),parts=>{ const raw=parts.join(', '); const result=ready(sourceReading(raw)); for(const o of result.output.reading.occurrences){ assert.equal(o.nameSpan.raw,raw.slice(o.nameSpan.start,o.nameSpan.end)); if(o.rawToken.includes('\u202E')||o.rawToken.includes('\uD800')||o.rawToken.includes('\uDC00')||o.rawToken.includes('\u0000')) assert.equal(o.mapping.state,'unresolved'); } }),{seed:20261003,numRuns:100});
});
test('bound structured offsets preserve global source positions; failed entry gates do not emit product claims', () => {
 const input=boundDeclaration('2% Salicylic Acid'); input.declaration.sections[0].entries[0].sourceSpans[0].start=40; input.declaration.sections[0].entries[0].sourceSpans[0].end=57;
 const result=normalize(input,LOCAL_DICTIONARY_RELEASE,p2metadata); assert.equal(result.state,'ready'); if(result.state==='ready'){assert.equal(result.output.reading.occurrences[0].nameSpan.start,43);assert.equal(result.output.reading.occurrences[0].quantities[0].span.start,40);}
 const failed=boundDeclaration(); failed.bundle.predicate.association={passed:false,evidenceIds:[],reasons:['unestablished_association']}; const blocked=normalize(failed,LOCAL_DICTIONARY_RELEASE,p2metadata); assert.equal(blocked.state,'ready'); if(blocked.state==='ready'&&blocked.output.kind==='bound')assert.equal(blocked.output.productFacts.facts.length,0);
 const uncertain=boundDeclaration(); uncertain.declaration.sections[0].entries[0].uncertaintyReasons=['ocr_dispute']; const output=normalize(uncertain,LOCAL_DICTIONARY_RELEASE,p2metadata); assert.equal(output.state,'ready');if(output.state==='ready'&&output.output.kind==='bound')assert.equal(output.output.productFacts.facts.length,0);
});

test('review C1 rejects foreign fact subjects, altered spans/values and cross-projection occurrences', () => {
 const original=normalize(boundDeclaration('Niacinamide 2%'),LOCAL_DICTIONARY_RELEASE,p2metadata); assert.equal(original.state,'ready');
 const mutate=(change:(r:any)=>void)=>{const r=JSON.parse(JSON.stringify(original));change(r);assert.equal(NormalizationResultSchema.safeParse(r).success,false);};
 mutate(r=>r.output.productFacts.facts[0].subject.declarationId='foreign');
 mutate(r=>r.output.productFacts.facts[0].subject.declarationRevision=999);
 mutate(r=>r.output.productFacts.facts[0].subject.occurrenceId='foreign');
 mutate(r=>r.output.productFacts.facts[0].spans[0].observationId='foreign');
 mutate(r=>r.output.productFacts.facts[0].spans[0].raw='x'.repeat(r.output.productFacts.facts[0].spans[0].raw.length));
 mutate(r=>r.output.productFacts.facts[0].value.rawName='Retinol');
 mutate(r=>r.output.productFacts.facts.find((f:any)=>f.kind==='resolved_ingredient_identity').value.ingredientId='retinol');
 mutate(r=>r.output.productFacts.facts.find((f:any)=>f.kind==='declared_quantity').value.value='5');
 mutate(r=>r.output.productFacts.occurrences[0].nameSpan.start++);
 mutate(r=>r.output.productFacts.occurrences[0].spans[0].sourceRevision=999);
});
test('review C2 rejects matching internally wrong rows, offsets or section references before normalization', () => {
 const input=boundDeclaration('Niacinamide');input.declaration.sections[0].entries[0].rawToken='Retinol';input.declaration.sections[0].entries[0].sourceSpans[0].end=7;
 assert.equal(NormalizationInputSchema.safeParse(input).success,false);assert.throws(()=>normalize(input,LOCAL_DICTIONARY_RELEASE,p2metadata));
 const spans=boundDeclaration('Aqua, Niacinamide');spans.declaration.sections[0].entries[1].sourceSpans[0].start=7;spans.declaration.sections[0].entries[1].sourceSpans[0].end=18;assert.equal(NormalizationInputSchema.safeParse(spans).success,false);
});
test('review I3 retains combined operator/range as unresolved and emits no quantity facts', () => {
 for(const operator of ['<','≤','>','≥','about <','about ']){const input=sourceReading(`Niacinamide ${operator}1–2%`);const result=ready(input);const q=result.output.reading.occurrences[0].quantities[0];assert.equal(q.status,'unresolved');assert.equal(q.operator,'unresolved');assert.ok(q.reasons.includes('combined_quantity_operators'));assert.ok(result.output.reading.facts.every(f=>f.kind!=='declared_quantity'));assert.equal(q.span.raw,`${operator}1–2%`);}
});
test('review I4 exact decimal bounds/range order reject IEEE754 rounding and negative zero/underflow', () => {
 for(const text of ['Niacinamide 100.0000000000000000001%','Niacinamide 1000.0000000000000000001 mg/g','Niacinamide 1.0000000000000000002–1.0000000000000000001%','Niacinamide -0%','Niacinamide -0.'+'0'.repeat(350)+'1%']){const result=ready(sourceReading(text));assert.equal(result.output.reading.occurrences[0].quantities[0].status,'invalid');assert.ok(result.output.reading.facts.every(f=>f.kind!=='declared_quantity'));}
 const exact=occurrences('Niacinamide 100.0000000000000000000%')[0].quantities[0];assert.equal(exact.status,'parsed');assert.equal(exact.value,'100.0000000000000000000');
 fc.assert(fc.property(fc.integer({min:1,max:300}),precision=>{const result=ready(sourceReading('Niacinamide 100.'+'0'.repeat(precision)+'1%'));assert.equal(result.output.reading.occurrences[0].quantities[0].status,'invalid');}),{seed:20261004,numRuns:100});
});
test('review I5 section cap returns typed refusal without tail truncation or throwing', () => {
 const input=sourceReading();input.sections=Array.from({length:21},(_,n)=>({...input.sections[0],sectionId:p2id(100+n)}));const result=normalize(input,LOCAL_DICTIONARY_RELEASE,p2metadata);assert.equal(result.state,'parse_limit');if(result.state==='parse_limit')assert.equal(result.permittedText,null);assert.ok(NormalizationResultSchema.safeParse(result).success);
});
test('review I6 none declaration returns typed no_declaration without fabricated product facts', () => {
 const input=boundDeclaration();input.bundle.state='none';const result=normalize(input,LOCAL_DICTIONARY_RELEASE,p2metadata);assert.equal(result.state,'no_declaration');assert.equal('output' in result,false);
});
test('review I7 structured table non-cell residuals retain exact unresolved spans', () => {
 const input=boundDeclaration('Glycerin\tExplanation column');input.declaration.sections[0].entries[0].rawToken='Glycerin';input.declaration.sections[0].entries[0].sourceSpans[0].end=8;const result=normalize(input,LOCAL_DICTIONARY_RELEASE,p2metadata);assert.equal(result.state,'ready');if(result.state==='ready'){assert.equal(result.output.reading.occurrences.length,1);assert.equal(result.output.reading.unresolvedSpans[0].raw,'\tExplanation column');assert.equal(result.output.reading.unresolvedSpans[0].start,8);assert.equal(result.output.reading.unresolvedSpans[0].end,27);assert.ok(result.output.reading.facts.every(f=>f.kind!=='declared_ingredient'||f.value.rawName==='Glycerin'));}
});
test('source-only section slices retain global sourceOffset in name/amount/qualifier and mapping spans', () => {
 const input=sourceReading('May contain: Niacinamide 2%');input.sections[0].sourceOffset=40;const result=ready(input);const o=result.output.reading.occurrences[0];assert.equal(o.nameSpan.start,53);assert.equal(o.quantities[0].span.start,65);assert.equal(result.output.reading.unresolvedSpans[0].start,40);if(o.mapping.state==='resolved')assert.equal(o.mapping.offsetMap[0].sourceStart,53);
});


test('cached quantity meaning cannot be strengthened by jointly corrupting occurrence and fact', () => {
 const original=normalize(boundDeclaration('Niacinamide 2%'),LOCAL_DICTIONARY_RELEASE,p2metadata);
 for(const field of ['value','operator','unit','basis','status','convertedPercentWw']) { const r:any=JSON.parse(JSON.stringify(original)); const q=r.output.reading.occurrences[0].quantities[0]; const value=({value:'3',operator:'less_than',unit:'mg/g',basis:'w/w',status:'validated',convertedPercentWw:'2'} as Record<string,string>)[field]; q[field]=value;r.output.productFacts.occurrences[0].quantities[0][field]=value; for(const projection of [r.output.reading,r.output.productFacts])projection.facts.find((f:any)=>f.kind==='declared_quantity').value[field]=value;assert.equal(NormalizationResultSchema.safeParse(r).success,false); }
});


test('review residual C1 rejects foreign or altered unresolved literal ranges against preserved section context', () => {
 const input=boundDeclaration('Glycerin\tExplanation column');input.declaration.sections[0].entries[0].rawToken='Glycerin';input.declaration.sections[0].entries[0].sourceSpans[0].end=8;const original=normalize(input,LOCAL_DICTIONARY_RELEASE,p2metadata);assert.equal(original.state,'ready');
 for(const field of ['observationId','raw']) { const r:any=JSON.parse(JSON.stringify(original));for(const projection of [r.output.reading,r.output.productFacts]){const span=projection.unresolvedSpans[0];span[field]=field==='observationId'?'foreign':'x'.repeat(span.raw.length);}assert.equal(NormalizationResultSchema.safeParse(r).success,false); }
});

test('original Glycerin editorial role card pins independent source rights and never becomes product efficacy', () => {
 const result=ready(sourceReading('Glycerin'));const facts=result.output.reading.facts.filter(f=>f.kind==='reference_function');assert.equal(facts.length,1);const fact=facts[0];if(fact.kind!=='reference_function')throw Error('missing function');
 assert.equal(fact.subject.kind,'ingredient_reference');assert.equal(fact.value.sentence,'Glycerin has a reference humectant role: it can help retain moisture in a formula during use.');assert.equal(fact.value.evidenceKind,'reviewed_editorial');assert.equal(fact.value.sourceUrl,'https://ec.europa.eu/growth/tools-databases/cosing/details/34040');assert.equal(fact.value.licenseUrl,'https://creativecommons.org/licenses/by/4.0/');assert.equal(fact.value.reviewOwner,'Codex-local-editorial-review');assert.match(fact.value.sourceAttribution,/European Commission CosIng.*CC BY 4.0.*Original Derive wording/);assert.ok(fact.limitations.includes('reference_role_not_product_performance'));assert.ok(fact.dictionaryDependencies.includes(fact.value.policyId));assert.equal(result.output.reading.dependencyManifest.explanationPolicies[0].policyHash,fact.value.policyHash);
 const conditional=ready(sourceReading('May contain: Glycerin'));assert.ok(conditional.output.reading.facts.filter(f=>f.kind==='reference_function').every(f=>f.limitations.includes('conditional_not_definite_presence')));
 const uncertain=sourceReading('Glycerin');uncertain.sections[0].transcription='uncertain';assert.equal(ready(uncertain).output.reading.facts.filter(f=>f.kind==='reference_function').length,0);assert.equal(ready(sourceReading('Glycerine')).output.reading.facts.filter(f=>f.kind==='reference_function').length,0);
});
test('missing, withdrawn, expired or permission-disabled explanation withdraws only reference content', () => {
 const hashPolicy=(policy:any)=>{const {policyHash:_,...content}=policy;policy.policyHash=sha256(canonicalJson(content));};
 for(const state of ['empty','withdrawn','expired','revoked','no_display'] as const){const release=structuredClone(LOCAL_DICTIONARY_RELEASE);if(state==='empty'){release.explanations=[];release.explanationVersion='empty-v1';}if(state==='withdrawn')release.explanations[0].state='withdrawn';if(state==='expired')release.explanations[0].expiresAt='2026-10-02T09:59:00Z';if(state==='revoked')release.explanationPolicies[0].revoked=true;if(state==='no_display')release.explanationPolicies[0].operations.display=false;release.explanationPolicies.forEach(hashPolicy);release.contentHash=dictionaryReleaseHash(release);const result=normalize(sourceReading('Glycerin'),release,p2metadata);assert.equal(result.state,'ready');if(result.state==='ready'){assert.equal(result.output.reading.occurrences[0].mapping.state,'resolved');assert.ok(result.output.reading.facts.some(f=>f.kind==='resolved_ingredient_identity'));assert.equal(result.output.reading.facts.filter(f=>f.kind==='reference_function').length,0);}}
});
test('corrupted explanation rights, attribution or identity cannot hydrate through strict ready boundary', () => {
 const original=ready(sourceReading('Glycerin'));
 for(const field of ['policyId','policyHash','sourceInventoryHash','licenseUrl','sourceAttribution','reviewOwner','roleDefinitionUrl'] as const){const r:any=JSON.parse(JSON.stringify(original));const fact=r.output.reading.facts.find((f:any)=>f.kind==='reference_function');fact.value[field]=['licenseUrl','roleDefinitionUrl'].includes(field)?'https://example.invalid/':field.includes('Hash')?'f'.repeat(64):'foreign';assert.equal(NormalizationResultSchema.safeParse(r).success,false);}
 const foreign:any=JSON.parse(JSON.stringify(original));foreign.output.reading.facts.find((f:any)=>f.kind==='reference_function').subject.ingredientId='niacinamide';assert.equal(NormalizationResultSchema.safeParse(foreign).success,false);
});


test('trusted durable explanation withdrawals omit only cards and change relevant semantic cache keys', () => {
 const input=sourceReading('Glycerin 2%');const baseline=ready(input);const card=LOCAL_DICTIONARY_RELEASE.explanations[0],policy=LOCAL_DICTIONARY_RELEASE.explanationPolicies[0];
 for(const withdrawn of [card.explanationId,...card.dependencies,policy.policyId,...policy.withdrawalDependencies]){const result=normalize(input,LOCAL_DICTIONARY_RELEASE,{...p2metadata,withdrawnExplanationDependencies:[withdrawn]});assert.equal(result.state,'ready');if(result.state==='ready'){assert.ok(result.output.reading.facts.some(f=>f.kind==='declared_ingredient'));assert.ok(result.output.reading.facts.some(f=>f.kind==='resolved_ingredient_identity'));assert.ok(result.output.reading.facts.some(f=>f.kind==='declared_quantity'));assert.ok(result.output.reading.facts.every(f=>f.kind!=='reference_function'));assert.deepEqual(result.output.reading.occurrences,baseline.output.reading.occurrences);assert.deepEqual(result.output.reading.dependencyManifest.withdrawnExplanationDependencies,[withdrawn]);}assert.notEqual(normalizationKey(input,LOCAL_DICTIONARY_RELEASE,[withdrawn]),normalizationKey(input));}
 assert.equal(normalizationKey(input,LOCAL_DICTIONARY_RELEASE,['irrelevant']),normalizationKey(input));assert.equal(normalizationKey(input,LOCAL_DICTIONARY_RELEASE,[card.explanationId,policy.policyId]),normalizationKey(input,LOCAL_DICTIONARY_RELEASE,[policy.policyId,card.explanationId]));
 assert.equal(NormalizationMetadataSchema.safeParse({...p2metadata,withdrawnExplanationDependencies:['x','x']}).success,false);assert.equal(NormalizationMetadataSchema.safeParse({...p2metadata,withdrawnExplanationDependencies:Array.from({length:1001},(_,n)=>String(n))}).success,false);assert.equal(NormalizationMetadataSchema.safeParse({...p2metadata,withdrawnExplanationDependencies:[card.explanationId],forgedAuthority:true}).success,false);
});
test('rollback of explanation release cannot resurrect a card when trusted tombstone remains', () => {
 const input=sourceReading('Glycerin'),withdrawal=LOCAL_DICTIONARY_RELEASE.explanations[0].explanationId;const r2=structuredClone(LOCAL_DICTIONARY_RELEASE);r2.version='synthetic-later-release';r2.aliases.forEach(a=>a.release=r2.version);r2.contentHash=dictionaryReleaseHash(r2);
 for(const dictionary of [LOCAL_DICTIONARY_RELEASE,r2,LOCAL_DICTIONARY_RELEASE]){const result=normalize(input,dictionary,{...p2metadata,withdrawnExplanationDependencies:[withdrawal]});assert.equal(result.state,'ready');if(result.state==='ready')assert.ok(result.output.reading.facts.every(f=>f.kind!=='reference_function'));}
});
test('saved explanation withdrawal produces new authorized projection while preserving independent fact IDs and immutable history', () => {
 for(const scope of ['public','private_package'] as const){const input=boundDeclaration('Glycerin 2%',scope);const original=normalize(input,LOCAL_DICTIONARY_RELEASE,p2metadata);assert.equal(original.state,'ready');if(original.state!=='ready')throw Error('missing original');const snapshotBefore=normalizationReplayContent(original),withdrawn=LOCAL_DICTIONARY_RELEASE.explanations[0].explanationId;
 const metadata={...p2metadata,snapshotId:p2id(99),createdAt:'2026-10-02T10:01:00Z',resultRevision:2,withdrawnExplanationDependencies:[withdrawn]};const projected=projectExplanationWithdrawals(original,metadata);assert.equal(projected.changed,true);assert.equal(projected.result.state,'ready');if(projected.result.state==='ready'){assert.equal(projected.result.resultRevision,2);assert.equal(projected.result.output.reading.snapshotId,p2id(99));assert.deepEqual(projected.result.output.reading.binding,original.output.reading.binding);assert.deepEqual(projected.result.output.reading.facts,original.output.reading.facts.filter(f=>f.kind!=='reference_function'));assert.deepEqual(projected.result.output.reading.occurrences,original.output.reading.occurrences);assert.deepEqual(projected.result.output.reading.literalSections,original.output.reading.literalSections);assert.equal(projected.result.output.kind,'bound');}
 assert.equal(normalizationReplayContent(original),snapshotBefore);assert.throws(()=>projectExplanationWithdrawals(original,{...metadata,resultRevision:1}),/monotonic/);assert.equal(projectExplanationWithdrawals(projected.result,{...metadata,resultRevision:3,withdrawnExplanationDependencies:[]}).changed,false);
 }
 const unbound=ready(sourceReading('Glycerin'));const projected=projectExplanationWithdrawals(unbound,{...p2metadata,resultRevision:2,snapshotId:p2id(99),withdrawnExplanationDependencies:['cosing-humectant-definition']});assert.equal(projected.result.state,'ready');if(projected.result.state==='ready')assert.equal(projected.result.output.kind,'reading_only');
});
test('shared ready boundary rejects stale reference cards when its withdrawal manifest says recalled', () => {
 const stale:any=JSON.parse(JSON.stringify(ready(sourceReading('Glycerin'))));stale.output.reading.dependencyManifest.withdrawnExplanationDependencies=['cosing-entry-34040'];assert.equal(NormalizationResultSchema.safeParse(stale).success,false);
});


test('review group amounts preserve whole subjects and never attach an ambiguous alternative amount to one ingredient', () => {
 for (const text of ['2% (Glycerin + Water)', 'Glycerin + Water 2% w/w', 'Retinol and Glycerin 2%']) for(const factory of [sourceReading,boundDeclaration]) {
  const r=ready(factory(text));assert.equal(r.output.reading.occurrences.length,1);const o=r.output.reading.occurrences[0];assert.equal(o.quantities[0].subject,'group');assert.equal(o.mapping.state,'unresolved');assert.ok(r.output.reading.facts.filter(f=>f.kind==='declared_quantity').every(f=>f.value.subject==='group'&&f.limitations.includes('group_amount_not_constituent_amount')));assert.equal(o.nameSpan.raw,text.slice(o.nameSpan.start,o.nameSpan.end));
 }
 for (const text of ['2% (Retinol or Retinyl Palmitate)','Retinol or Retinyl Palmitate 2%', '2% Retinol or Retinyl Palmitate']) for(const factory of [sourceReading,boundDeclaration]) {
  const r=ready(factory(text));assert.ok(r.output.reading.facts.every(f=>f.kind!=='declared_quantity'));for(const o of r.output.reading.occurrences){assert.ok(o.quantities.every(q=>q.subject!=='ingredient'&&q.convertedPercentWw===null));assert.equal(o.nameSpan.raw,text.slice(o.nameSpan.start,o.nameSpan.end));}
 }
});
test('review any overlapping entry uncertainty or condition taints the complete resulting name and printed amount', () => {
 for(const raw of ['Glycerin 2%', 'Glycerin 20 mg/g']) {
  const input=sourceReading(raw);input.sections[0].entryRefs=[{entryId:p2id(150),start:0,end:8,uncertaintyReasons:['ocr_dispute'],conditional:null}];const o=ready(input).output.reading.occurrences[0];assert.equal(o.transcription,'uncertain');assert.equal(o.mapping.state,'unresolved');assert.ok(o.quantities.every(q=>!['parsed','validated'].includes(q.status)&&q.convertedPercentWw===null));assert.equal(ready(input).output.reading.facts.length,0);
  const digit=sourceReading(raw);const start=raw.indexOf('2');digit.sections[0].entryRefs=[{entryId:p2id(151),start,end:start+1,uncertaintyReasons:['printed_digit_disputed'],conditional:null}];const quantity=ready(digit).output.reading.occurrences[0].quantities[0];assert.equal(quantity.status,'conflict');assert.equal(quantity.convertedPercentWw,null);
  const qualified=sourceReading(raw);qualified.sections[0].entryRefs=[{entryId:p2id(152),start:1,end:2,uncertaintyReasons:[],conditional:'may contain'}];assert.equal(ready(qualified).output.reading.occurrences[0].modality,'may_contain');assert.ok(ready(qualified).output.reading.facts.every(f=>f.limitations.includes('conditional_not_definite_presence')));
  const bound=boundDeclaration(raw);bound.declaration.sections[0].entries[0].uncertaintyReasons=['printed_digit_disputed'];const r=ready(bound);assert.equal(r.output.reading.occurrences[0].quantities[0].status,'conflict');if(r.output.kind==='bound')assert.equal(r.output.productFacts.facts.length,0);
 }
 const rows=sourceReading('Retinol\nGlycerin');rows.sections[0].entryRefs=[{entryId:p2id(153),start:0,end:7,uncertaintyReasons:['ocr_dispute'],conditional:null},{entryId:p2id(154),start:8,end:16,uncertaintyReasons:[],conditional:null}];assert.deepEqual(ready(rows).output.reading.occurrences.map(o=>o.transcription),['uncertain','clear']);
});
test('review preferred names are exact dictionary names and old immutable mappings remain parseable', () => {
 const r=ready(sourceReading('Eau'));const mapping=r.output.reading.occurrences[0].mapping;assert.equal(mapping.state,'resolved');if(mapping.state==='resolved')assert.equal(mapping.preferredName,'Aqua');
 const old:any=structuredClone(r);delete old.output.reading.occurrences[0].mapping.preferredName;assert.equal(NormalizationResultSchema.safeParse(old).success,true);
});
test('review printed active/inactive headings preserve attributed section kind without regulatory inference', () => {
 const r=ready(sourceReading('Active ingredients: Retinol\nInactive ingredients: Water'));assert.deepEqual(r.output.reading.occurrences.map(o=>o.sectionKind),['active','inactive']);assert.ok(r.output.reading.facts.every(f=>f.limitations.includes('printed_section_heading_not_regulatory_verification')));assert.equal(r.output.reading.claimLimits.declarationCompleteness,'unestablished');
});
test('property review wrapped chemical modifiers retain exact whole-name scope (seed 20261006)', () => {
 fc.assert(fc.property(fc.constantFrom(['Hydrolyzed','Hyaluronic Acid'],['Sodium Hyaluronate','Crosspolymer'],['Unknown prefix','Retinol']),fc.constantFrom('\n','\r\n','  \n  '),(parts,wrap)=>{const raw=parts.join(wrap);for(const factory of [sourceReading,boundDeclaration]){const r=ready(factory(raw));assert.ok(r.output.reading.occurrences.every(o=>o.mapping.state!=='resolved'));assert.ok(r.output.reading.facts.every(f=>f.kind!=='resolved_ingredient_identity'));for(const o of r.output.reading.occurrences)assert.equal(o.nameSpan.raw,raw.slice(o.nameSpan.start,o.nameSpan.end));}}),{seed:20261006,numRuns:100});
});
test('property review every positive overlapping disputed span suppresses interpreted identity and quantities (seed 20261007)', () => {
 fc.assert(fc.property(fc.integer({min:0,max:15}),fc.integer({min:1,max:16}),(start,width)=>{const raw='Glycerin 20 mg/g',end=Math.min(raw.length,start+width);if(start>=end)return;const input=sourceReading(raw);input.sections[0].entryRefs=[{entryId:p2id(155),start,end,uncertaintyReasons:['disputed_literal'],conditional:null}];const r=ready(input);assert.equal(r.output.reading.facts.length,0);for(const o of r.output.reading.occurrences){assert.equal(o.transcription,'uncertain');assert.ok(o.quantities.every(q=>!['parsed','validated'].includes(q.status)&&q.convertedPercentWw===null));}}),{seed:20261007,numRuns:200});
});
test('property review group and alternative amount placement cannot become a constituent concentration (seed 20261008)', () => {
 fc.assert(fc.property(fc.constantFrom('Glycerin','Retinol','Niacinamide'),fc.constantFrom('Water','Retinyl Palmitate'),fc.constantFrom('+','and','or'),fc.constantFrom(true,false),fc.integer({min:1,max:100}),(left,right,connector,prefix,value)=>{const name=`${left} ${connector} ${right}`,raw=prefix?`${value}% (${name})`:`${name} ${value}% w/w`;for(const factory of [sourceReading,boundDeclaration]){const r=ready(factory(raw));for(const o of r.output.reading.occurrences){assert.ok(o.quantities.every(q=>q.subject!=='ingredient'));assert.equal(o.nameSpan.raw,raw.slice(o.nameSpan.start,o.nameSpan.end));}assert.ok(r.output.reading.facts.filter(f=>f.kind==='declared_quantity').every(f=>f.value.subject==='group'));}}),{seed:20261008,numRuns:100});
});
test('review adversarial newline streams hit a bounded whole-token work refusal without truncation', () => {
 const raw='x\n'.repeat(25000);const result=normalize(sourceReading(raw),LOCAL_DICTIONARY_RELEASE,p2metadata);assert.equal(result.state,'parse_limit');if(result.state==='parse_limit'){assert.ok(result.reasonCodes.includes('occurrence_codepoint_limit'));assert.equal(result.permittedText?.sections[0].text,raw);}
});
test('A15 authoritative exact label assertions emit only attributed bound product facts with separate roots', () => {
 for(const scope of ['private_package','public'] as const)for(const kind of ['category','usage','purpose','claim'] as const){const input=boundLabelDeclaration(kind==='claim'?'fragrance-free':'Exact declared '+kind,kind,scope),r=ready(input);assert.equal(r.output.kind,'bound');assert.ok(r.output.reading.facts.every(f=>f.kind!=='product_label_assertion'));if(r.output.kind!=='bound')throw Error('missing bound');const labels=r.output.productFacts.facts.filter(f=>f.kind==='product_label_assertion');assert.equal(labels.length,1);const label=labels[0];if(label.kind!=='product_label_assertion')throw Error('missing label');assert.equal(label.value.text,input.labelAssertions![0].text);assert.equal(label.value.attribution,'label_says');assert.equal(label.value.assertionKind,kind);assert.equal(label.subject.assertionId,input.labelAssertions![0].assertionId);assert.deepEqual(label.spans,[input.labelAssertions![0].span]);assert.ok(label.limitations.includes('label_claim_not_verified'));assert.ok(label.limitations.includes('no_ingredient_absence_inference'));assert.equal(r.output.productFacts.claimLimits.negativeClaimsAllowed,false);assert.equal(r.output.reading.occurrences.length,1);assert.equal(r.output.reading.occurrences[0].observedName,'Glycerin');assert.deepEqual(r.output.reading.labelAssertions,input.labelAssertions);assert.deepEqual(r.output.reading.dependencyManifest.labelAssertionPermissions,input.labelAssertions!.map(a=>({assertionId:a.assertionId,...a.fieldPermission})));}
 const noInput=ready(boundDeclaration('fragrance-free'));if(noInput.output.kind==='bound')assert.ok(noInput.output.productFacts.facts.every(f=>f.kind!=='product_label_assertion'));
 const source=sourceReading('fragrance-free');assert.ok(ready(source).output.reading.facts.every(f=>f.kind!=='product_label_assertion'));assert.equal(NormalizationInputSchema.safeParse({...source,labelAssertions:boundLabelDeclaration().labelAssertions}).success,false);
});
test('label assertions refuse wrong permissions/source spans/bindings and abstain on uncertain, conditional or failed association', () => {
 const original=boundLabelDeclaration();for(const change of [(a:any)=>a.fieldPermission.permitted=false,(a:any)=>a.fieldPermission.policyId='foreign',(a:any)=>a.fieldPermission.policyVersion='wrong',(a:any)=>a.fieldPermission.assertionKind='usage',(a:any)=>a.fieldPermission.expiresAt='2026-10-02T09:00:00Z',(a:any)=>a.span.observationId='foreign',(a:any)=>a.span.sourceRevision=99,(a:any)=>a.span.start++,(a:any)=>a.text='contains no fragrance',(a:any)=>a.sourceText='x'.repeat(a.sourceText.length)]){const bad=structuredClone(original);change(bad.labelAssertions![0]);assert.equal(NormalizationInputSchema.safeParse(bad).success,false);}
 for(const state of ['uncertain','conflict','conditional','association'] as const){const input=boundLabelDeclaration();if(state==='uncertain'||state==='conflict')input.labelAssertions![0].transcription=state;if(state==='conditional')input.labelAssertions![0].conditional='if diluted';if(state==='association')input.bundle.predicate.association={passed:false,evidenceIds:[],reasons:['unassociated_label']};const r=ready(input);if(r.output.kind!=='bound')throw Error('missing bound');assert.ok(r.output.productFacts.facts.every(f=>f.kind!=='product_label_assertion'));}
 const old:any=structuredClone(ready(boundDeclaration()));delete old.output.reading.labelAssertions;delete old.output.reading.dependencyManifest.labelAssertionPermissions;if(old.output.kind==='bound'){delete old.output.productFacts.labelAssertions;delete old.output.productFacts.dependencyManifest.labelAssertionPermissions;}assert.equal(NormalizationResultSchema.safeParse(old).success,true);
});
test('strict saved output rejects fabricated or strengthened label assertions independently of ingredient occurrences', () => {
 const original=ready(boundLabelDeclaration());for(const change of [(f:any)=>f.subject.assertionId='foreign',(f:any)=>f.subject.declarationId='foreign',(f:any)=>f.subject.declarationRevision=99,(f:any)=>f.occurrenceId='foreign',(f:any)=>f.value.text='Fragrance absent',(f:any)=>f.value.assertionKind='purpose',(f:any)=>f.value.attribution='verified',(f:any)=>f.spans[0].start++,(f:any)=>f.spans[0].observationId='foreign',(f:any)=>f.sourceDependencies=['foreign'],(f:any)=>f.limitations=[],(f:any)=>f.dictionaryDependencies=['glycerin']]){const r:any=structuredClone(original);const f=r.output.productFacts.facts.find((f:any)=>f.kind==='product_label_assertion');change(f);assert.equal(NormalizationResultSchema.safeParse(r).success,false);}
 for(const field of ['policyId','policyVersion','policyEpoch','expiresAt']){const r:any=structuredClone(original);r.output.productFacts.labelAssertions[0].fieldPermission[field]=field==='policyEpoch'?99:field==='expiresAt'?'2026-10-02T09:00:00Z':'foreign';assert.equal(NormalizationResultSchema.safeParse(r).success,false);}
});

test('review assertion contexts obey original-source and duplicated-root bounds with typed refusal', () => {
 const wide=boundLabelDeclaration();wide.labelAssertions![0].sourceText+='💧'.repeat(50001);wide.sourceRefs[0].sourceTextHash=sha256(wide.labelAssertions![0].sourceText);const unicode=normalize(wide,LOCAL_DICTIONARY_RELEASE,p2metadata);assert.equal(unicode.state,'parse_limit');if(unicode.state==='parse_limit')assert.ok(unicode.reasonCodes.includes('label_assertion_source_limit'));
 const bytes=boundLabelDeclaration();bytes.labelAssertions![0].sourceText+='💧'.repeat(65536);bytes.sourceRefs[0].sourceTextHash=sha256(bytes.labelAssertions![0].sourceText);const large=normalize(bytes,LOCAL_DICTIONARY_RELEASE,p2metadata);assert.equal(large.state,'parse_limit');
 const duplicated=boundLabelDeclaration();duplicated.labelAssertions![0].sourceText+='x'.repeat(4000);duplicated.sourceRefs[0].sourceTextHash=sha256(duplicated.labelAssertions![0].sourceText);duplicated.labelAssertions=Array.from({length:70},(_,n)=>({...duplicated.labelAssertions![0],assertionId:p2id(200+n)}));const repeated=normalize(duplicated,LOCAL_DICTIONARY_RELEASE,p2metadata);assert.equal(repeated.state,'parse_limit');if(repeated.state==='parse_limit')assert.ok(repeated.reasonCodes.includes('label_assertion_root_copy_limit'));
 const forged:any=structuredClone(ready(boundLabelDeclaration()));for(const snapshot of [forged.output.reading,forged.output.productFacts])snapshot.labelAssertions[0].sourceText+='x'.repeat(50001);assert.equal(NormalizationResultSchema.safeParse(forged).success,false);
});

test('review cached quantity subject/status and complete label source hashes cannot be jointly strengthened', () => {
 const group:any=structuredClone(ready(sourceReading('Glycerin + Water 2% w/w')));group.output.reading.occurrences[0].quantities[0].subject='ingredient';group.output.reading.facts.find((f:any)=>f.kind==='declared_quantity').value.subject='ingredient';assert.equal(NormalizationResultSchema.safeParse(group).success,false);
 const disputed=sourceReading('Glycerin 20 mg/g');disputed.sections[0].transcription='uncertain';const ambiguous:any=structuredClone(ready(disputed));ambiguous.output.reading.occurrences[0].quantities[0].status='validated';ambiguous.output.reading.occurrences[0].quantities[0].convertedPercentWw='2';assert.equal(NormalizationResultSchema.safeParse(ambiguous).success,false);
 const original=ready(boundLabelDeclaration());const changed:any=structuredClone(original);for(const snapshot of [changed.output.reading,changed.output.productFacts]){const a=snapshot.labelAssertions[0],raw='x'.repeat(a.text.length);a.sourceText=a.sourceText.slice(0,a.span.start)+raw+a.sourceText.slice(a.span.end);a.text=raw;a.span.raw=raw;}const f=changed.output.productFacts.facts.find((f:any)=>f.kind==='product_label_assertion');f.value.text=changed.output.productFacts.labelAssertions[0].text;f.spans[0].raw=f.value.text;assert.equal(NormalizationResultSchema.safeParse(changed).success,false);
 const missing=boundLabelDeclaration();delete missing.sourceRefs[0].sourceTextHash;assert.equal(NormalizationInputSchema.safeParse(missing).success,false);
});

test('review residual structured alternative gaps taint printed quantity subjects/status/conversions', () => {
 const raw='Retinol or\nRetinyl Palmitate 20 mg/g',input=boundDeclaration(raw),section=input.declaration.sections[0],base=section.entries[0],second=structuredClone(base);base.rawToken='Retinol';base.sourceSpans[0].end=7;second.entryId=p2id(151);second.order=1;second.rawToken='Retinyl Palmitate 20 mg/g';second.sourceSpans[0].start=raw.indexOf(second.rawToken);second.sourceSpans[0].end=raw.length;section.entries=[base,second];const r=ready(input);assert.ok(r.output.reading.occurrences.every(o=>o.modality==='unresolved'));const q=r.output.reading.occurrences[1].quantities[0];assert.equal(q.subject,'unresolved');assert.equal(q.status,'unresolved');assert.equal(q.convertedPercentWw,null);assert.ok(r.output.reading.facts.every(f=>f.kind!=='declared_quantity'));
 const forged:any=structuredClone(r);for(const snapshot of [forged.output.reading,forged.output.productFacts]){const q=snapshot.occurrences[1].quantities[0];q.subject='ingredient';q.status='validated';q.convertedPercentWw='2';}assert.equal(NormalizationResultSchema.safeParse(forged).success,false);
});
test('review bound literal plus/minus context and header-first may-contain scope cannot produce definite side facts', () => {
 for(const sign of ['(+/-)','±','+/-'])for(const factory of [sourceReading,boundDeclaration])for(const prefix of ['', 'Ingredients: ']){const raw=`${prefix}${sign}: CI 77491, CI 77492`,r=ready(factory(raw));assert.deepEqual(r.output.reading.occurrences.map(o=>o.modality),['may_contain','may_contain']);assert.deepEqual(r.output.reading.occurrences.map(o=>o.observedName),['CI 77491','CI 77492']);assert.ok(r.output.reading.facts.every(f=>f.limitations.includes('conditional_not_definite_presence')));if(r.output.kind==='bound')assert.equal(r.output.productFacts.claimLimits.productPresenceAllowed,false);for(const o of r.output.reading.occurrences)assert.equal(raw.slice(o.nameSpan.start,o.nameSpan.end),o.observedName);}
 for(const factory of [sourceReading,boundDeclaration]){const r=ready(factory('Ingredients: May contain (+/-): CI 77491, CI 77492'));assert.deepEqual(r.output.reading.occurrences.map(o=>o.modality),['may_contain','may_contain']);assert.deepEqual(r.output.reading.occurrences.map(o=>o.observedName),['CI 77491','CI 77492']);}
 const reset=ready(sourceReading('Ingredients: May contain (+/-): CI 77491, CI 77492\nInactive ingredients: Water'));assert.deepEqual(reset.output.reading.occurrences.map(o=>o.modality),['may_contain','may_contain','unconditional']);
});

test('review explicit section reset cannot silently retain a conflicting inherited bound qualifier', () => {
 const raw='Ingredients:\nMay contain ±: CI 77491, CI 77492\nInactive Ingredients: Glycerin';const source=ready(sourceReading(raw));assert.deepEqual(source.output.reading.occurrences.map(o=>[o.observedName,o.modality]),[['CI 77491','may_contain'],['CI 77492','may_contain'],['Glycerin','unconditional']]);
 const bound=ready(boundDeclaration(raw)),last=bound.output.reading.occurrences.at(-1)!;assert.equal(last.observedName,'Glycerin');assert.equal(last.sectionKind,'inactive');assert.equal(last.modality,'unresolved');assert.ok(last.limitations.includes('conditional_context_conflict'));assert.ok(bound.output.reading.facts.every(f=>f.occurrenceId!==last.occurrenceId));
});
