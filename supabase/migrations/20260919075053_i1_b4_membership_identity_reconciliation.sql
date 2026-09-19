-- I1-B4A: price-neutral Founding Beta membership identity.
-- Historical default `founding_beta_129` remains in 20260915_init.sql (do not rewrite).
-- This additive migration:
--   1. Fails closed if any unexpected/NULL tier exists (no silent coercion).
--   2. Backfills only founding_beta_129 -> founding_beta, preserving all other columns.
--   3. Sets future default to founding_beta, NOT NULL, CHECK (tier = 'founding_beta').
-- RLS, owner SELECT policy, Stripe column grants, and customer non-mutation are unchanged.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE tier IS NULL
       OR tier NOT IN ('founding_beta_129', 'founding_beta')
  ) THEN
    RAISE EXCEPTION 'I1-B4A: unexpected membership tier(s) require explicit founder reconciliation before identity backfill';
  END IF;
END
$$;

UPDATE public.memberships
SET tier = 'founding_beta'
WHERE tier = 'founding_beta_129';

ALTER TABLE public.memberships
  ALTER COLUMN tier SET DEFAULT 'founding_beta';

ALTER TABLE public.memberships
  ALTER COLUMN tier SET NOT NULL;

ALTER TABLE public.memberships
  ADD CONSTRAINT memberships_tier_check CHECK (tier = 'founding_beta');
