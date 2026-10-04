import {Candidate423ReleaseSchema,Candidate423LookupSchema,Candidate423SelectionSchema,type Candidate423Release,type Candidate423Card} from '../../contracts/IngredientEducation423Candidate.ts';
import {APPROVED423_RUNTIME_RELEASE,APPROVED423_SOURCE_HASH,APPROVED423_RELEASE_HASH} from './approved423-runtime.ts';
import {canonicalJson,sha256} from '../part-two/hash.ts';
import {lookupName,deepFreeze} from '../part-two/dictionary.ts';
function contentHash(value:Record<string,unknown>):string {const {contentHash:_,...content}=value;return sha256(canonicalJson(content));}
export const ISOLATED_423_EDUCATION=deepFreeze(Candidate423ReleaseSchema.parse(APPROVED423_RUNTIME_RELEASE));
const validated=new WeakSet<object>();
const indexes=new WeakMap<object,Map<string,Candidate423Card>>();
export function validate423Candidate(value:unknown):Candidate423Release {
 if(value&&typeof value==='object'&&validated.has(value))return value as Candidate423Release;
 const parsed=Candidate423ReleaseSchema.parse(value);
 if(parsed.contentHash!==APPROVED423_RELEASE_HASH||contentHash(parsed)!==APPROVED423_RELEASE_HASH)throw Error('423 candidate differs from pinned education proposal');
 deepFreeze(parsed);validated.add(parsed);
 if(value&&typeof value==='object'){deepFreeze(value);validated.add(value);}
 return parsed;
}
validate423Candidate(ISOLATED_423_EDUCATION);
/** Explicit isolated selection only. No default runtime release follows this
 * proposal. Known identity disagreement and ambiguity cannot be overridden by
 * educational copy; the 51 proposed aliases never participate in lookup. */
export function resolve423EducationalCard(input:unknown,selection:unknown,candidate:unknown=ISOLATED_423_EDUCATION):Candidate423Card|null {
 const requested=Candidate423LookupSchema.safeParse(input),selected=Candidate423SelectionSchema.safeParse(selection);
 if(!requested.success||!selected.success||requested.data.mapping.state==='ambiguous')return null;
 let release:Candidate423Release;try{release=validate423Candidate(candidate);}catch{return null;}
 if(selected.data.expectedReleaseHash!==release.contentHash||release.provenance.revoked||release.provenance.expiresAt!==null&&Date.parse(release.provenance.expiresAt)<=Date.parse(selected.data.now))return null;
 const withdrawn=selected.data.withdrawnDependencies??[];
 if([release.version,release.contentHash,APPROVED423_SOURCE_HASH].some(id=>withdrawn.includes(id)))return null;
 const key=lookupName(requested.data.literalName).key;
 let index=indexes.get(release);if(!index){index=new Map(release.cards.flatMap(card=>[card.name,...card.aliases].map(name=>[lookupName(name).key,card] as const)));indexes.set(release,index);}
 const card=index.get(key);
 if(!card||requested.data.mapping.state==='known'&&requested.data.mapping.ingredientId!==card.ingredientId)return null;
 const doc=card.editorial;
 const deps=[card.ingredientId,doc.copySha256,doc.libraryFileId,doc.documentSha256,...card.sourceIds,...release.sources.filter(source=>card.sourceIds.includes(source.id)).flatMap(source=>[source.editorial.metadataSha256,source.url])];
 if(card.rawRecordId)deps.push(release.provenance.expansionSourcePackage.sha256,release.provenance.copyApproval.messageId);
 return deps.some(dep=>withdrawn.includes(dep))?null:card;
}
