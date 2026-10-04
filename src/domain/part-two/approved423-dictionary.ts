import {ISOLATED_423_EDUCATION,validate423Candidate} from '../part-four/knowledge423.ts';
import {APPROVED423_SOURCE_HASH} from '../part-four/approved423-runtime.ts';
import {dictionaryReleaseHash,lookupName,validateDictionaryRelease,type DictionaryRelease} from './dictionary.ts';

/** Exact approved display-name -> declared-name identity only. No proposed
 * synonym, chemical equivalence, taxonomy, function or acquisition grant. The
 * immutable original dictionary remains a separate historical release. */
export function approved423CanonicalDictionary(original:DictionaryRelease):DictionaryRelease {
 const base=validateDictionaryRelease(original);
 if(base.contentHash!=='ef75d28761f64633316a2ca19542bfe3fada71dfea5590ec1dd5016e8a9bd4b0')throw Error('Canonical admission requires reviewed original dictionary');
 const education=validate423Candidate(ISOLATED_423_EDUCATION),dictionary=structuredClone(base);
 dictionary.version='derive-approved-canonical423-v1';
 dictionary.provenance={...base.provenance,source:'Derive authored exact canonical-name index of approved423 reference; names and declared IDs only',sourceRevision:APPROVED423_SOURCE_HASH,importVersion:'approved423-canonical-only-v1',allowedFields:['names','exact_aliases','unclassified_declared_identity_ids'],policyId:'derive-approved-canonical423-lexical-v1',attribution:'Approved ingredient reference canonical names; exact lookup only; automated fidelity review',reviewedAt:'2026-10-04T07:19:57Z',rightsOwner:'Derive authored lookup index; underlying education authority remains independent'};
 dictionary.aliases=dictionary.aliases.map(a=>({...a,release:dictionary.version}));
 const identities=new Map(dictionary.identities.map(i=>[i.ingredientId,i]));
 const keys=new Map(dictionary.aliases.filter(a=>a.status==='active').map(a=>[a.lookupKey,a.ingredientId]));
 for(const card of education.cards){
  const key=lookupName(card.name).key,prior=keys.get(key);
  if(prior&&prior!==card.ingredientId)throw Error('Approved canonical name conflicts with existing identity');
  if(prior)continue;
  if(identities.has(card.ingredientId))throw Error('Canonical name would create unreviewed identity equivalence');
  const identity:DictionaryRelease['identities'][number]={ingredientId:card.ingredientId,preferredName:card.name,identityClass:'unclassified_declared_name',nameSystem:'approved_exact_declared_name',status:'active',supersedesIds:[],externalReferences:[]};
  dictionary.identities.push(identity);identities.set(card.ingredientId,identity);
  dictionary.aliases.push({aliasRecordId:`approved423-canonical:${card.ingredientId}`,surface:card.name,lookupKey:key,ingredientId:card.ingredientId,language:null,nameSystem:'approved_exact_declared_name',relationship:'same_declared_identity',rule:'exact_name',evidenceSource:`approved423-name:${card.editorial.copySha256}`,reviewDecision:'approved',release:dictionary.version,status:'active'});
  keys.set(key,card.ingredientId);
 }
 dictionary.contentHash=dictionaryReleaseHash(dictionary);
 return validateDictionaryRelease(dictionary);
}
