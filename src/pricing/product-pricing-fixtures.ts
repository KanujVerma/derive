import type { ProductPricingMetadata } from './types.ts';

/**
 * Fixture catalog mapping product IDs / names to retail prices and unit lifespans.
 * In production, this data comes from the verified SKU catalog in Supabase.
 * 
 * Each fixture defines:
 * - retailPriceCents: Actual retail unit cost
 * - estimatedLifespanDays: Expected days of usage per unit
 * - isDeriveManagedReplenishment: Whether Derive manages ongoing replenishment of this product
 */
export const PRODUCT_PRICING_FIXTURES: Record<string, ProductPricingMetadata> = {
  p1: {
    productId: 'p1',
    retailPriceCents: 1600, // $16.00 retail
    estimatedLifespanDays: 60, // 60 days -> $8.00/mo normalized
    isDeriveManagedReplenishment: true,
    isManagedRefillAvailable: true,
  },
  p2: {
    productId: 'p2',
    retailPriceCents: 1500, // $15.00 retail
    estimatedLifespanDays: 45, // 45 days -> $10.00/mo normalized
    isDeriveManagedReplenishment: true,
    isManagedRefillAvailable: true,
  },
  p3: {
    productId: 'p3',
    retailPriceCents: 2400, // $24.00 retail
    estimatedLifespanDays: 45,
    isDeriveManagedReplenishment: false, // Paused product not replenished by Derive
    isManagedRefillAvailable: false,
  },
  p4: {
    productId: 'p4',
    retailPriceCents: 2400, // $24.00 retail
    estimatedLifespanDays: 45, // 45 days -> $16.00/mo normalized
    isDeriveManagedReplenishment: true,
    isManagedRefillAvailable: true,
  },
  p5: {
    productId: 'p5',
    retailPriceCents: 1800, // $18.00 retail
    estimatedLifespanDays: 30, // 30 days -> $18.00/mo normalized
    isDeriveManagedReplenishment: true,
    isManagedRefillAvailable: true,
  },
  p_anthelios: {
    productId: 'p_anthelios',
    retailPriceCents: 2600,
    estimatedLifespanDays: 45,
    isDeriveManagedReplenishment: true,
    isManagedRefillAvailable: true,
  },
  p_bha: {
    productId: 'p_bha',
    retailPriceCents: 3500,
    estimatedLifespanDays: 75,
    isDeriveManagedReplenishment: true,
    isManagedRefillAvailable: true,
  },
  p_vanicream: {
    productId: 'p_vanicream',
    retailPriceCents: 900,
    estimatedLifespanDays: 60,
    isDeriveManagedReplenishment: true,
    isManagedRefillAvailable: true,
  },
};

/**
 * Fallback pricing metadata when a product is recognized or custom-entered
 * but not yet cataloged with explicit unit lifespans.
 */
export const DEFAULT_PRODUCT_PRICING: ProductPricingMetadata = {
  productId: 'default',
  retailPriceCents: 2000, // $20.00
  estimatedLifespanDays: 45, // 45 days -> $13.33/mo
  isDeriveManagedReplenishment: true,
  isManagedRefillAvailable: true,
};

