import type {ContextProductReference} from '../../contracts/PersonalContext.ts';
import type {CatalogProductDetail} from '../../contracts/ProductCatalog.ts';
import {catalogReferenceKey} from '../p0b-personalization/storageAdapter.ts';
/** Optional current display names. This cannot establish candidate/formula authority. */
export async function catalogReferenceLabels(references:ContextProductReference[],guard:()=>void,detail:(productId:string)=>Promise<CatalogProductDetail>):Promise<Record<string,string>> {
 guard();
 const catalog=references.filter((r):r is Extract<ContextProductReference,{kind:'catalog'}>=>r.kind==='catalog');
 const ids=[...new Set(catalog.map(r=>r.productId))].slice(0,50);
 const settled=await Promise.allSettled(ids.map(id=>detail(id)));guard();
 const labels:Record<string,string>={};
 for(const ref of catalog){const result=settled[ids.indexOf(ref.productId)];if(!result||result.status!=='fulfilled'||result.value.productId!==ref.productId)continue;const p=result.value,v=ref.variantId?p.variants.find(v=>v.variantId===ref.variantId):null;labels[catalogReferenceKey(ref)]='Current name: '+[p.brand,p.name,v?.name,v?.packageSize,ref.variantId&&!v?`variant name unavailable (${ref.variantId})`:null].filter(Boolean).join(' ');}
 return labels;
}
