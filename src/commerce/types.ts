/**
 * C1 Shop — Client Presentation Types
 *
 * PURPOSE: Pure client-side view models for Shop UX.
 *
 * IMPORTANT — NOT SHARED CONTRACTS:
 * These types live under src/commerce/ (Kanuj-owned) and are NOT in
 * src/contracts/ or src/domain/. They are presentation helpers only.
 *
 * PHYSICAL COMMERCE BACKEND: Deferred to C1.5 / S5 reconciliation.
 * No ProductOffer DB schema, no Stripe physical checkout, no Shopify here.
 *
 * MEMBERSHIP BILLING: Strictly S5 / Sami-owned. DO NOT touch.
 * (IDeriveService.createMembershipCheckout / createMembershipPortal / HostedMembershipSession)
 */

import type { Routine, RoutineAction, UserProduct } from '../types/schema';

// =============================================
// AUDIENCE
// Describes the current user's Shop context.
// =============================================

/**
 * ShopAudience — the three long-term audience states for Shop.
 *
 * - guest: Not authenticated. (C1.5 routing activation deferred.)
 * - non_member: Authenticated but no active Derive membership.
 * - member: Active Derive member with canonical routine context.
 */
export type ShopAudience = 'guest' | 'non_member' | 'member';

export interface ShopAudienceInput {
  remote: boolean;
  sessionUserId?: string | null;
  bootstrapUserId?: string | null;
  bootstrapMembershipStatus?: 'active' | 'paused' | 'cancelled' | 'none';
  mockUserId?: string | null;
  mockMembershipStatus?: 'active' | 'trial' | 'paused' | 'cancelled' | 'none';
}

/** Select the membership authority for the active service mode. */
export function resolveShopAudience(input: ShopAudienceInput): ShopAudience {
  if (input.remote) {
    if (!input.sessionUserId) return 'guest';
    return input.bootstrapUserId === input.sessionUserId &&
      input.bootstrapMembershipStatus === 'active' ? 'member' : 'non_member';
  }
  if (!input.mockUserId) return 'guest';
  return input.mockMembershipStatus === 'active' ? 'member' : 'non_member';
}

/** Never read hydrated member product data for a guest or inactive member. */
export function resolveShopProductContext(
  audience: ShopAudience,
  productId: string,
  routine: Routine | null,
  userProducts: UserProduct[],
) {
  if (audience !== 'member') return null;
  const userProduct = userProducts.find((up) => up.productId === productId);
  const matchingStep = [...(routine?.amSteps ?? []), ...(routine?.pmSteps ?? [])]
    .find((step) => step.productId === productId);
  if (!userProduct && !matchingStep) return null;
  return { userProduct, matchingStep };
}

// =============================================
// PURCHASE AVAILABILITY
// Presentation-only purchase state.
// No physical-commerce backend in C1.
// =============================================

/**
 * ShopPurchaseAvailability — provider-neutral purchase presentation.
 *
 * C1 only carries the concept; real fulfilment (Stripe/Shopify/external)
 * is a C1.5 decision.
 *
 * - not_applicable: PAUSE / STOP — no acquisition CTA ever shown.
 * - deferred_to_c15: Would be purchasable; awaiting commerce backend.
 * - view_replacement: REPLACE action — show "View recommended replacement" only.
 */
export type ShopPurchaseAvailability =
  | 'not_applicable'
  | 'deferred_to_c15'
  | 'view_replacement';

// =============================================
// ACTION → COMMERCE SEMANTICS
// Pure presentation mapping. Single source of truth.
// =============================================

export interface ActionCommercePresentation {
  /** Human label for the in-plan status */
  planStatusLabel: string;
  /** Whether a purchase CTA is conceptually appropriate for this action */
  acquisitionEligible: boolean;
  /** Physical availability state for C1 */
  purchaseAvailability: ShopPurchaseAvailability;
  /** True if we must never show a "Buy" CTA for the OLD product (REPLACE semantics) */
  neverSellOldProduct: boolean;
}

/**
 * resolveActionCommerceSemantics
 *
 * The single function that determines what commerce UI to show for a
 * given RoutineAction + routine publication status.
 *
 * INVARIANTS:
 * - PAUSE and STOP never get a purchase CTA.
 * - REPLACE never sells the old product; shows "View replacement" only.
 * - ADD only becomes acquisition-eligible when the routine is published.
 *   Unpublished routines may preview the recommendation, but the
 *   purchase CTA remains unavailable.
 * - KEEP implies "in your plan" — not a required immediate purchase.
 */
export function resolveActionCommerceSemantics(
  action: RoutineAction,
  routineStatus: 'draft' | 'awaiting_review' | 'approved' | 'published' | null
): ActionCommercePresentation {
  const isPublished = routineStatus === 'published';

  switch (action) {
    case 'ADD':
      return {
        planStatusLabel: 'Needed for your plan',
        acquisitionEligible: isPublished,
        purchaseAvailability: isPublished ? 'deferred_to_c15' : 'not_applicable',
        neverSellOldProduct: false,
      };

    case 'KEEP':
      return {
        planStatusLabel: 'In your plan',
        // KEEP = already owned / in use. Repurchase is optional / future refill.
        acquisitionEligible: false,
        purchaseAvailability: 'deferred_to_c15',
        neverSellOldProduct: false,
      };

    case 'PAUSE':
      return {
        planStatusLabel: 'Paused',
        acquisitionEligible: false,
        purchaseAvailability: 'not_applicable',
        neverSellOldProduct: false,
      };

    case 'STOP':
      return {
        planStatusLabel: 'Discontinued',
        acquisitionEligible: false,
        purchaseAvailability: 'not_applicable',
        neverSellOldProduct: false,
      };

    case 'REPLACE':
      return {
        planStatusLabel: 'Has recommended replacement',
        // Never sell the old product. Show replacement link only if canonical linkage exists.
        acquisitionEligible: false,
        purchaseAvailability: 'view_replacement',
        neverSellOldProduct: true,
      };
  }
}

// =============================================
// SHOP PRODUCT VIEW MODEL
// Presentation model — not a DB/commerce record.
// =============================================

/**
 * ShopProductViewModel
 *
 * Assembles everything the Shop product detail page needs for one product,
 * across guest, non-member, and member audiences.
 *
 * NOTE: retailPriceApprox is trusted catalog data only — never fabricated.
 * If absent, omit the price.
 *
 * NOTE: No Stripe/Shopify offer ID here. ProductOffer is a C1.5 concept.
 */
export interface ShopProductViewModel {
  // --- Product identity (always available) ---
  productId: string;
  brand: string;
  name: string;
  category: string;
  keyActives: string[];
  fullIngredients?: string[];
  /** Trusted approximate retail price in cents. Never fabricated. */
  retailPriceApproxCents?: number;
  imageUrl?: string;

  // --- Audience context ---
  audience: ShopAudience;

  // --- Member-only personalized context (undefined for non-member/guest) ---
  action?: RoutineAction;
  actionReason?: string;
  timing?: 'am' | 'pm';
  scheduleText?: string;
  fitVerdict?: string; // e.g., "GREAT FIT", "COULD WORK" from Scan

  // --- Commerce state (C1: always deferred_to_c15 or not_applicable) ---
  purchaseAvailability: ShopPurchaseAvailability;
  /** True only when routine is published AND action is ADD */
  acquisitionEligible: boolean;
}

// =============================================
// MEMBERSHIP PRESENTATION (display-only)
// NOT S5 billing. S5 owns HostedMembershipSession.
// =============================================

/**
 * ShopMembershipPresentation
 *
 * Pure display model for membership upsell in non-member / guest Shop.
 * Does NOT reference Stripe, S5 billing, or HostedMembershipSession.
 */
export interface ShopMembershipPresentation {
  /** $25/month display string. Sourced from config.betaPriceMonthly, not hardcoded. */
  priceDisplay: string;
  /** "Founding Beta" */
  tierLabel: string;
  valuePoints: string[];
}

// =============================================
// OPEN BUSINESS QUESTIONS (C1.5+)
// Documented as non-code architectural notes.
// =============================================

/**
 * OPEN_COMMERCE_QUESTIONS — C1.5+ decisions required before physical commerce.
 *
 * 1. Is Derive the merchant of record?
 * 2. Does Derive hold physical inventory?
 * 3. Who fulfills orders (Derive, dropship, external retailer)?
 * 4. Is there affiliate/referral revenue?
 * 5. How are taxes calculated and collected?
 * 6. Who handles shipping rates and carriers?
 * 7. What is the returns/refunds policy and owner?
 * 8. Where is price/availability authoritative (Derive DB vs Shopify vs Stripe)?
 * 9. Does a refill become one-tap repeat with saved payment?
 * 10. When does a cart (multi-item) become necessary?
 * 11. Who sets member-price/coupon eligibility rules?
 * 12. What is the margin/economics model per SKU?
 *
 * Physical-commerce provider decision: OPEN (Stripe direct, Shopify headless, or external).
 * ProductOffer schema: OPEN — to be defined in C1.5 after provider decision.
 */
export const OPEN_COMMERCE_QUESTIONS = [
  'merchant_of_record',
  'inventory_ownership',
  'fulfillment_model',
  'affiliate_revenue',
  'tax_collection',
  'shipping_model',
  'returns_policy',
  'price_authority',
  'one_tap_refill',
  'cart_necessity',
  'member_benefit_rules',
  'sku_economics',
] as const;

export type OpenCommerceQuestion = typeof OPEN_COMMERCE_QUESTIONS[number];
