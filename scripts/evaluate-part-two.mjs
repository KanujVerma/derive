import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import { normalize, LOCAL_DICTIONARY_RELEASE, sha256 } from '../src/domain/part-two/index.ts';
import { sourceReading, p2metadata } from '../tests/fixtures/part-two-core.ts';
// Original synthetic engineering adjudication. These are not optical/product observations.
// Holdout formulation families were reserved after the immutable vocabulary was frozen.
const development=[
 ['Water','water'],['Aqua (Water, Eau)','water'],['1,2-Hexanediol','hexanediol'],['Niacinamide','niacinamide'],['Glycerin','glycerin'],
 ['Retinol','retinol'],['Retinyl Palmitate','retinyl-palmitate'],['Hyaluronic Acid','hyaluronic-acid'],['Sodium Hyaluronate','sodium-hyaluronate'],
 ['Alcohol','alcohol'],['Alcohol Denat.','alcohol-denat'],['Cetyl Alcohol','cetyl-alcohol'],['Benzyl Alcohol','benzyl-alcohol'],['PEG-8','peg-8'],['PEG-80','peg-80'],
 ['Parfum','parfum'],['Acrylates/C10-30 Alkyl Acrylate Crosspolymer','acrylates-crosspolymer'],['Aloe Barbadensis Leaf Extract','aloe-leaf-extract'],
 ['PG-6-Decyltetradecanol',null],['PPG-6-Decyltetradeceth-30',null],['Aloe Barbadensis Seed Oil',null],['Aloe Barbadensis Flower Water',null],['PEG-800',null],['Unknown Trade Complex',null],
];
const holdouts=[
 {family:'colored cosmetic',text:'May contain (+/-): CI 77491, CI 77492',ids:['ci-77491','ci-77492'],modality:'may_contain'},
 {family:'exfoliating gel',text:'Salicylic Acid (2% w/w), Glycerin',ids:['salicylic-acid','glycerin'],modality:'unconditional'},
 {family:'botanical water',text:'Aloe Barbadensis Flower Water, Aqua',ids:[null,'water'],modality:'unconditional'},
 {family:'retinoid ester emulsion',text:'Retinyl Palmitate, Cetyl Alcohol, Unreviewed Emulsifier',ids:['retinyl-palmitate','cetyl-alcohol',null],modality:'unconditional'},
 {family:'polymer fluid',text:'PEG-80, Acrylates/C10-30 Alkyl Acrylate Crosspolymer',ids:['peg-80','acrylates-crosspolymer'],modality:'unconditional'},
 {family:'fragrance blend',text:'Parfum, Proprietary Fragrance Complex',ids:['parfum',null],modality:'unconditional'},
];
let occurrences=0,resolved=0,unresolved=0,ambiguous=0,falseMerges=0,incorrect=0,spanErrors=0,modalityErrors=0,unsupportedFacts=0,explanations=0,explainedOccurrences=0,failed=0;
const uniqueObserved=new Set(),uniqueResolved=new Set(),explainedIdentities=new Set(),receipts=[];
for(const [cohort,corpus] of [['development',development.map(([text,id])=>({family:'single-name adjudication',text,ids:[id],modality:'unconditional'}))],['reserved_synthetic_families',holdouts]])for(const fixture of corpus){
 const input=sourceReading(fixture.text),r=normalize(input,LOCAL_DICTIONARY_RELEASE,p2metadata);
 if(r.state!=='ready'){failed++;receipts.push({cohort,fixture,state:r.state});continue;}
 const reading=r.output.reading;assert.equal(r.output.kind,'reading_only');assert.equal(reading.claimLimits.negativeClaimsAllowed,false);assert.equal(reading.claimLimits.productPresenceAllowed,false);
 assert.equal(reading.occurrences.length,fixture.ids.length);
 reading.occurrences.forEach((o,n)=>{
  occurrences++;uniqueObserved.add(o.observedName);
  const actual=o.mapping.state==='resolved'?o.mapping.ingredientId:null,expected=fixture.ids[n];
  if(o.mapping.state==='resolved'){resolved++;uniqueResolved.add(actual);}else if(o.mapping.state==='ambiguous')ambiguous++;else unresolved++;
  if(actual!==expected){incorrect++;if(actual!==null)falseMerges++;}
  if(input.sections[0].rawText.slice(o.nameSpan.start,o.nameSpan.end)!==o.nameSpan.raw)spanErrors++;
  if(o.modality!==fixture.modality)modalityErrors++;
 });
 const cards=reading.facts.filter(f=>f.kind==='reference_function');explanations+=cards.length;explainedOccurrences+=new Set(cards.map(f=>f.occurrenceId)).size;cards.forEach(f=>explainedIdentities.add(f.subject.ingredientId));
 unsupportedFacts+=reading.facts.filter(f=>!['declared_ingredient','resolved_ingredient_identity','declared_quantity','reference_function'].includes(f.kind)||f.subject.kind==='bound_declaration_entry').length;
 receipts.push({cohort,fixture,state:r.state,mappings:reading.occurrences.map(o=>o.mapping),snapshotHash:sha256(JSON.stringify(reading))});
}
assert.equal(incorrect+falseMerges+spanErrors+modalityErrors+unsupportedFacts+failed,0);
const cpu=[];let rss=0;
for(const count of [100,1000]){const input=sourceReading(Array(count).fill('Niacinamide').join(', '));for(let n=0;n<5;n++)normalize(input,LOCAL_DICTIONARY_RELEASE,p2metadata);const times=[];for(let n=0;n<50;n++){const start=performance.now();const r=normalize(input,LOCAL_DICTIONARY_RELEASE,p2metadata);assert.equal(r.state,'ready');times.push(performance.now()-start);rss=Math.max(rss,process.memoryUsage().rss);}times.sort((a,b)=>a-b);cpu.push({entries:count,runs:50,p50Ms:times[24],p95Ms:times[47],p99Ms:times[49]});}
const report={schemaVersion:1,kind:'synthetic_engineering_adjudication',dictionaryHash:LOCAL_DICTIONARY_RELEASE.contentHash,corpusHash:sha256(JSON.stringify({development,holdouts})),release:LOCAL_DICTIONARY_RELEASE.version,explanationRelease:LOCAL_DICTIONARY_RELEASE.explanationVersion,environment:{node:process.version,platform:os.platform(),architecture:os.arch(),hardware:os.cpus()[0]?.model,concurrency:1},cases:development.length+holdouts.length,occurrences,resolved,unresolved,ambiguous,incorrect,falseMerges,spanErrors,modalityErrors,unsupportedFacts,failed,mappingPrecision:resolved?(resolved-incorrect)/resolved:null,resolutionCoverage:resolved/occurrences,uniqueObservedNames:uniqueObserved.size,uniqueResolvedIdentities:uniqueResolved.size,explanationFacts:explanations,explainedOccurrences,explanationCoverage:explainedOccurrences/occurrences,uniqueExplainedIdentities:explainedIdentities.size,explanationCoverageAmongResolved:explainedOccurrences/resolved,unknownRate:unresolved/occurrences,externalNormalizationCalls:0,cpu,processObservedMaxRssBytes:rss,timingBoundary:'warm in-memory schemas/hash/freezing; excludes authorization, persistence, network, OCR and UI',limitations:['Original synthetic engineering corpus; founder/QA production adjudication pending','Reserved synthetic formulation families; no physical optical or broad-market holdout evidence','One original Glycerin reference-role card; explanation coverage separate from mapping and whole-list completeness','External normalization requests structurally absent; Edge actual requests checked separately'],receipts};
const output=process.argv[2];if(!output)throw Error('Explicit report destination required');writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,receipts:undefined,cpu}));
