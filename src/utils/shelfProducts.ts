import { ProductCategorySchema, type Product, type ProductCategory } from '../types/schema.ts';

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
