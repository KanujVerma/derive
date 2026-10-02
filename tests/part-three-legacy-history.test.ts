import assert from 'node:assert/strict';
import test from 'node:test';
import type { PersonalExperienceInput, PersonalContextRevision } from '../src/contracts/PersonalContext.ts';
import type { PersonalExperienceV2, ReportedDate } from '../src/contracts/PersonalContextV2.ts';
import { projectExperienceV1, projectPersonalContextV1, migrateExperienceV1 } from '../src/services/context/migrateV2.ts';
import { experienceFromStorage } from '../src/presentation/p0b-personalization/storageAdapter.ts';
import { baseInput } from './fixtures/part-three-acceptance.ts';

const id=(n:number)=>`94000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const v1:PersonalExperienceInput={id:id(1),reference:{kind:'manual',name:'Reported cream',brand:'Reported brand'},kind:'liked',occurred:{start:'2024-03-09',end:null},useContext:{timing:'both',frequency:{kind:'exact',count:2.5,unit:'week'},startedOn:'2024-03-09',stoppedOn:null,duration:{count:3,unit:'months'}},symptoms:['Reported stinging'],note:'Personal observation only'};
const dates:Array<{name:string;date:ReportedDate;expected:string|null}>=[
 {name:'day',date:{state:'known',value:{value:'2024-03-09',precision:'day'}},expected:'2024-03-09'},
 {name:'month',date:{state:'known',value:{value:'2024-03',precision:'month'}},expected:null},
 {name:'year',date:{state:'known',value:{value:'2024',precision:'year'}},expected:null},
 {name:'unanswered',date:{state:'unanswered'},expected:null},
 {name:'unsure',date:{state:'unsure'},expected:null},
 {name:'withheld',date:{state:'withheld'},expected:null},
];
function report(date:ReportedDate):PersonalExperienceV2 {
 const value=migrateExperienceV1(v1);
 value.occurred={start:structuredClone(date),end:{state:'withheld'}};
 value.useContext!.startedOn=structuredClone(date);
 value.useContext!.stoppedOn={state:'unsure'};
 value.useContext!.reportedPurpose={answer:{state:'known',value:'moisturizing'},provenance:'self_report'};
 value.useContext!.applicationSite={answer:{state:'known',value:'face'},provenance:'self_report'};
 value.useContext!.useForm={answer:{state:'known',value:'leave_on'},provenance:'self_report'};
 return value;
}
for(const {name,date,expected} of dates)test(`whole paged report projects ${name} date faithfully without mutating V2`,()=>{
 const source=report(date),before=structuredClone(source);
 const actual=projectExperienceV1(source);
 const golden:PersonalExperienceInput={...v1,occurred:{start:expected,end:null},useContext:{...v1.useContext!,startedOn:expected,stoppedOn:null}};
 assert.deepEqual(actual,golden,'All report meaning, exact frequency, duration, symptoms and private note survive; only representable V1 dates are exported');
 assert.deepEqual(source,before,'Original precision and answer states remain in the V2 source');
 const draft=experienceFromStorage(actual);
 assert.equal(draft.occurred.start,expected);
 assert.equal(draft.occurred.end,null);
 assert(typeof draft.occurred.start==='string'||draft.occurred.start===null,'Legacy TextInput cannot receive an Answer object');
 assert.deepEqual(actual.useContext!.frequency,{kind:'exact',count:2.5,unit:'week'});
 actual.reference.kind==='manual'&&(actual.reference.name='Changed local editor draft');
 actual.symptoms.push('Another local draft value');
 actual.useContext!.frequency={kind:'qualitative',value:'daily'};
 assert.deepEqual(source,before,'Editing the detached V1 projection cannot modify stored V2 bytes');
});

test('nullable use context does not bypass occurrence projection or fabricate exposure',()=>{
 for(const {date,expected} of dates){const source={...report(date),useContext:null};const before=structuredClone(source);const actual=projectExperienceV1(source);assert.deepEqual(actual,{...v1,occurred:{start:expected,end:null},useContext:null});assert.deepEqual(source,before);assert.equal(experienceFromStorage(actual).useContext,null);}
});

test('mixed legacy/V2 history preserves page and revision metadata and uses the same projection as overview',()=>{
 const metadata={id:id(2),ownerId:id(3),revision:7,recordedAt:'2026-10-02T10:00:00.000Z',provenance:'self_report' as const,supersedesRevisionId:id(4)};
 const rows:Array<PersonalContextRevision<PersonalExperienceInput|PersonalExperienceV2>>=[{...metadata,data:structuredClone(v1)},{...metadata,id:id(5),data:{...report(dates[2].date),useContext:null}},{...metadata,id:id(6),data:report(dates[0].date)}];
 const page={items:rows,nextCursor:id(6),atRevision:7};const original=structuredClone(page);
 const projected={...page,items:page.items.map(item=>({...item,data:projectExperienceV1(item.data)}))};
 assert.deepEqual(projected,{nextCursor:id(6),atRevision:7,items:[{...metadata,data:v1},{...metadata,id:id(5),data:{...v1,occurred:{start:null,end:null},useContext:null}},{...metadata,id:id(6),data:{...v1,occurred:{start:'2024-03-09',end:null},useContext:{...v1.useContext!,stoppedOn:null}}}]});
 assert.deepEqual(page,original);
 const context=baseInput().context;context.experiences=rows.slice(1) as Array<PersonalContextRevision<PersonalExperienceV2>>;
 assert.deepEqual(projectPersonalContextV1(context).experiences,projected.items.slice(1),'Recent overview and paged history must not drift between adapters');
});

test('every original experience meaning and nullable legacy use context survives the compatibility adapter',()=>{
 for(const kind of ['reacted','tolerated','no_reaction_reported','liked','finished','ineffective'] as const){for(const useContext of [v1.useContext,null]){const legacy={...v1,kind,useContext};assert.deepEqual(projectExperienceV1(legacy),legacy);assert.deepEqual(projectExperienceV1(migrateExperienceV1(legacy)),legacy);}}
});
