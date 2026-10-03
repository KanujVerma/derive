import { z } from 'zod';
import type { ProductCheckFactCode, ProductCheckFactsV1 } from '../../contracts/ProductCheckFacts.ts';

const id = z.string().uuid();
const basis = z.discriminatedUnion('kind', [
  z.strictObject({ kind:z.literal('catalog_category'), sourceId:id, sourceRevision:z.string().regex(/^[0-9a-f]{64}$/) }),
  z.strictObject({ kind:z.literal('verified_package_formula'), sourceId:id,
    observedAt:z.iso.datetime({offset:true}), publicSourceUrl:z.string().url().nullable() }),
  z.strictObject({ kind:z.literal('submitted_label'), evidenceId:id, extraction:z.enum(['member_input','trusted_ocr']) }),
  z.strictObject({ kind:z.literal('submitted_ingredients'), evidenceId:id, extraction:z.enum(['member_input','trusted_ocr']) }),
]);
const fact = z.strictObject({
  code:z.enum(['catalog_category','verified_ingredients','observed_ingredients','deodorant_statement',
    'antiperspirant_statement','shampoo_statement','conditioner_statement','body_wash_statement',
    'body_moisturizer_statement','spf_statement','broad_spectrum_statement',
    'water_resistance_statement','drug_facts_statement']),
  value:z.union([z.string().min(1).max(120),z.array(z.string().min(1).max(300)).min(1).max(300)]),
  basis, certainty:z.enum(['accepted','observed_unverified']),
});
const schema: z.ZodType<ProductCheckFactsV1> = z.strictObject({
  schemaVersion:z.literal('product-check-facts/v1'),caseId:id,snapshotId:id,
  caseRevision:z.number().int().positive(),createdAt:z.iso.datetime({offset:true}),
  category:z.enum(['cleanser','toner','treatment','serum','moisturizer','sunscreen','oil','mask',
    'deodorant','body_care','hair_care','other','unknown']),
  facts:z.array(fact).max(30),
  missing:z.array(z.enum(['identity','ingredient_list','readable_label','drug_facts','conflicting_spf'])).max(5),
  nextEvidence:z.enum(['none','front_label','ingredients','drug_facts']),
});

export interface ProductCheckFactsView {
  title: string;
  cards: Array<{ text: string; sourceLabel: string; ingredients?: string[] }>;
  nextEvidence: ProductCheckFactsV1['nextEvidence'];
  missing: ProductCheckFactsV1['missing'];
}

const categoryCopy: Record<Exclude<ProductCheckFactsV1['category'],'unknown'>,string> = {
  cleanser:'cleanser',toner:'toner',treatment:'treatment',serum:'serum',moisturizer:'moisturizer',
  sunscreen:'sunscreen',oil:'oil',mask:'mask',deodorant:'deodorant',body_care:'body-care product',
  hair_care:'hair-care product',other:'personal-care product',
};
const statementCopy: Partial<Record<ProductCheckFactCode,string>> = {
  deodorant_statement:'The supplied label says deodorant.',
  antiperspirant_statement:'The supplied label says antiperspirant.',
  shampoo_statement:'The supplied label says shampoo.',
  conditioner_statement:'The supplied label says conditioner.',
  body_wash_statement:'The supplied label says body wash.',
  body_moisturizer_statement:'The supplied label says body moisturizer.',
  broad_spectrum_statement:'The supplied label says broad spectrum.',
  drug_facts_statement:'A Drug Facts heading appears in the supplied label text.',
};
const statementValue: Partial<Record<ProductCheckFactCode,string>> = {
  deodorant_statement:'deodorant',antiperspirant_statement:'antiperspirant',
  shampoo_statement:'shampoo',conditioner_statement:'conditioner',
  body_wash_statement:'body wash',body_moisturizer_statement:'body moisturizer',
  broad_spectrum_statement:'broad spectrum',drug_facts_statement:'Drug Facts heading observed',
};

/** Reject mismatched/forged transport before fixed-copy rendering. This does
 * not replace server Auth, provenance, or independent scientific review.
 */
export function describeProductCheckFacts(value: unknown, expected: {caseId:string;snapshotId:string}): ProductCheckFactsView | null {
  const parsed=schema.safeParse(value);
  if(!parsed.success)return null;
  const packet=parsed.data;
  if(packet.caseId!==expected.caseId||packet.snapshotId!==expected.snapshotId)return null;
  const cards:ProductCheckFactsView['cards']=[];
  for(const item of packet.facts){
    const accepted=item.certainty==='accepted';
    if(accepted !== ['catalog_category','verified_package_formula'].includes(item.basis.kind))return null;
    if(item.code==='catalog_category'){
      if(item.basis.kind!=='catalog_category'||typeof item.value!=='string'||item.value!==packet.category||packet.category==='unknown')return null;
      cards.push({text:`The reviewed catalog classifies this as a ${categoryCopy[packet.category]}.`,sourceLabel:'Reviewed catalog category'});
    }else if(item.code==='verified_ingredients'){
      if(item.basis.kind!=='verified_package_formula'||!Array.isArray(item.value))return null;
      cards.push({text:'The matched package formula lists these ingredients.',sourceLabel:'Verified package formula',ingredients:item.value});
    }else if(item.code==='observed_ingredients'){
      if(item.basis.kind!=='submitted_ingredients'||!Array.isArray(item.value))return null;
      cards.push({text:'Your submitted text includes these ingredient names. The list may be incomplete.',sourceLabel:'Submitted ingredient text',ingredients:item.value});
    }else{
      if(item.basis.kind!=='submitted_label'||typeof item.value!=='string')return null;
      if (item.code in statementValue && item.value !== statementValue[item.code]) return null;
      const spf=Number(item.value);
      const text=item.code==='spf_statement'&&/^\d{1,3}$/.test(item.value)&&spf>=1&&spf<=200
        ? `The supplied label text says SPF ${item.value}. Check the package Drug Facts for the complete directions.`
        : item.code==='water_resistance_statement'&&/^(40|80) minutes$/.test(item.value)
          ? `The supplied label text says water resistant (${item.value}). Check the package directions.`
          : item.code==='water_resistance_statement'&&item.value==='duration not transcribed'
            ? 'The supplied label text mentions water resistance, but no duration was captured.'
            : statementCopy[item.code];
      if(!text)return null;
      cards.push({text,sourceLabel:'Submitted label text'});
    }
  }
  return {title:'What we found',cards,nextEvidence:packet.nextEvidence,missing:packet.missing};
}
