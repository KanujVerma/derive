import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { APPROVED47_SOURCE, APPROVED47_PREPARATION_HASH } from '../src/domain/part-four/approved47-source.ts';
// Independent standard-JSON canonicalization; the literal digest is the oracle
// for the entire approved preparation, including its rich context and snapshots.
function canonical(value:unknown):string {
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value!==null&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical((value as Record<string,unknown>)[key])).join(',')+'}';
 const encoded=JSON.stringify(value);if(encoded===undefined)throw Error('Non-JSON preparation value');return encoded;
}
const pinned='311fb1b7906a2d7ed48736a0b3babd2f2a38fcc230d92c187608eadbda5a3d23';

test('generated source matches the full approved preparation canonical digest',()=>{
 assert.equal(APPROVED47_PREPARATION_HASH,pinned);
 assert.equal(APPROVED47_SOURCE.contentHash,pinned);
 const {contentHash:_,...content}=APPROVED47_SOURCE;
 assert.equal(createHash('sha256').update(canonical(content),'utf8').digest('hex'),pinned);
});

test('all 47 unchanged entries preserve both approved documents and provenance',()=>{
 assert.equal(APPROVED47_SOURCE.ingredientCount,47);assert.equal(APPROVED47_SOURCE.cards.length,47);
 assert.equal(new Set(APPROVED47_SOURCE.cards.map(card=>card.approvedEntry.id)).size,47);
 assert.deepEqual(APPROVED47_SOURCE.provenance.documents.map(doc=>[doc.id,doc.library_version,doc.sha256]),[
  ['original37',2,'68e0740df427bf8a434b5c30ea30cd07378568078d3c8d01af56fee2ed8c7d22'],
  ['expansion10',1,'b204028c1a6a38343a24693fb8b0b65deb5a8e4cc94084a92a5fc6db18d2f83b'],
 ]);
 assert.deepEqual(APPROVED47_SOURCE.provenance.documents.map(doc=>[doc.library_file_id,doc.file_id]),[
  ['libfile_211e2d19dbe881918237cc72994ca091','file_0000000054e481fd9949dcefb18317a9'],
  ['libfile_62fd53a648888191b30c8ff388128dc1','file_00000000276081fd814b43e47e88cd21'],
 ]);
 assert.equal(APPROVED47_SOURCE.provenance.handoff.sha256,'82dbfd91fd296ee6eb6d93f7810482e30981ba04043736f27fe57ea2052fa6ca');
 assert.equal(APPROVED47_SOURCE.provenance.handoff.sizeBytes,165635);
 assert.equal(APPROVED47_SOURCE.sourceIndex.length,76);
 assert.equal(APPROVED47_SOURCE.editorialProductOccurrenceTables.reduce((count,product)=>count+product.occurrences.length,0),43);
 for(const card of APPROVED47_SOURCE.cards){
  assert.equal(card.approvedEntry.editorial_status,'user_approved');
  const document=APPROVED47_SOURCE.provenance.documents.find(doc=>doc.id===card.approvedEntry.source_document.id);
  assert.ok(document);assert.deepEqual(card.approvedEntry.source_document,document);
  assert.equal(card.inciComparisonRecord.ingredient_id,card.approvedEntry.inci_check_ref);
  for(const [field,location] of Object.entries(card.fieldProvenance))assert.deepEqual(location.approvedLocator,(card.approvedEntry.text_provenance as Record<string,unknown>)[field]);
 }
 assert.deepEqual(Object.keys(APPROVED47_SOURCE.documentWideContext),['original37','expansion10']);
 assert.deepEqual(Object.keys(APPROVED47_SOURCE.exactDocumentTextSnapshots),['original37','expansion10']);
 assert.equal(APPROVED47_SOURCE.provenance.handoff.libraryFileId,'libfile_92720e6011dc81918d14effe252743d0');
 assert.equal(APPROVED47_SOURCE.provenance.handoff.libraryVersion,0);
 assert.equal(APPROVED47_SOURCE.provenance.handoff.fileId,'file_00000000455c81fd889ad4b86ce67de7');
});

test('source data keeps preparation boundaries, missing remote bodies and prior37 history without granting permission',()=>{
 const boundary=APPROVED47_SOURCE.boundary;
 for(const flag of ['runtimeReleaseActivated','scientificProductRulesActivated','automaticAliasesActivated','sourcePermissionsPromoted','clinicalMedicalEfficacyPregnancyRulesActivated'] as const)assert.equal(boundary[flag],false);
 assert.equal(APPROVED47_SOURCE.releaseGate,'preparation_only');
 assert.equal(APPROVED47_SOURCE.provenance.remoteWebpageBodiesRetained,false);
 assert.equal(APPROVED47_SOURCE.previousRelease.version,'approved-37-v7/editorial-v1');
 assert.equal(APPROVED47_SOURCE.previousRelease.contentHash,'7d87dfb01c6039e26617802f36dbf6476992d6e6e7623d470aab7ed07b69715b');
 for(const source of APPROVED47_SOURCE.sourceIndex){assert.equal(source.sourceRightsDecision,'not_promoted');assert.equal(source.sourceMetadata.webpage_body_sha256,null);assert.equal(source.remoteBodySnapshot,'unavailable');}
 for(const card of APPROVED47_SOURCE.cards){assert.equal(card.identityProposal.automaticMatchingActivated,false);assert.equal(card.approvedEntry.aliases.automatic_matching_approval,false);assert.equal(card.approvedEntry.concentration.exact_product_amount,null);}
});
