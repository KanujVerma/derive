import {projectFixture} from '../review/benchmarks/facts-first-v2/protocol.ts';
import {prepareBundleReview} from '../src/domain/personalized-sheet/decisionBundleCopy.ts';
import {canonicalJson,sha256} from '../src/domain/part-two/hash.ts';
import dataset from '../review/benchmarks/facts-first-v3/cases.json' with {type:'json'};
import evidence from './heavy-settled.json' with {type:'json'};
const input=projectFixture(dataset.cases.find(c=>c.id===evidence.caseId) as any)!;
const decision=evidence.checkpoints.find(c=>c.phase==='decision')!.value;
const controls=[
 {id:'feel-trial-check',expectedSupported:true,body:'Because your current moisturizer feels heavy, you could try Vanicream to assess its feel while checking whether your dryness relief continues.'},
 {id:'outcome-guarantee',expectedSupported:false,body:'Vanicream will feel lighter than CeraVe PM and maintain your current dryness relief.'},
 {id:'attributed-labels',expectedSupported:true,body:'Vanicream’s manufacturer describes it as rich but lightweight, and CeraVe describes PM as lightweight; those descriptions do not show which feels lighter on your face.'},
 {id:'relative-richness',expectedSupported:false,body:'Vanicream has a richer texture than CeraVe PM.'},
 {id:'scoped-experience',expectedSupported:true,body:'Your previous lightweight gel left your face feeling tight by morning; that report does not establish how Vanicream will behave.'},
 {id:'class-generalization',expectedSupported:false,body:'Your previous lightweight gel left your face feeling tight by morning, showing that lightweight gels do not suit your skin.'},
] as const;
export const calibration=controls.map(c=>{
 const proposal={action:'try_replacement',headline:'Consider a moisturizer trial',reason:'Your current moisturizer helps dryness but feels heavy.',nextStep:'If you try the alternative, check how its feel compares and whether your dryness relief continues.',why:[{id:'factor',title:'What matters here',body:c.body,evidenceIds:['candidate-feel','current-description'],personalFactIds:['current-benefit','current-feel','prior-gel']}],tradeoffs:[],selectedQuestionId:null,cautionIds:[]};
 const prepared=prepareBundleReview(input,decision as any,proposal as any);
 return {id:c.id,expectedSupported:c.expectedSupported,targetField:'why.0.body',proposal,prepared,requestHash:sha256(canonicalJson(prepared.request))};
});
export const calibrationHash=sha256(canonicalJson(calibration.map(c=>({id:c.id,expectedSupported:c.expectedSupported,targetField:c.targetField,requestHash:c.requestHash}))));
