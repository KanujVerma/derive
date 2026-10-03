import { z } from 'zod';
import { PartOneIdSchema } from './PartOne.ts';
export const PartOneSearchRequestSchema = z.strictObject({query:z.string().trim().min(2).max(80)});
export const PartOneSearchItemSchema = z.strictObject({productId:PartOneIdSchema,brand:z.string(),name:z.string().min(1),category:z.string(),imageUrl:z.url().nullable(),isCatalogStandard:z.literal(true),variantCount:z.literal(1),formulaState:z.literal('unverified'),sourceLookup:z.strictObject({barcode:z.string().regex(/^\d{8,14}$/),provider:z.literal('open_facts'),variantText:z.string(),sourceUrl:z.url(),observedAt:z.iso.datetime(),expiresAt:z.iso.datetime(),policyVersion:z.string()})});
export const PartOneSearchReplySchema=z.strictObject({items:z.array(PartOneSearchItemSchema).max(10)});
export type PartOneSearchItem=z.infer<typeof PartOneSearchItemSchema>;
