import assert from 'node:assert/strict';
import test from 'node:test';
import {p3input} from './fixtures/part-three.ts';
import {p2id} from './fixtures/part-two-core.ts';
import {PENDING_SCIENTIFIC_MANIFEST} from '../src/domain/part-four/scientificDecision.ts';
const api=await import('../src/domain/part-four/featureProjection.ts').catch(()=>null);
function fixture(){const x=p3input();x.context.profile!.id=p2id(101);x.binding.profileRevision=p2id(101);return x;}
test('real normalized formula/context feature projection exists',()=>assert(api));
test('projection uses actual identity/use and leaves scientific bridge/dose/population unknown',()=>{
 assert(api);const x=fixture();x.context.profile!.data.primaryGoal={state:'known',value:'dryness'};
 const e=api.projectScientificFeatures({manifest:PENDING_SCIENTIFIC_MANIFEST,binding:x.binding,partTwo:x.partTwo,context:x.context,requestedUse:x.requestedUse,now:x.now});
 const r=e.claims.find(r=>r.claimId==='G01-01')!;assert(r);assert.equal(r.features.ingredientId?.state,'known');assert(r.features.ingredientId?.values?.includes('glycerin'));assert(r.features.ingredientId?.factIds.length);
 assert.equal(r.features.amountPercent?.state,'unknown');assert.equal(r.features.vehicleBridge?.state,'unknown');assert.equal(r.features.population?.state,'unknown');
 assert.equal(r.features.endpoint?.state,'known');assert(r.features.endpoint?.contextRevisionIds.includes(x.context.profile!.id));
});
test('foreign owner, context and stale normalization cannot produce a feature envelope',()=>{
 assert(api);const x=fixture(),base={manifest:PENDING_SCIENTIFIC_MANIFEST,binding:x.binding,partTwo:x.partTwo,context:x.context,requestedUse:x.requestedUse,now:x.now};
 assert.throws(()=>api.projectScientificFeatures({...base,context:{...x.context,ownerId:p2id(999)}}));
 assert.throws(()=>api.projectScientificFeatures({...base,binding:{...x.binding,contextRevision:99}}),/binding/);
 assert.throws(()=>api.projectScientificFeatures({...base,now:x.partTwo.expiresAt}),/expired/);
});
