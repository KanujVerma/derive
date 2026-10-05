import type { Variant } from '../../../src/contracts/PartOne.ts';
import { normalizeBarcode } from '../../../src/domain/part-one/barcode.ts';
import { compareVariant, policyAllows } from '../../../src/domain/part-one/evidence.ts';
import { parseDeclarationSection } from '../../../src/domain/part-one/parser.ts';
import { hashPrivateObservation, PrivateEvidenceContextSchema } from './part-one-private-evidence.ts';
import type { PrivateEvidenceContext, PrivateObservationRecord } from './part-one-private-evidence.ts';

import { GenericCapturedSourceOutcomeSchema, CAPTURED_SOURCE_EXTRACTOR_VERSION } from '../../../src/contracts/PartOneCapturedSource.ts';
import type { CapturedSourceRef, CapturedSourceCandidate, GenericCapturedSourceOutcome } from '../../../src/contracts/PartOneCapturedSource.ts';
export { GenericCapturedSourceOutcomeSchema, CapturedSourceCandidateSchema, CapturedSourceRefSchema, CAPTURED_SOURCE_EXTRACTOR_VERSION } from '../../../src/contracts/PartOneCapturedSource.ts';
export type { CapturedSourceRef, CapturedSourceCandidate, GenericCapturedSourceOutcome } from '../../../src/contracts/PartOneCapturedSource.ts';
export type CapturedSourcePorts={hash(text:string):Promise<string>};

const unknownVariant=():Variant=>({brand:null,line:null,form:null,scent:null,shade:null,spf:null,strength:null,size:null,unit:null,packCount:null,packagingLevel:null});
const key=(value:string)=>value.toLowerCase();
const sameIds=(a:string[],b:string[])=>JSON.stringify(a.map(key).sort())===JSON.stringify(b.map(key).sort());
const normalized=(value:unknown)=>String(value).normalize('NFC').trim().replace(/\s+/g,' ').toLowerCase();
const reading=(value:string)=>value.replace(/^\s*(?:inactive\s+|active\s+)?ingredients\s*:\s*/i,'').replace(/\s+/g,' ').trim();
const unique=<T>(values:T[])=>[...new Set(values)];
const fresh=(record:{status:string;observedAt:string;expiresAt:string},now:string)=>record.status==='active'&&Date.parse(record.observedAt)<=Date.parse(now)&&Date.parse(record.expiresAt)>Date.parse(now);
const validRegion=(r:number[])=>r.length===4&&r.every(Number.isFinite)&&r.every(v=>v>=0&&v<=1)&&r[2]>0&&r[3]>0&&r[0]+r[2]<=1.000001&&r[1]+r[3]<=1.000001;
function frozen<T>(value:T):T{const out=structuredClone(value);const freeze=(v:unknown)=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}};freeze(out);return out;}
async function derivedId(seed:string,ports:CapturedSourcePorts){const digest=await ports.hash(seed);if(!/^[a-f0-9]{64}$/i.test(digest))throw new Error('cryptographic_hash_required');const h=digest.toLowerCase();return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;}
function blocked(reasons:string[]):GenericCapturedSourceOutcome{return frozen(GenericCapturedSourceOutcomeSchema.parse({schemaVersion:1,sourceKind:'captured_label_extractor',state:'blocked',candidate:null,facts:{sections:[],capturedText:[]},reasonCodes:unique(reasons),absenceClaimsAllowed:false,catalogVerified:false,acceptanceEligible:false}));}

/** OCR proves what text was returned for an image region. It does not prove
 * that a hidden, skipped, folded, or unreadable ingredient line does not exist.
 * This general producer therefore emits useful literal private facts and a
 * bounded candidate; no synthetic registry, moderation, or completeness oracle
 * participates in this path. */
export async function extractPrivateCapturedSource(contextInput:PrivateEvidenceContext,ports:CapturedSourcePorts):Promise<GenericCapturedSourceOutcome>{
 const input=PrivateEvidenceContextSchema.parse(contextInput),all=[...input.observations,...input.priorObservations],errors:string[]=[];
 if(input.capture.scanId!==input.result.scanId||input.capture.generation!==input.result.generation||input.capture.itemId!==input.result.itemId||input.item&&(input.item.itemId!==input.result.itemId||input.item.snapshotId!==input.result.snapshotId))errors.push('capture_binding_mismatch');
 if(!(['process','retain','privateDisplay','ocr'] as const).every(op=>policyAllows(input.policy,op,input.now))||!input.policy.retainedFields.includes('ingredients'))errors.push('captured_source_policy_blocked');
 if(!input.observations.length)errors.push('source_observations_missing');
 if(input.assets.length>6||all.length>142||all.some(o=>o.rawText.length>50000||(o.ocr?.lines.length??0)>2000))errors.push('source_bounds_exceeded');
 if(new Set(all.map(o=>key(o.observationId))).size!==all.length||new Set(input.assets.map(a=>key(a.evidenceId))).size!==input.assets.length||new Set(input.assets.map(a=>key(a.storageObjectId))).size!==input.assets.length)errors.push('duplicate_evidence_id');
 const byId=new Map(all.map(o=>[key(o.observationId),o]));
 const bound=(o:{ownerId:string;captureSessionId:string;packageObservationId:string;generation:number;deletionEpoch:number})=>o.ownerId===input.ownerId&&o.captureSessionId===input.capture.captureSessionId&&o.packageObservationId===input.capture.packageObservationId&&o.generation===input.capture.generation&&o.deletionEpoch===input.capture.deletionEpoch;
 for(const asset of input.assets)if(!bound(asset)||!fresh(asset,input.now)||!asset.metadataStripped)errors.push('private_asset_unavailable');
 for(const o of all){
  if(!bound(o)||!fresh(o,input.now))errors.push('private_observation_unavailable');
  if(!o.assetEvidenceIds.length||o.assetEvidenceIds.some(id=>!input.assets.some(a=>key(a.evidenceId)===key(id))))errors.push('observation_asset_binding_invalid');
  if(o.kind==='ocr'){
   if(!o.ocr||o.edit||o.revision!==1||o.supersedesId||o.originalObservationId!==o.observationId||o.ocr.captureSessionId!==input.capture.captureSessionId||o.ocr.generation!==input.capture.generation||o.ocr.lines.map(l=>l.text).join('\n')!==o.rawText||o.ocr.status!=='recognized')errors.push('invalid_ocr_lineage');
   if(o.ocr){
    const assets=input.assets.filter(a=>o.assetEvidenceIds.includes(a.evidenceId));
    if(assets.length!==1||assets[0].clientEvidenceId!==o.ocr.evidenceId)errors.push('invalid_photo_binding');
    if(o.coordinateSpace==='sanitized_derivative'&&(!assets.some(a=>a.width===o.ocr!.sourceWidth&&a.height===o.ocr!.sourceHeight)||JSON.stringify(o.ocr.orientationTransform)!=='[1,0,0,0,1,0,0,0,1]'||o.ocr.lines.some(l=>!validRegion(l.region))))errors.push('invalid_derivative_geometry');
    if(o.coordinateSpace==='source_original'&&(!o.ocr.sourceWidth||!o.ocr.sourceHeight||o.ocr.sourceWidth*o.ocr.sourceHeight>40_000_000||o.derivedFromObservationIds.length))errors.push('invalid_original_geometry');
    if(new Set(o.derivedFromObservationIds.map(key)).size!==o.derivedFromObservationIds.length||o.derivedFromObservationIds.some(id=>{const parent=byId.get(key(id));return!parent||parent.kind!=='ocr'||parent.coordinateSpace!=='source_original'||parent.role!==o.role||!sameIds(parent.assetEvidenceIds,o.assetEvidenceIds);}))errors.push('invalid_derivative_ancestry');
   }
  }else{
   const prior=o.supersedesId?byId.get(key(o.supersedesId)):undefined;
   if(!prior||!o.edit||o.ocr||o.edit.observationId!==o.observationId||o.edit.supersedesId!==prior.observationId||o.edit.revision!==o.revision||o.revision!==prior.revision+1||o.rawText!==o.edit.text||o.originalObservationId!==prior.originalObservationId||o.coordinateSpace!==prior.coordinateSpace||o.role!==prior.role||!sameIds(o.assetEvidenceIds,prior.assetEvidenceIds))errors.push('invalid_edit_lineage');
  }
 }
 if(input.observations.some(o=>all.some(child=>child.supersedesId===o.observationId)))errors.push('superseded_source_selected');
 const rootOf=(o:PrivateObservationRecord)=>byId.get(key(o.originalObservationId));
 for(const o of all){let at:PrivateObservationRecord|undefined=o;const seen=new Set<string>();while(at?.supersedesId){if(seen.has(key(at.observationId))){errors.push('edit_lineage_cycle');break;}seen.add(key(at.observationId));at=byId.get(key(at.supersedesId));}if(!at||at.kind!=='ocr'||at.observationId!==o.originalObservationId)errors.push('invalid_original_ancestry');}
 if(errors.length)return blocked(errors);

 const reasons=['full_panel_not_established'],gaps:CapturedSourceCandidate['gaps']=[{code:'ocr_panel_coverage_unverified',observationIds:input.observations.map(o=>o.observationId),details:null}],contradictions:CapturedSourceCandidate['contradictions']=[];
 const heads=input.observations.filter(o=>rootOf(o)?.coordinateSpace==='sanitized_derivative');
 if(!heads.length)return blocked(['exact_jpeg_observation_missing']);
 const ref=(o:PrivateObservationRecord,start:number,end:number):CapturedSourceRef|null=>{
  const root=rootOf(o),lineIndex=o.rawText.slice(0,start).split('\n').length-1,geometry=root?.ocr?.lines[lineIndex]?.region;
  if(!geometry||!validRegion(geometry)||start>=end||end>o.rawText.length)return null;
  return{observationId:o.observationId,revision:o.revision,start,end,assetEvidenceId:o.assetEvidenceIds[0],text:o.rawText.slice(start,end),region:[...geometry]};
 };
 const lines=(o:PrivateObservationRecord)=>{let at=0;return o.rawText.split('\n').map(text=>{const line={text,start:at,end:at+text.length};at+=text.length+1;return line;});};
 const capturedText:GenericCapturedSourceOutcome['facts']['capturedText']=[];
 const fields=new Map<string,Array<{value:string|number;ref:CapturedSourceRef}>>(),codes:Array<{code:{raw:string;symbology:string;namespace:'gtin';retailerId:null};canonical:string;ref:CapturedSourceRef}>=[];
 const categoryValues:Array<{value:'cosmetic'|'drug';ref:CapturedSourceRef}>=[],marketValues:Array<{value:string;ref:CapturedSourceRef}>=[],names:Array<{value:string;ref:CapturedSourceRef}>=[],sections:CapturedSourceCandidate['sections']=[];
 const addField=(field:string,value:string|number,source:CapturedSourceRef|null)=>{if(source)fields.set(field,[...fields.get(field)??[],{value,ref:source}]);};
 const sectionHeader=(text:string)=>text.match(/^\s*(active ingredients|inactive ingredients|ingredients|may contain)(?:\s*:\s*|\s*$)/i);
 const otherHeader=(text:string)=>/^\s*(directions|warnings|usage|storage|distributed by|manufactured by|drug facts)(?:\s*:|\s*$)/i.test(text)||/^\s*(brand|line|form|scent|shade|spf|strength|pack count|packaging level|product name|market|for sale in|category|size|net wt\.?|net contents|GTIN(?:-?14|-?13|-?8)?|EAN(?:-?13|-?8)?|UPC(?:-?A|-?E)?)\s*:/i.test(text);
 for(const o of heads){
  const root=rootOf(o)!;
  if(o.rawText.split('\n').length!==root.ocr!.lines.length){reasons.push('edited_layout_unresolved');gaps.push({code:'edited_layout_unresolved',observationIds:[o.observationId],details:null});continue;}
  if(o.kind==='edit'&&reading(o.rawText)!==reading(root.rawText)){contradictions.push({kind:'source_reading',field:'edited_transcript',values:[root.rawText,o.rawText],refs:[]});reasons.push('source_edit_text_disagreement');}
  for(const originalId of root.derivedFromObservationIds){const originalHeads=input.observations.filter(original=>original.originalObservationId===originalId);if(originalHeads.some(original=>reading(original.rawText)!==reading(root.rawText))){contradictions.push({kind:'source_reading',field:'original_derivative',values:[...originalHeads.map(v=>v.rawText),root.rawText],refs:[]});reasons.push('source_derivative_text_disagreement');}}
  const sourceLines=lines(o),sourceRefs=sourceLines.flatMap(line=>{const r=ref(o,line.start,line.end);return r?[r]:[];});capturedText.push({observationId:o.observationId,revision:o.revision,rawText:o.rawText,sourceRefs,attributedEdit:o.kind==='edit'});
  if(root.ocr!.lines.some(l=>l.alternatives.length)){reasons.push('recognition_alternatives_unresolved');gaps.push({code:'recognition_alternatives_unresolved',observationIds:[o.observationId],details:null});}
  for(const uncertainty of o.uncertaintyReasons){reasons.push(uncertainty);gaps.push({code:uncertainty,observationIds:[o.observationId],details:null});}
  if(o.rawText.includes('\t')){reasons.push('unresolved_column_layout');gaps.push({code:'unresolved_column_layout',observationIds:[o.observationId],details:null});}
  for(let index=0;index<sourceLines.length;index++){
   const line=sourceLines[index],trimmed=line.text.trim(),fieldMatch=line.text.match(/^\s*(brand|line|form|scent|shade|spf|strength|pack count|packaging level|product name|market|for sale in|category|size|net wt\.?|net contents)\s*:\s*(.+?)\s*$/i);
   if(fieldMatch){const label=fieldMatch[1].toLowerCase(),value=fieldMatch[2],start=line.start+line.text.lastIndexOf(value),source=ref(o,start,start+value.length);
    if(label==='product name'&&source)names.push({value,ref:source});
    else if(['market','for sale in'].includes(label)&&source&&/^(US|CA|GB|AU|NZ|EU|DE|FR|ES|IT|JP|KR|CN|IN)$/i.test(value))marketValues.push({value,ref:source});
    else if(label==='category'&&source&&/^(cosmetic|drug)$/i.test(value))categoryValues.push({value:value.toLowerCase() as 'cosmetic'|'drug',ref:source});
    else if(['size','net wt.','net wt','net contents'].includes(label)){const size=value.match(/^(\d+(?:\.\d+)?)\s*(ml|g|oz|fl oz)$/i);if(size){addField('size',size[1],ref(o,start,start+size[1].length));const unitStart=start+value.toLowerCase().lastIndexOf(size[2].toLowerCase());addField('unit',size[2],ref(o,unitStart,unitStart+size[2].length));}}
    else if(label==='pack count'&&/^\d+$/.test(value)&&Number(value)>0&&Number(value)<=1000)addField('packCount',Number(value),source);
    else if(label==='packaging level'&&/^(each|case|multipack)$/i.test(value))addField('packagingLevel',value.toLowerCase(),source);
    else if(['brand','line','form','scent','shade','spf','strength'].includes(label))addField(label,value,source);
   }
   if(/^cosmetic$/i.test(trimmed)||/^drug facts\s*:?$/i.test(trimmed)){const source=ref(o,line.start+line.text.indexOf(trimmed),line.start+line.text.indexOf(trimmed)+trimmed.length);if(source)categoryValues.push({value:/^cosmetic$/i.test(trimmed)?'cosmetic':'drug',ref:source});}
   const barcode=line.text.match(/^\s*(?:(GTIN(?:-?14|-?13|-?8)?|EAN(?:-?13|-?8)?|UPC(?:-?A|-?E)?)\s*:\s*)?([\d ]{8,25})\s*$/i);
   if(barcode){const raw=barcode[2].replace(/\s/g,''),label=barcode[1]?.replace(/-/g,'').toLowerCase(),symbol=label==='upce'?'upce':raw.length===8?(label==='ean8'||label==='gtin8'?'ean8':null):raw.length===12?'upca':raw.length===13?'ean13':raw.length===14?'gtin14':null;
    if(symbol){const code={raw,symbology:symbol,namespace:'gtin' as const,retailerId:null},normalizedCode=normalizeBarcode(code),at=line.start+line.text.indexOf(barcode[2]),source=ref(o,at,at+barcode[2].length);if(normalizedCode.supported&&normalizedCode.canonicalGtin14&&source)codes.push({code,canonical:normalizedCode.canonicalGtin14,ref:source});else reasons.push('package_code_unusable');}else reasons.push('package_code_symbology_unknown');
   }
   const header=sectionHeader(line.text);if(!header||o.role!=='ingredients')continue;
   const kind=header[1].toLowerCase()==='active ingredients'?'active':header[1].toLowerCase()==='inactive ingredients'?'inactive':header[1].toLowerCase()==='may contain'?'may_contain':'ingredients';
   let next=index+1;while(next<sourceLines.length&&!sectionHeader(sourceLines[next].text)&&!otherHeader(sourceLines[next].text))next++;
   let start=line.start+header[0].length,end=next<sourceLines.length?sourceLines[next].start:o.rawText.length;while(start<end&&/\s/.test(o.rawText[start]))start++;while(end>start&&/\s/.test(o.rawText[end-1]))end--;
   const headerRef=ref(o,line.start,line.start+header[0].trimEnd().length),endRef=next<sourceLines.length?ref(o,sourceLines[next].start,sourceLines[next].end):null;
   if(start>=end){reasons.push('empty_ingredient_section');continue;}
   const lineRefs=sourceLines.flatMap(sourceLine=>{const a=Math.max(start,sourceLine.start),b=Math.min(end,sourceLine.end),r=ref(o,a,b);return r?[r]:[];});
   const uncertainty=[...o.uncertaintyReasons,...root.ocr!.lines.some(l=>l.alternatives.length)?['recognition_alternatives_unresolved']:[],'ocr_panel_coverage_unverified',...!endRef?['section_tail_not_observed']:[],...o.rawText.includes('\t')?['unresolved_column_layout']:[]];
   sections.push({kind,observationId:o.observationId,revision:o.revision,start,end,startCovered:!!headerRef,endCovered:!!endRef,lineCoverageComplete:false,lineRefs,headerRefs:headerRef?[headerRef]:[],endRefs:endRef?[endRef]:[],uncertaintyReasons:uncertainty});
   if(!endRef){reasons.push('section_tail_not_observed');gaps.push({code:'section_tail_not_observed',observationIds:[o.observationId],details:null});}
  }
 }
 const variant=unknownVariant(),variantRefs:CapturedSourceCandidate['variantRefs']={};
 for(const [field,assertions]of fields){variantRefs[field]=assertions.map(a=>a.ref);const values=unique(assertions.map(a=>normalized(a.value)));if(values.length>1)contradictions.push({kind:'variant',field,values:assertions.map(a=>String(a.value)),refs:assertions.map(a=>a.ref)});else Object.assign(variant,{[field]:assertions[0].value});}
 const canonicalCodes=unique(codes.map(c=>c.canonical));if(canonicalCodes.length>1)contradictions.push({kind:'barcode',field:'gtin',values:canonicalCodes,refs:codes.map(c=>c.ref)});
 const marketSet=unique(marketValues.map(m=>normalized(m.value))),categorySet=unique(categoryValues.map(c=>c.value));
 if(marketSet.length>1)contradictions.push({kind:'market',field:'market',values:marketValues.map(m=>m.value),refs:marketValues.map(m=>m.ref)});
 if(categorySet.length>1)contradictions.push({kind:'category',field:'category',values:categorySet,refs:categoryValues.map(c=>c.ref)});
 const packageIdentity=canonicalCodes.length===1?{code:codes[0].code,canonicalGtin14:canonicalCodes[0],evidenceRefs:codes.filter(c=>c.canonical===canonicalCodes[0]).map(c=>c.ref)}:null,packageMarket=marketSet.length===1?marketValues[0].value:null,category=categorySet.length===1?categorySet[0]:'unknown';
 if(!sections.length)reasons.push('ingredient_header_not_observed');if(!packageIdentity)reasons.push('package_barcode_unknown');if(!packageMarket)reasons.push('package_market_unknown');if(category==='unknown')reasons.push('package_category_unknown');if(Object.values(variant).some(v=>v===null))reasons.push('package_variant_incomplete');
 let association:CapturedSourceCandidate['association']=packageIdentity?'candidate':'unknown';
 if(input.result.packageConfirmation==='conflict'||input.item?.conflictIds.length)contradictions.push({kind:'selection',field:'selected_package',values:['selected_identity_conflict'],refs:[]});
 if(input.item){
  if(packageIdentity&&!input.item.barcodeAssertions.some(a=>a.namespace==='gtin'&&a.canonical===packageIdentity.canonicalGtin14))contradictions.push({kind:'barcode',field:'selected_gtin',values:[packageIdentity.canonicalGtin14,...input.item.barcodeAssertions.map(a=>a.canonical)],refs:packageIdentity.evidenceRefs});
  for(const field of compareVariant(input.item.variant,variant).contradictions)contradictions.push({kind:'variant',field,values:[String(input.item.variant[field as keyof Variant]),String(variant[field as keyof Variant])],refs:variantRefs[field]??[]});
  if(input.item.packageMarket&&packageMarket&&normalized(input.item.packageMarket)!==normalized(packageMarket))contradictions.push({kind:'market',field:'selected_market',values:[input.item.packageMarket,packageMarket],refs:marketValues.map(m=>m.ref)});
  if(packageIdentity&&input.result.identity==='exact'&&!contradictions.length){const codeAssets=new Set(packageIdentity.evidenceRefs.map(r=>r.assetEvidenceId));association=sections.length&&sections.every(s=>s.lineRefs.length&&s.lineRefs.every(r=>codeAssets.has(r.assetEvidenceId)))?'barcode_matches_catalog_same_asset':'barcode_matches_catalog_unlinked_assets';if(association==='barcode_matches_catalog_unlinked_assets')reasons.push('same_package_photo_link_unestablished');}
 }
 if(contradictions.length){association='contradiction';reasons.push('captured_source_contradiction');}
 const observationBindings=await Promise.all(all.map(async o=>({observationId:o.observationId,revision:o.revision,...await hashPrivateObservation(o,ports.hash),current:input.observations.some(current=>current.observationId===o.observationId)})));
 const candidateId=await derivedId(JSON.stringify([CAPTURED_SOURCE_EXTRACTOR_VERSION,input.ownerId,input.capture.captureSessionId,input.capture.packageObservationId,input.capture.generation,input.capture.deletionEpoch,input.ids.declarationId,observationBindings]),ports);
 const parsedSections:GenericCapturedSourceOutcome['facts']['sections']=[];
 for(let index=0;index<sections.length;index++){const s=sections[index],o=heads.find(o=>o.observationId===s.observationId)!,sectionId=await derivedId(`${candidateId}:section:${index}`,ports),probe=parseDeclarationSection({sectionId,observationId:o.observationId,imageId:o.assetEvidenceIds[0],sourceRevision:o.revision,rawText:o.rawText.slice(s.start,s.end),sourceOffset:s.start,kind:s.kind,startCovered:s.startCovered,endCovered:s.endCovered,lineCoverageComplete:false,uncertaintyReasons:s.uncertaintyReasons.filter(reason=>!['ocr_panel_coverage_unverified','section_tail_not_observed','recognition_alternatives_unresolved'].includes(reason)),entryId:()=>sectionId}),entryIds=await Promise.all(probe.entries.map((_,n)=>derivedId(`${sectionId}:entry:${n}`,ports)));probe.entries.forEach((entry,n)=>{entry.entryId=entryIds[n];const entryStart=entry.sourceSpans[0].start!,entryEnd=entry.sourceSpans[0].end!;if(lines(o).some((line,index)=>line.start<entryEnd&&line.end>entryStart&&rootOf(o)!.ocr!.lines[index].alternatives.length))entry.uncertaintyReasons.push('recognition_alternatives_unresolved');entry.sourceSpans=entry.sourceSpans.flatMap(span=>s.lineRefs.flatMap(line=>{const start=Math.max(span.start!,line.start),end=Math.min(span.end!,line.end);return start<end?[{...span,start,end,region:[...line.region],transformation:span.transformation.filter(t=>t.sourceStart>=start&&t.sourceEnd<=end)}]:[];}));});parsedSections.push(probe);}
 const expiry=Math.min(Date.parse(input.now)+86400000,...input.assets.map(a=>Date.parse(a.expiresAt)),...all.map(o=>Date.parse(o.expiresAt)),...input.policy.expiresAt?[Date.parse(input.policy.expiresAt)]:[]);
 const candidate:CapturedSourceCandidate={schemaVersion:1,sourceKind:'captured_label_extractor',extractorVersion:CAPTURED_SOURCE_EXTRACTOR_VERSION,candidateId,ownerId:input.ownerId,captureSessionId:input.capture.captureSessionId,packageObservationId:input.capture.packageObservationId,generation:input.capture.generation,deletionEpoch:input.capture.deletionEpoch,captureRevision:input.capture.captureRevision,resultRevision:input.result.resultRevision,selectedItemId:input.item?.itemId??null,selectedSnapshotId:input.item?.snapshotId??null,targetSnapshotId:input.item?input.ids.snapshotId:null,targetDeclarationId:input.ids.declarationId,observedAt:new Date(Math.min(...all.map(o=>Date.parse(o.observedAt)))).toISOString(),expiresAt:new Date(expiry).toISOString(),assetBindings:input.assets.map(a=>({evidenceId:a.evidenceId,attestationId:a.attestationId,storageObjectId:a.storageObjectId,contentHash:a.contentHash,objectVersion:a.objectVersion})),observationBindings,packageIdentity,name:names.length===1?{value:names[0].value,refs:[names[0].ref]}:null,variant,variantRefs,category,categoryRefs:categoryValues.map(c=>c.ref),packageMarket,marketRefs:marketValues.map(m=>m.ref),sections,gaps,contradictions,association,reasonCodes:unique(reasons)};
 return frozen(GenericCapturedSourceOutcomeSchema.parse({schemaVersion:1,sourceKind:'captured_label_extractor',state:contradictions.length?'conflict':'partial',candidate,facts:{sections:parsedSections,capturedText},reasonCodes:candidate.reasonCodes,absenceClaimsAllowed:false,catalogVerified:false,acceptanceEligible:false}));
}
