import type {PersonalExperienceInput} from '../../contracts/PersonalContext.ts';
import type { PersonalContextSnapshot, PersonalContextRevision, ReportedUseContext } from '../../contracts/PersonalContext.ts';
import type { PersonalContextV2, ReportedUseContextV2, SetupPayloadV2, PersonalProfileV2,ReportedDate,PersonalExperienceV2 } from '../../contracts/PersonalContextV2.ts';
export const migrateReportedDateV1=(date:string|null):ReportedDate=>date?{state:'known',value:{value:date,precision:'day'}}:{state:'unanswered'};
const projectDateV1=(date:ReportedDate):string|null=>date.state==='known'&&date.value.precision==='day'?date.value.value:null;
export function migrateExperienceV1(data:PersonalExperienceInput):PersonalExperienceV2{return {...data,occurred:{start:migrateReportedDateV1(data.occurred.start),end:migrateReportedDateV1(data.occurred.end)},useContext:data.useContext?migrateReportedUseV1(data.useContext):null};}
/** Legacy overview and paged history share one faithful whole-report projection.
 * Unrepresentable precision/uncertainty becomes null; the original V2 report is unchanged. */
export function projectExperienceV1(value:PersonalExperienceV2|PersonalExperienceInput):PersonalExperienceInput {
 const data=structuredClone(value);
 const date=(value:ReportedDate|string|null)=>typeof value==='string'||value===null?value:projectDateV1(value);
 const use=data.useContext;
 return {id:data.id,reference:data.reference,kind:data.kind,occurred:{start:date(data.occurred.start),end:date(data.occurred.end)},useContext:use?{timing:use.timing,frequency:use.frequency,startedOn:date(use.startedOn),stoppedOn:date(use.stoppedOn),duration:use.duration}:null,symptoms:data.symptoms,note:data.note};
}
export function migrateReportedUseV1(use:ReportedUseContext):ReportedUseContextV2 { return {...use,frequency:{...use.frequency},startedOn:use.startedOn?{state:'known',value:{value:use.startedOn,precision:'day'}}:{state:'unanswered'},stoppedOn:use.stoppedOn?{state:'known',value:{value:use.stoppedOn,precision:'day'}}:{state:'unanswered'},duration:use.duration?{...use.duration}:null}; }
export function migrateProfileV1(profile:NonNullable<PersonalContextSnapshot['profile']>['data']):PersonalProfileV2 { return {...profile,primaryGoal:profile.primaryGoal?{state:'known',value:profile.primaryGoal}:{state:'unanswered'}}; }
export function migratePersonalContextV1(v1:PersonalContextSnapshot):PersonalContextV2 {
 return {...structuredClone(v1),version:'personal-context-v2',profile:v1.profile?{...v1.profile,data:migrateProfileV1(v1.profile.data)}:null,routine:v1.routine?{...v1.routine,data:{...v1.routine.data,items:v1.routine.data.items.map(i=>({...i,...migrateReportedUseV1(i)}))}}:null,experiences:v1.experiences.map(e=>({...e,data:migrateExperienceV1(e.data)})),preferences:[],assessments:[],notes:[],setupRevision:null,setupAnswers:null};
}
/** Aggregate setup metadata belongs to each report; later v1 section edits take precedence. */
export function projectPersonalContextV2(v1:PersonalContextSnapshot,setup:PersonalContextRevision<SetupPayloadV2>|null):PersonalContextV2 {
 const value=migratePersonalContextV1(v1);if(!setup)return value;
 const wrap=<T>(data:T):PersonalContextRevision<T>=>({...setup,data});
 if(!value.profile||value.profile.revision<setup.revision)value.profile=wrap(setup.data.profile);
 else if(value.profile.data.primaryGoal.state==='unanswered'&&setup.data.profile.primaryGoal.state!=='known')value.profile.data.primaryGoal=structuredClone(setup.data.profile.primaryGoal);
 if(!value.routine||value.routine.revision<setup.revision)value.routine=wrap(setup.data.routine);
 else value.routine.data.items=value.routine.data.items.map(item=>{const prior=setup.data.routine.items.find(p=>p.id===item.id&&JSON.stringify(p.reference)===JSON.stringify(item.reference));return prior?{...item,...preserveUnrepresentableUse(prior,item)}:item;});
 const byId=new Map(value.experiences.map(e=>[e.data.id,e]));for(const e of setup.data.experiences)if(!byId.has(e.id)||byId.get(e.id)!.revision<setup.revision)byId.set(e.id,wrap(e));
 for(const e of byId.values()){const earlier=setup.data.experiences.find(p=>p.id===e.data.id);if(e.revision>setup.revision&&earlier){for(const field of ['start','end'] as const){const old=earlier.occurred[field],fresh=e.data.occurred[field];if(fresh.state==='unanswered'&&(old.state!=='known'||old.value.precision!=='day'))e.data.occurred[field]=structuredClone(old);}}const prior=setup.data.experiences.find(p=>p.id===e.data.id&&JSON.stringify(p.reference)===JSON.stringify(e.data.reference));if(e.revision>setup.revision&&e.data.useContext&&prior?.useContext)e.data.useContext=preserveUnrepresentableUse(prior.useContext,e.data.useContext);}
 value.experiences=[...byId.values()].sort((a,b)=>b.revision-a.revision);value.preferences=setup.data.preferences.map(wrap);value.assessments=setup.data.assessments.map(wrap);value.notes=setup.data.notes.map(wrap);value.setupRevision=setup.id;value.setupAnswers=setup.data.setupAnswers;value.historyRevision=value.experiences[0]?.id??null;return value;
}
/** Only representable v1 meanings are exported. Precise uncertain dates stay null. */
export function projectPersonalContextV1(v2:PersonalContextV2):PersonalContextSnapshot {
 const use=projectReportedUseV1;
 return {version:'personal-context-v1',ownerId:v2.ownerId,revision:v2.revision,profile:v2.profile?{...v2.profile,data:{...v2.profile.data,primaryGoal:v2.profile.data.primaryGoal.state==='known'?v2.profile.data.primaryGoal.value:null}}:null,routine:v2.routine?{...v2.routine,data:{completeness:v2.routine.data.completeness,items:v2.routine.data.items.map(i=>({id:i.id,reference:i.reference,state:i.state,...use(i)}))}}:null,experiences:v2.experiences.map(e=>({...e,data:projectExperienceV1(e.data)})),historyTruncated:v2.historyTruncated,historyRevision:v2.historyRevision,legacy:v2.legacy};
}

export function projectReportedUseV1(u:ReportedUseContextV2):ReportedUseContext { return {timing:u.timing,frequency:u.frequency,startedOn:u.startedOn.state==='known'&&u.startedOn.value.precision==='day'?u.startedOn.value.value:null,stoppedOn:u.stoppedOn.state==='known'&&u.stoppedOn.value.precision==='day'?u.stoppedOn.value.value:null,duration:u.duration}; }

/** A legacy editor cannot erase a field it cannot represent. V2 explicit writes can. */
function preserveUnrepresentableUse(prior:ReportedUseContextV2,next:ReportedUseContextV2):ReportedUseContextV2 {
 const preserve=(old:ReportedUseContextV2['startedOn'],fresh:ReportedUseContextV2['startedOn'])=>fresh.state==='unanswered'&&(old.state!=='known'||old.value.precision!=='day')?structuredClone(old):fresh;
 return {...next,startedOn:preserve(prior.startedOn,next.startedOn),stoppedOn:preserve(prior.stoppedOn,next.stoppedOn),...(prior.reportedPurpose?{reportedPurpose:structuredClone(prior.reportedPurpose)}:{}),...(prior.applicationSite?{applicationSite:structuredClone(prior.applicationSite)}:{}),...(prior.useForm?{useForm:structuredClone(prior.useForm)}:{})};
}
