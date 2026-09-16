import type {
  ProductPricingMetadata,
  ProductMonthlyConsumptionEstimate,
  MonthlyPlanPriceEstimate,
  PriceAdjustmentEvaluation,
} from './types.ts';
import { PRODUCT_PRICING_FIXTURES, DEFAULT_PRODUCT_PRICING } from './product-pricing-fixtures.ts';

/**
 * PROVISIONAL DEMO ASSUMPTIONS (SIMULATION ONLY)
 * 
 * None of these are founder-approved economics.
 * They exist solely to simulate and test the personalized plan pricing engine
 * in the client/mock layer pending co-founder review with Sami.
 * 
 * - PROVISIONAL_DEMO_MANAGEMENT_FEE_CENTS: Generic provisional software & care management fee ($39/mo).
 * - PROVISIONAL_DEMO_OPERATIONS_RISK_CENTS: Generic provisional replenishment & operations buffer ($5/mo).
 */
export const PROVISIONAL_DEMO_MANAGEMENT_FEE_CENTS = 3900; // $39/mo
export const PROVISIONAL_DEMO_OPERATIONS_RISK_CENTS = 500; // $5/mo
/** Backward-compatible alias for existing tests */
export const PROVISIONAL_OPERATIONS_RISK_CENTS = PROVISIONAL_DEMO_OPERATIONS_RISK_CENTS;

/**
 * Normalizes a single product's retail price into a 30-day monthly consumption rate.
 * Formula: Math.round(retailPriceCents * 30 / estimatedLifespanDays)
 * 
 * Explicitly distinguishes:
 * - retailPriceCents: Actual retail unit cost
 * - estimatedLifespanDays: Unit lifespan in days
 * - monthlyEquivalentCents: 30-day normalized consumption
 * - isDeriveManagedReplenishment: Whether Derive manages ongoing replenishment
 * - hasExistingInventory: Whether member already owns a bottle (affects shipment timing, not steady-state consumption)
 */
export function calculateProductMonthlyConsumption(
  product: { id: string; name: string; brand: string; isDeriveManagedReplenishment?: boolean },
  customMetadata?: ProductPricingMetadata,
  hasExistingInventory: boolean = false
): ProductMonthlyConsumptionEstimate {
  const metadata =
    customMetadata ||
    PRODUCT_PRICING_FIXTURES[product.id] ||
    findFixtureByName(product.name, product.brand) ||
    DEFAULT_PRODUCT_PRICING;

  const lifespanDays = Math.max(1, metadata.estimatedLifespanDays);
  const monthlyEquivalentCents = Math.round((metadata.retailPriceCents * 30) / lifespanDays);

  const isDeriveManagedReplenishment =
    product.isDeriveManagedReplenishment !== undefined
      ? product.isDeriveManagedReplenishment
      : (metadata.isDeriveManagedReplenishment ?? true);

  return {
    productId: product.id,
    productName: product.name,
    brand: product.brand,
    retailPriceCents: metadata.retailPriceCents,
    estimatedLifespanDays: lifespanDays,
    monthlyEquivalentCents,
    isDeriveManagedReplenishment,
    hasExistingInventory,
    isCoveredByExistingShelf: hasExistingInventory,
  };
}

/**
 * Calculates the total personalized monthly plan price for a set of active routine products.
 * 
 * Only products where Derive is responsible for ongoing replenishment contribute to the
 * steady-state monthly product consumption.
 */
export function calculateMonthlyPlanPrice(
  activeProducts: Array<{ id: string; name: string; brand: string; isDeriveManagedReplenishment?: boolean }>,
  options?: {
    customCatalog?: Record<string, ProductPricingMetadata>;
    existingInventoryProductIds?: Set<string>;
    existingShelfProductIds?: Set<string>;
    managementFeeCents?: number;
    operationsRiskCents?: number;
  }
): MonthlyPlanPriceEstimate {
  const managementFeeCents =
    options?.managementFeeCents ?? PROVISIONAL_DEMO_MANAGEMENT_FEE_CENTS;
  const operationsRiskCents =
    options?.operationsRiskCents ?? PROVISIONAL_DEMO_OPERATIONS_RISK_CENTS;

  const catalog = options?.customCatalog || PRODUCT_PRICING_FIXTURES;
  const existingInventory =
    options?.existingInventoryProductIds ||
    options?.existingShelfProductIds ||
    new Set<string>();

  // Deduplicate products by ID or brand+name
  const seen = new Set<string>();
  const uniqueProducts = activeProducts.filter((p) => {
    const key = p.id || `${p.brand}:${p.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const productBreakdown = uniqueProducts.map((p) => {
    const hasInventory = existingInventory.has(p.id);
    const meta = catalog[p.id] || findFixtureByName(p.name, p.brand) || DEFAULT_PRODUCT_PRICING;
    return calculateProductMonthlyConsumption(p, meta, hasInventory);
  });

  // Only products where Derive manages replenishment contribute to steady-state monthly consumption
  const productConsumptionCents = productBreakdown
    .filter((item) => item.isDeriveManagedReplenishment)
    .reduce((sum, item) => sum + item.monthlyEquivalentCents, 0);

  const monthlyTotalCents =
    managementFeeCents + productConsumptionCents + operationsRiskCents;

  return {
    managementFeeCents,
    productConsumptionCents,
    operationsRiskCents,
    monthlyTotalCents,
    productBreakdown,
  };
}

/**
 * Helper to match fixture pricing by brand or name substring if ID doesn't match directly.
 */
function findFixtureByName(name: string, brand: string): ProductPricingMetadata | undefined {
  const lowerName = name.toLowerCase();
  const lowerBrand = brand.toLowerCase();

  for (const [id, meta] of Object.entries(PRODUCT_PRICING_FIXTURES)) {
    if (id === 'p1' && (lowerName.includes('cerave') || lowerBrand.includes('cerave'))) return meta;
    if (id === 'p2' && (lowerName.includes('differin') || lowerName.includes('adapalene'))) return meta;
    if ((id === 'p3' || id === 'p4') && (lowerName.includes('toleriane') || lowerName.includes('double repair'))) return meta;
    if (id === 'p5' && (lowerName.includes('relief sun') || lowerName.includes('joseon'))) return meta;
    if (id === 'p_anthelios' && (lowerName.includes('anthelios') || lowerName.includes('melt-in'))) return meta;
    if (id === 'p_bha' && (lowerName.includes('bha') || lowerName.includes('paula'))) return meta;
    if (id === 'p_vanicream' && (lowerName.includes('vanicream') || lowerBrand.includes('vanicream'))) return meta;
  }
  return undefined;
}

/**
 * Evaluates price stability and whether a routine adjustment requires explicit member approval.
 * Rule: Any price increase requires explicit member approval.
 */
export function evaluatePriceAdjustment(
  currentMonthlyPriceCents: number,
  proposedMonthlyPriceCents: number
): PriceAdjustmentEvaluation {
  const priceDeltaCents = proposedMonthlyPriceCents - currentMonthlyPriceCents;
  const requiresMemberApproval = priceDeltaCents > 0;

  let explanation: string;
  if (priceDeltaCents > 0) {
    const diff = formatCentsToDollars(priceDeltaCents);
    explanation = `Proposed routine adjustment increases your plan by ${diff}/mo. Member confirmation required.`;
  } else if (priceDeltaCents < 0) {
    const diff = formatCentsToDollars(Math.abs(priceDeltaCents));
    explanation = `Proposed routine adjustment lowers your plan by ${diff}/mo.`;
  } else {
    explanation = 'No change in monthly plan price.';
  }

  return {
    currentMonthlyPriceCents,
    proposedMonthlyPriceCents,
    priceDeltaCents,
    requiresMemberApproval,
    explanation,
  };
}

/**
 * Formats integer cents into standard USD string (e.g. 7800 -> "$78", 7850 -> "$78.50").
 */
export function formatCentsToDollars(cents: number): string {
  const dollars = cents / 100;
  if (cents % 100 === 0) {
    return `$${dollars.toFixed(0)}`;
  }
  return `$${dollars.toFixed(2)}`;
}
