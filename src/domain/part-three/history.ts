import type {PersonalContextRevision} from '../../contracts/PersonalContext.ts';
import type {PersonalExperienceV2} from '../../contracts/PersonalContextV2.ts';
import type {HistoryResult} from './evaluate.ts';
export interface HistoryPageV2 {items:PersonalContextRevision<PersonalExperienceV2>[];nextCursor:string|null;atRevision:number}
export async function retrieveDecisionHistory(scopes:HistoryResult['requestedScopes'],atRevision:number,read:(scope:HistoryResult['requestedScopes'][number],cursor:string|null)=>Promise<HistoryPageV2>,now=Date.now):Promise<{history:HistoryResult;records:PersonalContextRevision<PersonalExperienceV2>[]} >{
 const deadline=now()+2000,records=new Map<string,PersonalContextRevision<PersonalExperienceV2>>();let reason:HistoryResult['reason']='complete';
 for(const scope of scopes.slice(0,2)){let cursor:string|null=null,count=0;const seen=new Set<string>();do{
  if(now()>=deadline){reason='deadline';break;}
  let timer:ReturnType<typeof setTimeout>|null=null,page:HistoryPageV2;
  try{page=await Promise.race([read(scope,cursor),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Deadline')),Math.max(1,deadline-now()));})]);}catch{reason=now()>=deadline?'deadline':'page_error';break;}finally{if(timer)clearTimeout(timer);}
  if(page.atRevision!==atRevision){reason='revision_changed';break;}
  count+=page.items.length;if(count>1000){reason='cap';break;}
  for(const record of page.items){const prior=records.get(record.data.id);if(!prior||prior.revision<record.revision)records.set(record.data.id,record);}
  cursor=page.nextCursor;if(cursor&&seen.has(cursor)){reason='repeated_cursor';break;}if(cursor)seen.add(cursor);
 }while(cursor);if(reason!=='complete')break;}
 if(scopes.length>2)reason='cap';return {records:[...records.values()],history:{requestedScopes:scopes,atRevision,activeRevisionIds:[...new Set([...records.values()].map(x=>x.id))],completeness:reason==='complete'?'complete':reason==='page_error'?'unavailable':'incomplete',reason}};
}
