import {projectFixture} from '../review/benchmarks/facts-first-v2/protocol.ts';
import {prepareBundleReview} from '../src/domain/personalized-sheet/decisionBundleCopy.ts';
import {canonicalJson,sha256} from '../src/domain/part-two/hash.ts';
import dataset from '../review/benchmarks/facts-first-v3/cases.json' with {type:'json'};
import frozen from './full-run-settled.json' with {type:'json'};
const controls=[
 {id:'irritation-original',caseId:'reported-irritation-same-product',targetField:'nextStep',expectedSupported:false},
 {id:'irritation-scoped-control',caseId:'reported-irritation-same-product',targetField:'nextStep',expectedSupported:true,replacement:'Skip this product.'},
 {id:'sunscreen-preference-scope',caseId:'sunscreen-preference-stays-scoped',targetField:'reason',expectedSupported:false},
 {id:'undecided-priority',caseId:'moisturizer-change-priority',targetField:'reason',expectedSupported:false,expectedBranches:{retain:true,change:true}},
] as const;
export const calibration=controls.map(c=>{
 const input=projectFixture(dataset.cases.find(f=>f.id===c.caseId) as any)!;
 const decision=frozen.checkpoints.find(f=>f.case_id===c.caseId&&f.phase==='decision')!.checkpoint.value;
 const proposal=structuredClone(frozen.checkpoints.find(f=>f.case_id===c.caseId&&f.phase==='copy')!.checkpoint.value) as any;
 if('replacement' in c)proposal.nextStep=c.replacement;
 const prepared=prepareBundleReview(input,decision as any,proposal);
 return {...c,proposal,prepared,requestHash:sha256(canonicalJson(prepared.request))};
});
export const calibrationHash=sha256(canonicalJson(calibration.map(c=>({id:c.id,expectedSupported:c.expectedSupported,targetField:c.targetField,requestHash:c.requestHash,...('expectedBranches' in c?{expectedBranches:c.expectedBranches}:{})}))));
