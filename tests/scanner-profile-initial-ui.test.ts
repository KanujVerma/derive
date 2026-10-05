import test from 'node:test';
import assert from 'node:assert/strict';
import {componentHarness,control,press,textContent} from './ux-profile-render.ts';
import {resolveScannerEntry} from '../src/presentation/scanner-release/entry.ts';
test('ready guest reaches Check without completing optional profile',()=>{
 const input:any={authStatus:'SIGNED_IN',ownerId:'a',accessStatus:'READY',access:{userId:'a'},contextOwnerId:'a',contextStatus:'ready',hasProfile:false,profileIntroHandled:false,guestBootstrap:true};
 assert.equal(resolveScannerEntry(input),'check');assert.equal(resolveScannerEntry({...input,accessStatus:'ERROR'}),'error');
});
test('live setup has one Back, retains optional answers and saves without spending or preference strength questions',()=>{
 let saved:any;const h=componentHarness('src/components/p0b-personalization/ContextFlow.tsx','ContextFlow',{setup:true,durableSetup:true,collectIntent:false,ownerId:'a',createId:()=> 'item',onSetup:(bundle:any,draft:any)=>{saved={bundle,draft};},onApply(){},onSkip(){}});
 for(let step=0;step<5;step++){
  const nodes=h.render(),copy=textContent(nodes);assert.match(copy,new RegExp(`Step\\s+${step+1}\\s+of\\s+5`));
  assert.equal(nodes.filter(n=>n.props.label==='Back').length,1);
  assert.doesNotMatch(copy,/Spending limit|Confirmed preferences|How strong|Anything else|Leave my goal unanswered|Prefer not to share/);
  assert(!copy.includes('Your skin profile'));
  if(step===1){assert(nodes.some(n=>n.props.label==='How does your skin usually feel?'));assert(!nodes.some(n=>String(n.props.label).includes('does your skin get irritated easily?')));}
  if(step===2){assert(nodes.some(n=>String(n.props.label).includes('does your skin get irritated easily?')));assert(!nodes.some(n=>n.props.label==='How does your skin usually feel?'));}
  if(step===0)press(control(nodes,'Dryness'));
  if(step===1)press(control(nodes,'Dry or tight'));
  if(step===4)assert.ok(!nodes.some(n=>n.props.label==='Stung'),'reaction choices wait for an explicit product selection');
  press(control(h.render(),step===4?'Save skin profile':'Continue'));
 }
 assert.deepEqual(saved.draft.primaryGoal,{state:'answered',value:'dryness'});assert.deepEqual(saved.draft.behavior,{state:'answered',value:'dry_tight'});assert.deepEqual(saved.draft.reactivity,{state:'unanswered'});assert.equal(saved.bundle.products.length,0);
});
