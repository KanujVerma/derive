import assert from 'node:assert/strict';
import test from 'node:test';
import {createPartThreeSessionRecovery,sessionRecoveryGeneration,type RecoveryAuthState,type RecoverySession} from '../src/presentation/part-three/sessionRecovery.ts';
import {createPartThreeSaveRecoveryStore,type SaveRecoveryStorage,type SaveRecoveryAccount} from '../src/presentation/part-three/saveRecovery.ts';
import {p2id} from './fixtures/part-two-core.ts';
const owner=p2id(1),sid=p2id(80),nextSid=p2id(81);
const session=(id=sid,user=owner,other:Record<string,unknown>={}):RecoverySession=>({user:{id:user},access_token:`e30.${Buffer.from(JSON.stringify({sub:user,session_id:id,...other})).toString('base64url')}.signature`});
function fixture(){let auth:RecoveryAuthState={status:'SIGNED_IN',sessionUserId:owner},current:RecoverySession|null=session(),error=false;
 const retired:SaveRecoveryAccount[]=[],anchor=createPartThreeSessionRecovery({auth:()=>auth,getSession:async()=>{if(error)throw Error('Transient session lookup failure');return current;},retire:async account=>{retired.push(account);}});
 return {anchor,retired,setAuth:(state:RecoveryAuthState)=>{auth=state;return anchor.observeAuth();},setSession:(s:RecoverySession|null)=>{current=s;},fail:(value:boolean)=>{error=value;}};
}
test('stable session namespace survives process restart and token refresh; fresh login gets a different namespace',async()=>{
 const f=fixture(),a=await f.anchor.initialize(owner),restarted=fixture();assert.deepEqual(await restarted.anchor.initialize(owner),a);assert(Number.isSafeInteger(a.accountGeneration));
 f.setSession(session(sid,owner,{exp:12345,iat:54321}));assert.deepEqual(await f.anchor.initialize(owner),a);assert.equal(f.retired.length,0);
 f.setSession(session(nextSid));const fresh=await f.anchor.initialize(owner);assert.notEqual(fresh.accountGeneration,a.accountGeneration);assert.deepEqual(f.retired,[a]);
});
test('INITIALIZING and transient lookup failure suspend authority without retiring the original Save namespace',async()=>{
 const f=fixture(),a=await f.anchor.initialize(owner);await f.setAuth({status:'INITIALIZING',sessionUserId:null});assert.equal(f.anchor.current(),null);assert.equal(f.retired.length,0);
 await f.setAuth({status:'SIGNED_IN',sessionUserId:owner});assert.deepEqual(await f.anchor.initialize(owner),a);
 f.fail(true);await assert.rejects(f.anchor.initialize(owner));assert.equal(f.anchor.current(),null);assert.equal(f.retired.length,0);
 f.fail(false);assert.deepEqual(await f.anchor.initialize(owner),a);
});
test('confirmed signout retirement remains awaitable after the anchor clears; owner switch retires prior owner',async()=>{
 const f=fixture(),a=await f.anchor.initialize(owner);await f.setAuth({status:'SIGNED_OUT',sessionUserId:null});assert.equal(f.anchor.current(),null);await f.anchor.retire();await f.anchor.awaitRetirement();assert.deepEqual(f.retired,[a]);
 await f.setAuth({status:'SIGNED_IN',sessionUserId:owner});f.setSession(session(nextSid));await f.anchor.initialize(owner);
 await f.setAuth({status:'SIGNED_IN',sessionUserId:p2id(2)});assert.equal(f.anchor.current(),null);assert.equal(f.retired.length,2);
 f.setSession(session(p2id(82),p2id(2)));assert.equal((await f.anchor.initialize(p2id(2))).ownerId,p2id(2));
});
test('late getSession cannot initialize an old owner or supersede confirmed signout',async()=>{
 let auth:RecoveryAuthState={status:'SIGNED_IN',sessionUserId:owner};let resolve!:(s:RecoverySession)=>void;
 const anchor=createPartThreeSessionRecovery({auth:()=>auth,getSession:()=>new Promise(done=>{resolve=done;}),retire:async()=>{}});
 const initializing=anchor.initialize(owner);await Promise.resolve();await Promise.resolve();auth={status:'SIGNED_OUT',sessionUserId:null};await anchor.observeAuth();resolve(session());await assert.rejects(initializing);assert.equal(anchor.current(),null);
});
test('foreign, absent, malformed or non-session JWT claims cannot authorize a journal namespace',async()=>{
 for(const value of [session(sid,p2id(2)),{user:{id:owner},access_token:'bad'},session('bad'),session(sid,owner,{sub:p2id(2)}),session(sid,owner,{session_id:null})])assert.equal(sessionRecoveryGeneration(value,owner),null);
 const f=fixture();f.setSession(null);await assert.rejects(f.anchor.initialize(owner));assert.equal(f.anchor.current(),null);assert.equal(f.retired.length,0);
});
test('durable erasure failure blocks reauthorization and remains visible to awaited retirement',async()=>{
 const anchor=createPartThreeSessionRecovery({auth:()=>({status:'SIGNED_IN',sessionUserId:owner}),getSession:async()=>session(),retire:async()=>{throw Error('Disk erase failed');}});
 await anchor.initialize(owner);await assert.rejects(anchor.retire());await assert.rejects(anchor.retire());await assert.rejects(anchor.initialize(owner));assert.equal(anchor.current(),null);
});
test('real journal wiring recovers encounter metadata after restart and rejects the previous session after fresh login',async()=>{
 const data=new Map<string,string>();const storage=():SaveRecoveryStorage=>({getItem:async key=>data.get(key)??null,setItem:async(key,value)=>{data.set(key,value);}});
 let token=session();const auth=()=>({status:'SIGNED_IN' as const,sessionUserId:owner});
 let journal:ReturnType<typeof createPartThreeSaveRecoveryStore>;
 const anchor=createPartThreeSessionRecovery({auth,getSession:async()=>token,retire:a=>journal.retireOwner(a.ownerId,a.accountGeneration)});journal=createPartThreeSaveRecoveryStore(storage(),()=>anchor.current());
 const a=await anchor.initialize(owner),scope={...a,encounterId:p2id(90),scanId:p2id(91),captureSessionId:p2id(92)},request={operation:'save' as const,requestId:p2id(100),resultId:p2id(101),expectedResultRevision:1,expectedBindingHash:'a'.repeat(64),expectedPacketHash:'b'.repeat(64)};
 await journal.retain(scope,request);
 let restartedJournal:ReturnType<typeof createPartThreeSaveRecoveryStore>;
 const restarted=createPartThreeSessionRecovery({auth,getSession:async()=>token,retire:a=>restartedJournal.retireOwner(a.ownerId,a.accountGeneration)});restartedJournal=createPartThreeSaveRecoveryStore(storage(),()=>restarted.current());
 const recoveredAccount=await restarted.initialize(owner);assert.deepEqual(await restartedJournal.discover({...recoveredAccount,scanId:scope.scanId,captureSessionId:scope.captureSessionId}),{state:'pending',scope,request});
 token=session(nextSid);const fresh=await restarted.initialize(owner);assert.equal((await restartedJournal.discover({...fresh,scanId:scope.scanId,captureSessionId:scope.captureSessionId})).state,'none');await assert.rejects(restartedJournal.recover(scope));
});

test('confirmed signout erases the prior process journal even before session initialization succeeds',async()=>{
 const data=new Map<string,string>(),storage:SaveRecoveryStorage={getItem:async key=>data.get(key)??null,setItem:async(key,value)=>{data.set(key,value);}};
 const old={ownerId:owner,accountGeneration:sessionRecoveryGeneration(session(),owner)!},journal=createPartThreeSaveRecoveryStore(storage,()=>old);
 const scope={...old,encounterId:p2id(90),scanId:p2id(91),captureSessionId:p2id(92)},request={operation:'save' as const,requestId:p2id(100),resultId:p2id(101),expectedResultRevision:1,expectedBindingHash:'a'.repeat(64),expectedPacketHash:'b'.repeat(64)};await journal.retain(scope,request);
 let auth:RecoveryAuthState={status:'SIGNED_IN',sessionUserId:owner};
 let restartedJournal:ReturnType<typeof createPartThreeSaveRecoveryStore>;
 const restarted=createPartThreeSessionRecovery({auth:()=>auth,getSession:async()=>{throw Error('Session readiness failed');},retire:a=>restartedJournal.retireOwner(a.ownerId,a.accountGeneration),retireUnanchored:id=>restartedJournal.eraseOwner(id)});
 restartedJournal=createPartThreeSaveRecoveryStore({...storage},()=>restarted.current());
 await assert.rejects(restarted.initialize(owner));auth={status:'SIGNED_OUT',sessionUserId:null};await restarted.observeAuth();await restarted.retire();
 assert(![...data.values()].join('').includes(request.requestId));await assert.rejects(createPartThreeSaveRecoveryStore({...storage},()=>old).recover(scope));
});

test('owner change retires uninitialized old-owner metadata before establishing the new owner',async()=>{
 let auth:RecoveryAuthState={status:'SIGNED_IN',sessionUserId:owner};const erased:string[]=[];
 const anchor=createPartThreeSessionRecovery({auth:()=>auth,getSession:async()=>session(sid,p2id(2)),retire:async()=>{},retireUnanchored:async id=>{erased.push(id);}});
 auth={status:'INITIALIZING',sessionUserId:null};await anchor.observeAuth();auth={status:'SIGNED_IN',sessionUserId:p2id(2)};await anchor.observeAuth();assert.deepEqual(erased,[owner]);await anchor.initialize(p2id(2));
 auth={status:'SIGNED_OUT',sessionUserId:null};await anchor.observeAuth();await anchor.retire();assert.equal(erased.at(-1),p2id(2));
});

test('restarted same-owner session with a new SID erases the ignored older journal on confirmed signout',async()=>{
 const data=new Map<string,string>(),storage=():SaveRecoveryStorage=>({getItem:async key=>data.get(key)??null,setItem:async(key,value)=>{data.set(key,value);}});
 const old={ownerId:owner,accountGeneration:sessionRecoveryGeneration(session(),owner)!},scope={...old,encounterId:p2id(90),scanId:p2id(91),captureSessionId:p2id(92)},request={operation:'save' as const,requestId:p2id(100),resultId:p2id(101),expectedResultRevision:1,expectedBindingHash:'a'.repeat(64),expectedPacketHash:'b'.repeat(64)};
 await createPartThreeSaveRecoveryStore(storage(),()=>old).retain(scope,request);
 let auth:RecoveryAuthState={status:'SIGNED_IN',sessionUserId:owner},journal:ReturnType<typeof createPartThreeSaveRecoveryStore>;
 const restarted=createPartThreeSessionRecovery({auth:()=>auth,getSession:async()=>session(nextSid),retire:a=>journal.retireOwner(a.ownerId,a.accountGeneration),retireUnanchored:id=>journal.eraseOwner(id)});
 journal=createPartThreeSaveRecoveryStore(storage(),()=>restarted.current());const fresh=await restarted.initialize(owner);assert.notEqual(fresh.accountGeneration,old.accountGeneration);
 assert.equal((await journal.discover({...fresh,scanId:scope.scanId,captureSessionId:scope.captureSessionId})).state,'none');assert([...data.values()].join('').includes(request.requestId),'Ignoring an older journal is not local erasure');
 auth={status:'SIGNED_OUT',sessionUserId:null};await restarted.observeAuth();await restarted.awaitRetirement();
 assert(![...data.values()].join('').includes(request.requestId));assert(![...data.values()].join('').includes(request.resultId));assert(![...data.values()].join('').includes(owner));
});
