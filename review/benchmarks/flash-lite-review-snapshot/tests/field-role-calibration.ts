import {calibration as bodyControls} from './review-calibration.ts';
import {projectFixture} from '../review/benchmarks/facts-first-v2/protocol.ts';
import {prepareBundleReview} from '../src/domain/personalized-sheet/decisionBundleCopy.ts';
import {canonicalJson,sha256} from '../src/domain/part-two/hash.ts';
import dataset from '../review/benchmarks/facts-first-v3/cases.json' with {type:'json'};
import evidence from './heavy-settled.json' with {type:'json'};
const input=projectFixture(dataset.cases.find(c=>c.id===evidence.caseId) as any)!;
const decision=evidence.checkpoints.find(c=>c.phase==='decision')!.value;
export const baselineProposal=structuredClone(bodyControls[0].proposal);
const controls=[
 {id:'context-title',field:'why.0.title',text:'Your reported experience',expectedSupported:true},
 {id:'efficacy-title',field:'why.0.title',text:'Clinically proven hydration advantage',expectedSupported:false},
 {id:'conditional-headline',field:'headline',text:'Consider Vanicream to explore a different feel',expectedSupported:true},
 {id:'guarantee-headline',field:'headline',text:'Choose Vanicream for guaranteed better dryness relief',expectedSupported:false},
 {id:'observe-next-step',field:'nextStep',text:'If you try it, notice how it feels and whether your dryness relief continues.',expectedSupported:true},
 {id:'regimen-next-step',field:'nextStep',text:'Apply it twice daily for two weeks to treat skin inflammation.',expectedSupported:false},
] as const;
export const calibration=controls.map(c=>{
 const proposal=structuredClone(baselineProposal);
 if(c.field==='why.0.title')proposal.why[0].title=c.text;else proposal[c.field]=c.text;
 const prepared=prepareBundleReview(input,decision as any,proposal as any);
 return {id:c.id,expectedSupported:c.expectedSupported,targetField:c.field,proposal,prepared,requestHash:sha256(canonicalJson(prepared.request))};
});
export const calibrationHash=sha256(canonicalJson(calibration.map(c=>({id:c.id,expectedSupported:c.expectedSupported,targetField:c.targetField,requestHash:c.requestHash}))));
