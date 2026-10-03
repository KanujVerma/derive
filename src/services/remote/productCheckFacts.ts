import type { ProductCheckFactsV1 } from '../../contracts/ProductCheckFacts.ts';
import { describeProductCheckFacts } from '../../presentation/product-check-facts/format.ts';
import { supabase } from '../supabase.ts';

type FactsClient = { functions: { invoke: (name:string, options:{body:object})=>Promise<{data:unknown;error:unknown}> } };

/** Call for the exact case/snapshot returned by resolve-product-identity.
 * The Edge function authenticates the owner and freezes the first response.
 */
export async function loadProductCheckFacts(caseId:string,snapshotId:string,
  client:FactsClient|null=supabase as FactsClient|null):Promise<ProductCheckFactsV1>{
  if(!client)throw new Error('Product facts are unavailable');
  const {data,error}=await client.functions.invoke('product-check-facts',{body:{caseId,snapshotId}});
  if(error||!data||typeof data!=='object'||Array.isArray(data)||!('facts' in data))throw new Error('Product facts are unavailable');
  const packet=data.facts;
  if(!describeProductCheckFacts(packet,{caseId,snapshotId}))throw new Error('Product facts are unavailable');
  return packet as ProductCheckFactsV1;
}
