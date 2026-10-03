import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProductTruthSnapshotV1 } from '../src/contracts/ProductTruthSnapshot.ts';
import { evaluateProductCheckFacts, type StoredProductEvidence } from '../src/domain/product-check-facts/evaluate.ts';
import { describeProductCheckFacts } from '../src/presentation/product-check-facts/format.ts';
import { loadProductCheckFacts } from '../src/services/remote/productCheckFacts.ts';

const CASE='22222222-2222-4222-8222-222222222222';
const SNAP='33333333-3333-4333-8333-333333333333';
const PRODUCT='44444444-4444-4444-8444-444444444444';
const VARIANT='55555555-5555-4555-8555-555555555555';
const FORMULA='66666666-6666-4666-8666-666666666666';
const EVIDENCE='77777777-7777-4777-8777-777777777777';
const NOW='2026-09-29T00:00:00.000Z';
function snapshot(verified=false):ProductTruthSnapshotV1{
  return {schemaVersion:1,snapshotId:SNAP,createdAt:NOW,resolutionCaseId:CASE,caseRevision:1,
    resolverVersion:'s6-p0a-1',state:verified?'verified_product_formula':'identified_formula_unverified',
    product:{productId:PRODUCT,brand:'Example',name:'Personal care',variantId:VARIANT,variantName:'Original'},
    identityStatus:'identified',formula:verified?{formulaVersionId:FORMULA,verificationStatus:'verified',
      appliesToSelectedVariant:true,ingredients:['Water','Glycerin'],observedAt:NOW,
      provenanceType:'manufacturer',publicSourceUrl:null}:null,
    identifiers:[],evidence:[],catalogReferences:{productId:PRODUCT,variantId:VARIANT,formulaVersionId:verified?FORMULA:null},
    unknownFields:verified?[]:['formula'],conflicts:[],nextRequiredEvidence:verified?'none':'ingredients',
    customerConfirmation:'not_required',founderReview:'not_needed'};
}
function row(evidence_type:StoredProductEvidence['evidence_type'],text:string,id=EVIDENCE):StoredProductEvidence{
  return {id,evidence_type,source_type:'member_input',extracted_text:text};
}
const category=(value:'deodorant'|'hair_care'|'sunscreen'|'body_care')=>({
  productId:PRODUCT,category:value,sourceRevision:'a'.repeat(64),
});
const assess=(evidence:StoredProductEvidence[],cat:ReturnType<typeof category>|null=null,verified=false)=>{
  const sealed=snapshot(verified);
  sealed.evidence=evidence.map((entry)=>({evidenceId:entry.id,type:entry.evidence_type,source:entry.source_type,authority:'candidate'}));
  return evaluateProductCheckFacts({snapshot:sealed,evidence,acceptedCategory:cat,createdAt:NOW});
};

test('deodorant and antiperspirant statements stay label observations, not sweat or safety claims',()=>{
  const packet=assess([row('front_label','Original Deodorant + Antiperspirant')],category('deodorant'));
  assert.equal(packet.category,'deodorant');
  assert.deepEqual(packet.facts.map(f=>f.code),['catalog_category','deodorant_statement','antiperspirant_statement']);
  assert.equal(packet.facts[1].certainty,'observed_unverified');
  assert.equal(packet.facts[1].basis.kind,'submitted_label');
  const view=describeProductCheckFacts(packet,{caseId:CASE,snapshotId:SNAP});
  assert(view);
  assert.match(view.cards[2].text,/supplied label says antiperspirant/i);
  assert.doesNotMatch(JSON.stringify(view),/safe|prevents sweat|suitable|efficacy/i);
});

test('hair category does not invent shampoo subtype; label can report shampoo and conditioner separately',()=>{
  const noLabel=assess([],category('hair_care'));
  assert.deepEqual(noLabel.facts.map(f=>f.code),['catalog_category']);
  const withLabel=assess([row('front_label','Shampoo + Conditioner 2 in 1')],category('hair_care'));
  assert.deepEqual(withLabel.facts.map(f=>f.code),['catalog_category','shampoo_statement','conditioner_statement']);
  assert.equal(withLabel.nextEvidence,'ingredients');
});

test('sunscreen SPF, broad-spectrum and 80-minute water resistance are bounded observations',()=>{
  const packet=assess([row('front_label','Broad Spectrum SPF 50 Water Resistant (80 minutes) Drug Facts')],category('sunscreen'));
  assert.deepEqual(packet.facts.map(f=>f.code),[
    'catalog_category','broad_spectrum_statement','drug_facts_statement','spf_statement','water_resistance_statement',
  ]);
  const view=describeProductCheckFacts(packet,{caseId:CASE,snapshotId:SNAP});
  assert(view);
  assert.match(view.cards[3].text,/supplied label text says SPF 50/i);
  assert(!packet.missing.includes('drug_facts'));
});

test('conflicting SPF observations do not choose one number',()=>{
  const packet=assess([row('front_label','SPF 30'),row('front_label','SPF 50','88888888-8888-4888-8888-888888888888')],category('sunscreen'));
  assert(!packet.facts.some(f=>f.code==='spf_statement'));
  assert(packet.missing.includes('conflicting_spf'));
});

test('negated label statements cannot become positive product facts',()=>{
  const packet=assess([row('front_label','Not a deodorant. No antiperspirant. Not broad spectrum. Not water resistant (80 minutes). No Drug Facts.')]);
  assert.deepEqual(packet.facts,[]);
  assert(packet.missing.includes('ingredient_list'));
});

test('positive statements retain their source after a separate negated label',()=>{
  const secondId='88888888-8888-4888-8888-888888888888';
  const packet=assess([row('front_label','Not water resistant (40 minutes).'),
    row('front_label','Water Resistant (80 minutes).',secondId)]);
  assert.equal(packet.facts.find(f=>f.code==='water_resistance_statement')?.value,'80 minutes');
  assert.deepEqual(packet.facts.find(f=>f.code==='water_resistance_statement')?.basis,
    {kind:'submitted_label',evidenceId:secondId,extraction:'member_input'});
});

test('submitted ingredient names remain incomplete observations; verified package formula is distinct',()=>{
  const observed=assess([row('ingredients','Ingredients: Water, Glycerin, Fragrance')],category('body_care'));
  assert.equal(observed.facts.find(f=>f.code==='observed_ingredients')?.certainty,'observed_unverified');
  assert(!observed.facts.some(f=>f.code==='verified_ingredients'));
  assert.match(describeProductCheckFacts(observed,{caseId:CASE,snapshotId:SNAP})!.cards[1].text,/may be incomplete/i);
  const verified=assess([],category('body_care'),true);
  assert.equal(verified.facts.find(f=>f.code==='verified_ingredients')?.certainty,'accepted');
  assert(!verified.missing.includes('ingredient_list'));
});

test('malformed ingredient text cannot be laundered into formula or negative claim',()=>{
  const packet=assess([row('ingredients','Ingredients: Water; Glycerin [unreadable]')],null);
  assert.equal(packet.category,'unknown');
  assert(!packet.facts.some(f=>f.code.includes('ingredients')));
  assert(packet.missing.includes('ingredient_list'));
  assert(!packet.missing.includes('identity')); // Product identity can exist without accepted category or formula.
});

test('renderer rejects wrong case binding and accepted/observed basis mismatch',()=>{
  const packet=assess([row('front_label','SPF 30')],category('sunscreen'));
  assert.equal(describeProductCheckFacts(packet,{caseId:PRODUCT,snapshotId:SNAP}),null);
  const forged=structuredClone(packet);
  forged.facts[1].certainty='accepted';
  assert.equal(describeProductCheckFacts(forged,{caseId:CASE,snapshotId:SNAP}),null);
  const altered=structuredClone(packet);
  altered.facts[1].value='SPF 500';
  assert.equal(describeProductCheckFacts(altered,{caseId:CASE,snapshotId:SNAP}),null);
});

test('a historical snapshot cannot consume evidence added after it was sealed',()=>{
  const unsealed=row('front_label','SPF 50');
  const packet=evaluateProductCheckFacts({snapshot:snapshot(),evidence:[unsealed],acceptedCategory:null,createdAt:NOW});
  assert(!packet.facts.some((fact)=>fact.code==='spf_statement'));
  assert(packet.missing.includes('readable_label'));
});

test('each observed statement cites the evidence row that actually contains it',()=>{
  const secondId='88888888-8888-4888-8888-888888888888';
  const packet=assess([row('front_label','Deodorant'),row('front_label','SPF 30',secondId)]);
  assert.equal(packet.facts.find((fact)=>fact.code==='deodorant_statement')?.basis.kind,'submitted_label');
  assert.deepEqual(packet.facts.find((fact)=>fact.code==='spf_statement')?.basis,
    {kind:'submitted_label',evidenceId:secondId,extraction:'member_input'});
});

test('client calls owner-bound endpoint for exact case and snapshot',async()=>{
  const packet=assess([],category('hair_care'));
  const client={functions:{invoke:async(name:string,options:{body:object})=>{
    assert.equal(name,'product-check-facts');
    assert.deepEqual(options.body,{caseId:CASE,snapshotId:SNAP});
    return {data:{facts:packet},error:null};
  }}};
  assert.deepEqual(await loadProductCheckFacts(CASE,SNAP,client),packet);
});
