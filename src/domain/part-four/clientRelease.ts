import { partFourBindingRelease } from './release.ts';
import { PENDING_SCIENTIFIC_MANIFEST } from './scientificDecision.ts';
/** Bundle selection pins the client's expected publication. It grants no server
 * release, source permission or claim admission. No arbitrary hash negotiation. */
export interface PartFourClientSelection {
 education:'approved37'|'approved47'|'approved423';
 science:'none'|'pending_candidates';
}
export function parsePartFourClientSelection(education?:string,science?:string):PartFourClientSelection {
 const e=education||'approved37',s=science||'none';
 if(!['approved37','approved47','approved423'].includes(e)||!['none','pending_candidates'].includes(s))throw Error('Invalid Part Four client release selection');
 return {education:e as PartFourClientSelection['education'],science:s as PartFourClientSelection['science']};
}
export function partFourClientBinding(selection:PartFourClientSelection= {education:'approved37',science:'none'}) {
 const checked=parsePartFourClientSelection(selection.education,selection.science);
 return partFourBindingRelease(checked.education==='approved37'?undefined:checked.education,checked.science==='pending_candidates'?PENDING_SCIENTIFIC_MANIFEST.contentHash:undefined);
}
