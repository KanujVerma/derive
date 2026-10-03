import {sha256,canonicalJson} from '../../domain/part-two/hash.ts';
import type {SaveRecoveryAccount} from './saveRecovery.ts';

export interface RecoveryAuthState {status:'INITIALIZING'|'SIGNED_OUT'|'SIGNED_IN';sessionUserId:string|null}
export interface RecoverySession {user:{id:string};access_token:string}
// This decoded claim is only an opaque persistence namespace. It grants no
// authority: the guarded Supabase session and every server call retain Auth.
export function sessionRecoveryGeneration(session:RecoverySession,ownerId:string):number|null {
 try {
  if(session.user.id!==ownerId)return null;
  const pieces=session.access_token.split('.');if(pieces.length!==3||pieces[1].length>16384)return null;
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const payload=pieces[1].replace(/-/g,'+').replace(/_/g,'/');
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(payload))return null;
  let bits=0,value=0,decoded='';
  for(const char of payload.replace(/=+$/,'')){const digit=alphabet.indexOf(char);if(digit<0)return null;value=(value<<6)|digit;bits+=6;if(bits>=8){bits-=8;decoded+=String.fromCharCode((value>>bits)&255);}}
  const claims=JSON.parse(decoded);
  if(claims.sub!==ownerId||typeof claims.session_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(claims.session_id))return null;
  return Number.parseInt(sha256(canonicalJson([ownerId,claims.session_id.toLowerCase()])).slice(0,13),16);
 } catch {return null;}
}

/** Process-independent session namespace with guarded async discovery. Auth
 * readiness changes suspend authority; only confirmed retirement erases it. */
export function createPartThreeSessionRecovery(options:{auth:()=>RecoveryAuthState;getSession:()=>Promise<RecoverySession|null>;retire:(account:SaveRecoveryAccount)=>Promise<void>;retireUnanchored?:(ownerId:string)=>Promise<void>;changed?:(event?:'retired')=>void}) {
 let anchored:SaveRecoveryAccount|null=null,ready=false,revision=0,sequence=0;
 let previous=canonicalJson([options.auth().status,options.auth().sessionUserId]);
 let lastOwner=options.auth().status==='SIGNED_IN'?options.auth().sessionUserId:null;
 let retirement:Promise<void>=Promise.resolve();
 let flight:{key:string;promise:Promise<SaveRecoveryAccount>}|null=null;
 const changed=(event?:'retired')=>options.changed?.(event);
 const authKey=()=>canonicalJson([options.auth().status,options.auth().sessionUserId]);
 function current(ownerId?:string):SaveRecoveryAccount|null {
  const auth=options.auth();
  return ready&&anchored&&auth.status==='SIGNED_IN'&&auth.sessionUserId===anchored.ownerId&&(!ownerId||ownerId===anchored.ownerId)?{...anchored}:null;
 }
 function retireAccount(account:SaveRecoveryAccount):Promise<void>{
  const operations=[options.retire(account)];
  // Generation-specific retirement cannot identify an older namespace left
  // by a prior process. Confirmed owner cleanup erases those IDs too, while
  // the journal's current-authority guard protects a concurrent fresh login.
  if(options.retireUnanchored)operations.push(options.retireUnanchored(account.ownerId));
  return Promise.all(operations).then(()=>undefined);
 }
 function retire():Promise<void> {
  const old=anchored;anchored=null;ready=false;sequence++;flight=null;changed('retired');
  const next=old?retireAccount(old):lastOwner&&options.retireUnanchored?options.retireUnanchored(lastOwner):null;
  if(next){retirement=Promise.all([retirement,next]).then(()=>undefined);void retirement.catch(()=>undefined);}
  return retirement;
 }
 function observeAuth():Promise<void> {
  const auth=options.auth(),next=authKey();
  if(next!==previous){previous=next;revision++;sequence++;flight=null;ready=false;
   if(auth.status==='SIGNED_OUT')return retire();
   if(auth.status==='SIGNED_IN'&&((anchored&&auth.sessionUserId!==anchored.ownerId)||(lastOwner&&auth.sessionUserId!==lastOwner))){const retiring=retire();lastOwner=auth.sessionUserId;return retiring;}
   if(auth.status==='SIGNED_IN')lastOwner=auth.sessionUserId;
   changed();
  }
  return retirement;
 }
 async function initialize(ownerId:string):Promise<SaveRecoveryAccount> {
  await observeAuth();
  const auth=options.auth();if(auth.status!=='SIGNED_IN'||auth.sessionUserId!==ownerId)throw Error('Personal session unavailable');
  const expected=authKey(),expectedRevision=revision,flightKey=canonicalJson([expected,expectedRevision]);
  if(flight?.key===flightKey)return flight.promise;
  const token=++sequence;
  const guard=()=>{if(token!==sequence||expectedRevision!==revision||authKey()!==expected)throw Error('Personal session changed');};
  const promise=(async()=>{
   try {
    const session=await options.getSession();guard();
    const generation=session?sessionRecoveryGeneration(session,ownerId):null;
    if(generation===null)throw Error('Personal session unavailable');
    const next={ownerId,accountGeneration:generation};
    if(anchored&&canonicalJson(anchored)!==canonicalJson(next)){
     const old=anchored;ready=false;anchored=null;changed('retired');
     const retiring=retireAccount(old);retirement=Promise.all([retirement,retiring]).then(()=>undefined);void retirement.catch(()=>undefined);await retirement;guard();
    }
    const differs=!ready||canonicalJson(anchored)!==canonicalJson(next);anchored=next;lastOwner=ownerId;ready=true;if(differs)changed();return {...next};
   } catch(error) {if(token===sequence&&ready){ready=false;changed();}throw error;}
  })();
  const f={key:flightKey,promise};flight=f;void promise.finally(()=>{if(flight===f)flight=null;}).catch(()=>undefined);return promise;
 }
 return {current,initialize,observeAuth,retire,awaitRetirement:()=>retirement};
}
