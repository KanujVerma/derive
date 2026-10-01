import { isValidGtin } from '../../../supabase/functions/_shared/product-identity.ts';
import type { ProductIngredientQuery } from '../../contracts/ProductIngredientLookup.ts';

/** Ordinary navigation only. P&G has not granted API/ingredient reuse rights. */
export function manufacturerIngredientPage(query: ProductIngredientQuery): string | null {
  if (query.brand?.trim().toLowerCase() !== 'old spice' || !isValidGtin(query.barcode)) return null;
  return `https://smartlabel.pg.com/${query.barcode.padStart(14, '0')}.html`;
}
