import {z} from 'zod';
import {createContextDraft,GOALS,type ContextDraft} from './draft.ts';
import {createSetupBundle,currentUseItem,addPastOutcome,type SetupBundle} from './setup.ts';
import type {SaveRecoveryAccount} from '../part-three/saveRecovery.ts';
export const SETUP_DRAFT_KEY='@derive/setup-draft/v1';
export const SETUP_DRAFT_TTL=7*24*60*60*1000;
const MAX_BYTES=64*1024;
const answer=<T extends z.ZodType>(value:T)=>z.union([z.strictObject({state:z.literal('answered'),value}),z.strictObject({state:z.enum(['unanswered','withheld','unsure'])})]);
const goal=z.enum(GOALS.map(([id])=>id));
const reference=z.discriminatedUnion('kind',[z.strictObject({kind:z.literal('manual'),label:z.string().trim().min(1).max(500),verification:z.literal('unverified')}),z.strictObject({kind:z.literal('catalog'),label:z.string().trim().min(1).max(500),productId:z.string().uuid(),variantId:z.string().uuid().nullable(),formulaVersionId:z.string().uuid().nullable()})]);
const outcome=z.enum(['helpful','not_helping','too_heavy','stung','broke_out','too_drying','not_sure']);
const reported=<T extends z.ZodType>(value:T)=>z.strictObject({provenance:z.literal('self_report'),answer:z.union([z.strictObject({state:z.literal('known'),value}),z.strictObject({state:z.enum(['unanswered','unsure','withheld'])})])});
const payload=z.strictObject({step:z.number().int().min(0).max(4),profile:z.strictObject({primaryGoal:answer(goal),secondaryGoals:z.array(goal).max(2),behavior:answer(z.enum(['dry_tight','balanced','combination','oily','unsure'])),reactivity:answer(z.enum(['reacts_easily','generally_tolerates','unsure']))}),products:z.array(z.strictObject({id:z.string().uuid(),reference})).max(20),reportedUse:z.record(z.string().uuid(),z.strictObject({reportedPurpose:reported(z.enum(['moisturizing','cleansing','sun_protection','other'])).optional(),applicationSite:reported(z.enum(['face','body','hands','scalp','lips','eye_area','other'])).optional(),useForm:reported(z.enum(['leave_on','rinse_off','other'])).optional()})),preview:z.strictObject({currentProducts:z.enum(['unanswered','none','unknown','reported']),pastProducts:z.enum(['unanswered','none','unknown','reported']),currentOutcomes:z.record(z.string().uuid(),outcome),currentFeedback:z.record(z.string().uuid(),z.array(z.enum([...outcome.options,'still_dry','comfortable'])).max(9)).optional(),catalogCategories:z.record(z.string().uuid(),z.string().max(100)).optional(),pastReports:z.array(z.strictObject({id:z.string().uuid(),reference,outcome})).max(20)})});
const envelope=z.strictObject({schemaVersion:z.union([z.literal(1),z.literal(2)]),ownerId:z.string().min(1).max(128),accountGeneration:z.number().int().nonnegative(),baseRevision:z.number().int().nonnegative(),updatedAt:z.number().finite(),expiresAt:z.number().finite(),data:payload});
export interface SetupProgress {draft:ContextDraft;bundle:SetupBundle;step:number}
interface Storage {getItem(key:string):Promise<string|null>;setItem(key:string,value:string):Promise<void>;removeItem(key:string):Promise<void>}
const bytes=(value:string)=>new TextEncoder().encode(value).byteLength;
const same=(a:SaveRecoveryAccount|null,b:SaveRecoveryAccount)=>a?.ownerId===b.ownerId&&a.accountGeneration===b.accountGeneration;
/** Separate sensitive setup namespace. Never extends the metadata-only Save journal. */
export function createSetupDraftStore(storage:Storage,current:()=>SaveRecoveryAccount|null,now=Date.now){
 let epoch=0,queue:Promise<void>=Promise.resolve(),pending:{account:SaveRecoveryAccount;baseRevision:number;progress:SetupProgress;epoch:number}|null=null,timer:ReturnType<typeof setTimeout>|null=null;
 const serial=<T>(operation:()=>Promise<T>):Promise<T>=>{const result=queue.then(operation);queue=result.then(()=>undefined,()=>undefined);return result;};
 const cancel=()=>{if(timer)clearTimeout(timer);timer=null;pending=null;};
 async function flush(){if(timer)clearTimeout(timer);timer=null;const p=pending;pending=null;if(!p)return;await serial(async()=>{
  if(p.epoch!==epoch||!same(current(),p.account))return;
  const {draft,bundle,step}=p.progress;if(bundle.ownerId!==p.account.ownerId)return;
  const data=payload.parse({step,profile:{primaryGoal:draft.primaryGoal,secondaryGoals:draft.secondaryGoals,behavior:draft.behavior,reactivity:draft.reactivity},products:bundle.products.map(({id,reference})=>({id,reference})),reportedUse:bundle.reportedUse??{},preview:bundle.previewOnly});
  const at=now(),value=JSON.stringify({schemaVersion:2,...p.account,baseRevision:p.baseRevision,updatedAt:at,expiresAt:at+SETUP_DRAFT_TTL,data});
  if(bytes(value)>MAX_BYTES){await storage.removeItem(SETUP_DRAFT_KEY);return;}
  await storage.setItem(SETUP_DRAFT_KEY,value);
  if(p.epoch!==epoch||!same(current(),p.account))await storage.removeItem(SETUP_DRAFT_KEY);
 });}
 return {schedule(account:SaveRecoveryAccount,baseRevision:number,progress:SetupProgress){if(!same(current(),account))return;pending={account:{...account},baseRevision,progress:JSON.parse(JSON.stringify(progress)),epoch};if(timer)clearTimeout(timer);timer=setTimeout(()=>{void flush().catch(()=>undefined);},500);},flush,
 clear(){epoch++;cancel();return serial(()=>storage.removeItem(SETUP_DRAFT_KEY));},
 read(account:SaveRecoveryAccount,baseRevision:number):Promise<SetupProgress|null>{const expected=epoch;return serial(async()=>{if(!same(current(),account)||expected!==epoch)return null;const value=await storage.getItem(SETUP_DRAFT_KEY);if(expected!==epoch||!same(current(),account))return null;if(!value)return null;
  let parsed:ReturnType<typeof envelope.parse>|null=null;try{if(bytes(value)<=MAX_BYTES)parsed=envelope.parse(JSON.parse(value));}catch{}
  if(!parsed||(parsed.schemaVersion===1&&parsed.data.step>3)||!same(parsed,account)||parsed.baseRevision!==baseRevision||parsed.updatedAt>now()||parsed.expiresAt!==parsed.updatedAt+SETUP_DRAFT_TTL||parsed.expiresAt<=now()){await storage.removeItem(SETUP_DRAFT_KEY);return null;}
  const d=parsed.data;let bundle=createSetupBundle(account.ownerId);for(const report of d.preview.pastReports)bundle=addPastOutcome(bundle,report.id,report.reference,report.outcome);bundle={...bundle,products:d.products.map(p=>currentUseItem(p.id,p.reference)),reportedUse:d.reportedUse,previewOnly:d.preview};
  const draft={...createContextDraft(),...d.profile} as ContextDraft;return {step:parsed.schemaVersion===1&&d.step>=2?d.step+1:d.step,draft,bundle};
 });}}
}
