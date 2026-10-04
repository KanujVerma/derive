import {REVIEWED_USEFULNESS_MANIFEST} from './reviewedUsefulness.ts';
import {REVIEWED_PUBLIC_USEFULNESS_MANIFEST} from './reviewedHostedUsefulness.ts';
import { partFourBindingRelease } from './release.ts';
import { PENDING_SCIENTIFIC_MANIFEST } from './scientificDecision.ts';
import { REVIEWED_AHA_MANIFEST } from './reviewedAha.ts';
/** Bundle selection pins the client's expected publication. It grants no server
 * release, source permission or claim admission. No arbitrary hash negotiation. */
export interface PartFourClientSelection {
 education:'approved37'|'approved47'|'approved423';
 science:'none'|'pending_candidates'|'reviewed_aha'|'reviewed_usefulness'|'reviewed_public_usefulness';
}
export function parsePartFourClientSelection(education?:string,science?:string):PartFourClientSelection {
 const e=education||'approved37',s=science||'none';
 if(!['approved37','approved47','approved423'].includes(e)||!['none','pending_candidates','reviewed_aha','reviewed_usefulness','reviewed_public_usefulness'].includes(s))throw Error('Invalid Part Four client release selection');
 return {education:e as PartFourClientSelection['education'],science:s as PartFourClientSelection['science']};
}
export function ordinaryPartFourClientSelection(science?:string):PartFourClientSelection {
 if(science&&!['pending_candidates','reviewed_public_usefulness'].includes(science))throw Error('Invalid ordinary Part Four science selection');
 return parsePartFourClientSelection('approved423',science||'pending_candidates');
}
export function partFourClientBinding(selection:PartFourClientSelection= {education:'approved37',science:'none'}) {
 const checked=parsePartFourClientSelection(selection.education,selection.science);
 return partFourBindingRelease(checked.education==='approved37'?undefined:checked.education,checked.science==='pending_candidates'?PENDING_SCIENTIFIC_MANIFEST.contentHash:checked.science==='reviewed_aha'?REVIEWED_AHA_MANIFEST.contentHash:checked.science==='reviewed_usefulness'?REVIEWED_USEFULNESS_MANIFEST.contentHash:checked.science==='reviewed_public_usefulness'?REVIEWED_PUBLIC_USEFULNESS_MANIFEST.contentHash:undefined,['reviewed_usefulness','reviewed_public_usefulness'].includes(checked.science)?'reviewed_usefulness':undefined);
}
