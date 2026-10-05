import test from 'node:test';
import assert from 'node:assert/strict';
import {useFreeAccessStore} from '../src/stores/freeAccessStore.ts';
test('foreground revalidation retains current owner navigation and rejects stale acknowledgements',()=>{
 const store=useFreeAccessStore.getState();store.reset();const a:any={userId:'a',freeProductAccess:true,managedAccess:false};store.ready(a,store.start('a'));
 const refresh=useFreeAccessStore.getState().startRefresh('a');assert.notEqual(refresh,null);
 assert.equal(useFreeAccessStore.getState().status,'READY');assert.equal(useFreeAccessStore.getState().access?.userId,'a');
 assert.equal(useFreeAccessStore.getState().finishRefresh({...a,userId:'b'},refresh!),false);
 store.reset();store.ready({...a,userId:'b'},store.start('b'));
 assert.equal(useFreeAccessStore.getState().finishRefresh(a,refresh!),false);
 assert.equal(useFreeAccessStore.getState().access?.userId,'b');
 const next=useFreeAccessStore.getState().startRefresh('b');assert.notEqual(next,null);
 assert.equal(useFreeAccessStore.getState().fail('b',next!),true);assert.equal(useFreeAccessStore.getState().status,'ERROR');assert.equal(useFreeAccessStore.getState().access,null);
});
