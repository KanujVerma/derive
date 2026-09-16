/**
 * Pricing Prototype Types (Provisional / Simulation Only)
 * 
 * ECONOMIC CONCEPTS EXPLICITLY DISTINGUISHED:
 * A. Steady-State Monthly Product Consumption: Expected normalized cost of products over time.
 * B. Current Inventory / Next Shipment Timing: Existing bottles affect shipment timing, not steady-state consumption.
 * C. Initial Fulfillment Cost: Cash spent near activation to fill missing/replacement products (open decision).
 */

export interface ProductPricingMetadata {
  productId: string;
  retailPriceCents: number;
  estimatedLifespanDays: number;
  /** Whether Derive is responsible for ongoing replenishment of this product */
  isDeriveManagedReplenishment?: boolean;
  /** Backward-compatible alias */
  isManagedRefillAvailable?: boolean;
}

export interface ProductMonthlyConsumptionEstimate {
  productId: string;
  productName: string;
  brand: string;
  retailPriceCents: number;
  estimatedLifespanDays: number;
  monthlyEquivalentCents: number;
  /** True if Derive replenishes this product as part of the ongoing plan */
  isDeriveManagedReplenishment: boolean;
  /** Current member inventory affects shipment timing, not long-run steady-state consumption */
  hasExistingInventory?: boolean;
  /** Backward-compatible alias */
  isCoveredByExistingShelf?: boolean;
}

export interface MonthlyPlanPriceEstimate {
  managementFeeCents: number;
  productConsumptionCents: number;
  operationsRiskCents: number;
  monthlyTotalCents: number;
  productBreakdown: ProductMonthlyConsumptionEstimate[];
}

export interface PriceAdjustmentEvaluation {
  currentMonthlyPriceCents: number;
  proposedMonthlyPriceCents: number;
  priceDeltaCents: number;
  requiresMemberApproval: boolean;
  explanation: string;
}
