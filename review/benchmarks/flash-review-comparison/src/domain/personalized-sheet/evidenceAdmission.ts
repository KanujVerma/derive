import {sha256} from '../part-two/hash.ts';

/** Automatic, versioned evidence admission. This does not establish clinical truth.
 * Source rights and source identity come from server acquisition, never a client/model.
 * Semantic review is an automated second pass over the original source, not confidence. */
export interface Subject {productId:string;variantId:string;formulaVersionId:string|null}
export interface EvidenceSource {
 id:string;version:string;url:string;publisherKind:'manufacturer'|'scientific'|'review';
 body:string;bodyHash:string;retrievedAt:string;expiresAt:string;
 rights:{policyRevision:string;process:boolean;store:boolean;display:boolean;revoked:boolean};
 subject:Subject|null;
 attribution?:{title:string;creators:string;licenseUrl:string;copyrightNotice?:string};
}
export interface EvidenceClaim {
 id:string;sourceId:string;kind:'label_fact'|'research_result'|'reported_experience';
 quote:{start:number;end:number;text:string};
 subject:Subject|null;
 scope:'ingredient_reference'|'exact_product';
 /** Applicability dimensions explicitly extracted from the source. Null stays unknown. */
 applicability:{ingredientId:string|null;amountPercent:number|null;amountBasis:'active'|'blend'|'unknown';site:string|null;useForm:string|null;endpoint:string|null;population:string|null};
}
export interface AutomatedReview {
 version:'automatic-evidence-review/v1';claimHash:string;sourceHash:string;
 supported:boolean;contradicted:boolean;subjectMatched:boolean;
 reviewedAt:string;reviewerModel:string;requestId:string;
}
export type AdmittedClaim={claim:EvidenceClaim;source:{id:string;version:string;url:string;bodyHash:string;rightsRevision:string;attribution?:EvidenceSource['attribution']};admittedAt:string;validUntil:string;admissionVersion:'automatic-evidence-admission/v1';status:'reference'|'product_fact'|'reported_experience'|'research_reference'};
const stable=(v:unknown):string=>{if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(stable).join(',')+']';return '{'+Object.keys(v as object).sort().map(k=>JSON.stringify(k)+':'+stable((v as Record<string,unknown>)[k])).join(',')+'}';};
export {stable as canonicalJson};
export async function digest(v: unknown): Promise<string> {
  return sha256(typeof v === 'string' ? v : stable(v));
}
const matches=(a:Subject|null,b:Subject)=>Boolean(a&&a.productId===b.productId&&a.variantId===b.variantId&&a.formulaVersionId===b.formulaVersionId);
export async function admitEvidence(input:{source:EvidenceSource;claim:EvidenceClaim;review:AutomatedReview;expectedSubject:Subject;now:string}):Promise<{kind:'admitted';value:AdmittedClaim}|{kind:'rejected';reason:string}>{
 const {source:s,claim:c,review:r}=input;
 const reject=(reason:string)=>({kind:'rejected' as const,reason});
 const now=Date.parse(input.now),retrieved=Date.parse(s.retrievedAt),expiry=Date.parse(s.expiresAt),reviewed=Date.parse(r.reviewedAt);
 if(![now,retrieved,expiry,reviewed].every(Number.isFinite)||retrieved>reviewed||reviewed>now||expiry<=now)return reject('stale_or_invalid_time');
 if(!s.rights.policyRevision||s.rights.revoked||!s.rights.process||!s.rights.store||!s.rights.display)return reject('source_operation_not_permitted');
 let url:URL;try{url=new URL(s.url);}catch{return reject('invalid_citation');}
 if(url.protocol!=='https:'||url.username||url.password)return reject('invalid_citation');
 if(!s.body||s.body.length>200000||s.bodyHash!==await digest(s.body))return reject('source_bytes_changed');
 if(c.sourceId!==s.id||r.sourceHash!==s.bodyHash||r.claimHash!==await digest(c)||r.version!=='automatic-evidence-review/v1'||!r.requestId||!r.reviewerModel)return reject('unbound_review');
 if(!Number.isSafeInteger(c.quote.start)||!Number.isSafeInteger(c.quote.end)||c.quote.start<0||c.quote.end<=c.quote.start||c.quote.end>s.body.length||c.quote.text!==s.body.slice(c.quote.start,c.quote.end))return reject('quote_not_in_source');
 if(!r.supported||r.contradicted)return reject('unsupported_or_conflicting_claim');
 if(c.scope==='exact_product'&&(!matches(c.subject,input.expectedSubject)||!matches(s.subject,input.expectedSubject)||!r.subjectMatched))return reject('different_product_or_formula');
 if(c.kind==='label_fact'&&(s.publisherKind!=='manufacturer'||c.scope!=='exact_product'))return reject('label_authority_missing');
 if(c.kind==='research_result'&&s.publisherKind!=='scientific')return reject('research_authority_missing');
 if(c.kind==='reported_experience'&&(s.publisherKind!=='review'||c.scope!=='exact_product'))return reject('report_scope_missing');
 const amount=c.applicability.amountPercent;
 if(amount!==null&&(!Number.isFinite(amount)||amount<0||amount>100||c.applicability.amountBasis==='unknown'))return reject('invalid_amount');
 const status=c.kind==='label_fact'?'product_fact':c.kind==='reported_experience'?'reported_experience':c.scope==='ingredient_reference'?'reference':'research_reference';
 return {kind:'admitted',value:{claim:c,source:{id:s.id,version:s.version,url:s.url,bodyHash:s.bodyHash,rightsRevision:s.rights.policyRevision,...(s.attribution?{attribution:s.attribution}:{})},admittedAt:input.now,validUntil:s.expiresAt,admissionVersion:'automatic-evidence-admission/v1',status}};
}
/** Ingredient-level or reference evidence must never silently become a finished-product claim.
 * Applying a study requires every relevant declared dimension to match known product/use facts.
 * This gate only establishes matched conditions, not a guaranteed personal outcome. */
export function researchApplies(claim:EvidenceClaim,facts:EvidenceClaim['applicability']):boolean {
 if(claim.kind!=='research_result'||claim.scope!=='exact_product'||claim.applicability.amountBasis!=='active'||facts.amountBasis!=='active')return false;
 for(const key of ['ingredientId','amountPercent','amountBasis','site','useForm','endpoint','population'] as const){
  const expected=claim.applicability[key],actual=facts[key];
  if(expected===null||actual===null||expected==='unknown'||actual==='unknown'||expected!==actual)return false;
 }
 return true;
}
