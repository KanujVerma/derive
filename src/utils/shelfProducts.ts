import { ProductCategorySchema, type Product, type ProductCategory } from '../types/schema.ts';

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
