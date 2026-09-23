import { ProductCategorySchema, type Product, type ProductCategory } from '../types/schema.ts';
import type { CatalogProductSummary } from '../contracts/ProductCatalog.ts';

/** Exact brand and name identity for local Shelf deduplication. */
export function shelfProductIdentity(product: Pick<Product, 'brand' | 'name'>): string {
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  return JSON.stringify([normalize(product.brand), normalize(product.name)]);
}

/** A customer's product identity is known; chemistry and catalog status are not. */
export function buildCustomerShelfProduct(
  id: string,
  details: { brand: string; name: string; category: ProductCategory },
): Product {
  const brand = details.brand.trim();
  const name = details.name.trim();
  if (!brand) throw new Error('Product brand is required');
  if (!name) throw new Error('Product name is required');
  if (!ProductCategorySchema.safeParse(details.category).success) {
    throw new Error('Choose a product category');
  }
  return {
    id,
    brand,
    name,
    category: details.category,
    keyActives: [],
    isCatalogStandard: false,
  };
}


/** Catalog identity is sourced, while package formula and actives remain unknown. */
export function buildCatalogShelfProduct(item: CatalogProductSummary): Product {
  if (item.isCatalogStandard !== true || !ProductCategorySchema.safeParse(item.category).success) {
    throw new Error('Choose a catalog product');
  }
  return {
    id: item.productId,
    brand: item.brand,
    name: item.name,
    category: item.category as ProductCategory,
    keyActives: [],
    isCatalogStandard: true,
  };
}

/** Editing a catalog identity into another product must not retain its UUID. */
export function buildEditedShelfProduct(
  original: Product,
  details: { brand: string; name: string; category: ProductCategory },
  manualId: string,
): Product {
  const changed = shelfProductIdentity(original) !== shelfProductIdentity(details)
    || original.category !== details.category;
  if (original.isCatalogStandard && !changed) return original;
  return buildCustomerShelfProduct(original.isCatalogStandard ? manualId : original.id, details);
}
