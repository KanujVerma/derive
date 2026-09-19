-- ============================================================================
-- Derive S5: Stripe-owned Founding Beta membership lifecycle
--
-- Stripe is the money ledger. Postgres stores only the minimum billing identity
-- and lifecycle projection required to authorize the Derive product. This is an
-- additive migration; historical membership rows are preserved.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE stripe_customer_id IS NOT NULL
    GROUP BY stripe_customer_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'S5: duplicate Stripe customer ids require explicit reconciliation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE stripe_subscription_id IS NOT NULL
    GROUP BY stripe_subscription_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'S5: duplicate Stripe subscription ids require explicit reconciliation';
  END IF;
END
$$;

ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS stripe_price_id text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_status text,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_stripe_event_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.memberships
  DROP CONSTRAINT IF EXISTS memberships_stripe_subscription_status_check;

ALTER TABLE public.memberships
  ADD CONSTRAINT memberships_stripe_subscription_status_check CHECK (
    stripe_subscription_status IS NULL
    OR stripe_subscription_status IN (
      'incomplete',
      'incomplete_expired',
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'paused'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS memberships_stripe_customer_unique_idx
  ON public.memberships (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS memberships_stripe_subscription_unique_idx
  ON public.memberships (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS memberships_user_current_idx
  ON public.memberships (user_id, last_stripe_event_created_at DESC NULLS LAST, created_at DESC);

DROP TRIGGER IF EXISTS memberships_set_updated_at ON public.memberships;
CREATE TRIGGER memberships_set_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION private.set_updated_at();

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  event_created_at timestamptz NOT NULL,
  membership_id uuid REFERENCES public.memberships(id) ON DELETE SET NULL,
  outcome text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stripe_webhook_events_event_id_check
    CHECK (event_id ~ '^evt_[A-Za-z0-9_]+$'),
  CONSTRAINT stripe_webhook_events_event_type_check
    CHECK (length(event_type) BETWEEN 1 AND 120),
  CONSTRAINT stripe_webhook_events_outcome_check
    CHECK (outcome IN ('applied', 'ignored_stale'))
);

ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.stripe_webhook_events FROM public, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.stripe_webhook_events TO service_role;

-- Apply one already-signature-verified Stripe event atomically. The webhook
-- handler may provide a user UUID from server-authored Stripe metadata. If that
-- is unavailable, an existing Stripe binding is preferred and normalized email
-- is the final compatibility fallback required for the Founding Beta migration.
CREATE OR REPLACE FUNCTION public.apply_stripe_membership_event(
  p_event_id text,
  p_event_type text,
  p_event_created_at timestamptz,
  p_user_id uuid DEFAULT NULL,
  p_customer_email text DEFAULT NULL,
  p_stripe_customer_id text DEFAULT NULL,
  p_stripe_subscription_id text DEFAULT NULL,
  p_stripe_subscription_status text DEFAULT NULL,
  p_stripe_price_id text DEFAULT NULL,
  p_cancel_at_period_end boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := p_user_id;
  v_bound_user_id uuid;
  v_customer_user_id uuid;
  v_email_user_id uuid;
  v_email_matches integer;
  v_membership public.memberships%ROWTYPE;
  v_canonical_status text;
  v_existing_result jsonb;
BEGIN
  IF current_user <> 'service_role' AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'S5_SERVICE_ROLE_REQUIRED';
  END IF;

  IF p_event_id IS NULL OR p_event_id !~ '^evt_[A-Za-z0-9_]+$'
     OR p_event_type IS NULL OR length(p_event_type) NOT BETWEEN 1 AND 120
     OR p_event_created_at IS NULL THEN
    RAISE EXCEPTION 'S5_INVALID_EVENT';
  END IF;

  IF p_stripe_customer_id IS NOT NULL AND p_stripe_customer_id !~ '^cus_[A-Za-z0-9_]+$' THEN
    RAISE EXCEPTION 'S5_INVALID_CUSTOMER_ID';
  END IF;
  IF p_stripe_subscription_id IS NOT NULL AND p_stripe_subscription_id !~ '^sub_[A-Za-z0-9_]+$' THEN
    RAISE EXCEPTION 'S5_INVALID_SUBSCRIPTION_ID';
  END IF;
  IF p_stripe_price_id IS NOT NULL AND p_stripe_price_id !~ '^price_[A-Za-z0-9_]+$' THEN
    RAISE EXCEPTION 'S5_INVALID_PRICE_ID';
  END IF;
  IF p_stripe_subscription_status IS NULL OR p_stripe_subscription_status NOT IN (
    'incomplete', 'incomplete_expired', 'trialing', 'active',
    'past_due', 'canceled', 'unpaid', 'paused'
  ) THEN
    RAISE EXCEPTION 'S5_INVALID_SUBSCRIPTION_STATUS';
  END IF;

  -- Serialize duplicate delivery and retry races before reading the ledger.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_event_id, 0));

  SELECT jsonb_build_object(
    'applied', outcome = 'applied',
    'duplicate', true,
    'membershipId', membership_id,
    'status', NULL
  )
  INTO v_existing_result
  FROM public.stripe_webhook_events
  WHERE event_id = p_event_id;

  IF v_existing_result IS NOT NULL THEN
    RETURN v_existing_result;
  END IF;

  -- Existing immutable Stripe bindings outrank mutable email.
  IF p_stripe_subscription_id IS NOT NULL THEN
    SELECT user_id INTO v_bound_user_id
    FROM public.memberships
    WHERE stripe_subscription_id = p_stripe_subscription_id;
  END IF;

  IF p_stripe_customer_id IS NOT NULL THEN
    IF v_bound_user_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.memberships
      WHERE stripe_customer_id = p_stripe_customer_id
        AND user_id <> v_bound_user_id
    ) THEN
      RAISE EXCEPTION 'S5_STRIPE_IDENTITY_CONFLICT';
    END IF;

    SELECT user_id INTO v_customer_user_id
    FROM public.memberships
    WHERE stripe_customer_id = p_stripe_customer_id;

    v_bound_user_id := COALESCE(v_bound_user_id, v_customer_user_id);
  END IF;

  IF v_user_id IS NOT NULL AND v_bound_user_id IS NOT NULL AND v_user_id <> v_bound_user_id THEN
    RAISE EXCEPTION 'S5_STRIPE_IDENTITY_CONFLICT';
  END IF;
  v_user_id := COALESCE(v_user_id, v_bound_user_id);

  IF v_user_id IS NULL AND NULLIF(lower(trim(p_customer_email)), '') IS NOT NULL THEN
    SELECT count(*)
    INTO v_email_matches
    FROM public.profiles
    WHERE lower(email) = lower(trim(p_customer_email));

    IF v_email_matches > 1 THEN
      RAISE EXCEPTION 'S5_AMBIGUOUS_CUSTOMER_EMAIL';
    END IF;
    IF v_email_matches = 1 THEN
      SELECT id INTO v_email_user_id
      FROM public.profiles
      WHERE lower(email) = lower(trim(p_customer_email));
    END IF;
    v_user_id := v_email_user_id;
  END IF;

  IF v_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_user_id
  ) THEN
    RAISE EXCEPTION 'S5_MEMBER_NOT_FOUND';
  END IF;

  SELECT * INTO v_membership
  FROM public.memberships
  WHERE user_id = v_user_id
  ORDER BY last_stripe_event_created_at DESC NULLS LAST, created_at DESC
  LIMIT 1
  FOR UPDATE;

  v_canonical_status := CASE
    WHEN p_stripe_subscription_status IN ('active', 'trialing') THEN 'active'
    WHEN p_stripe_subscription_status IN ('canceled', 'incomplete_expired') THEN 'cancelled'
    ELSE 'paused'
  END;

  IF v_membership.id IS NULL THEN
    INSERT INTO public.memberships (
      user_id,
      tier,
      status,
      stripe_customer_id,
      stripe_subscription_id,
      stripe_price_id,
      stripe_subscription_status,
      cancel_at_period_end,
      last_stripe_event_created_at
    ) VALUES (
      v_user_id,
      'founding_beta',
      v_canonical_status,
      p_stripe_customer_id,
      p_stripe_subscription_id,
      p_stripe_price_id,
      p_stripe_subscription_status,
      p_cancel_at_period_end,
      p_event_created_at
    )
    RETURNING * INTO v_membership;
  ELSIF v_membership.last_stripe_event_created_at IS NOT NULL
        AND p_event_created_at < v_membership.last_stripe_event_created_at THEN
    INSERT INTO public.stripe_webhook_events (
      event_id, event_type, event_created_at, membership_id, outcome
    ) VALUES (
      p_event_id, p_event_type, p_event_created_at, v_membership.id, 'ignored_stale'
    );

    RETURN jsonb_build_object(
      'applied', false,
      'duplicate', false,
      'membershipId', v_membership.id,
      'status', v_membership.status
    );
  ELSE
    UPDATE public.memberships
    SET
      status = v_canonical_status,
      stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
      stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id),
      stripe_price_id = COALESCE(p_stripe_price_id, stripe_price_id),
      stripe_subscription_status = p_stripe_subscription_status,
      cancel_at_period_end = p_cancel_at_period_end,
      last_stripe_event_created_at = p_event_created_at
    WHERE id = v_membership.id
    RETURNING * INTO v_membership;
  END IF;

  INSERT INTO public.stripe_webhook_events (
    event_id, event_type, event_created_at, membership_id, outcome
  ) VALUES (
    p_event_id, p_event_type, p_event_created_at, v_membership.id, 'applied'
  );

  RETURN jsonb_build_object(
    'applied', true,
    'duplicate', false,
    'membershipId', v_membership.id,
    'status', v_membership.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_stripe_membership_event(
  text, text, timestamptz, uuid, text, text, text, text, text, boolean
) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_stripe_membership_event(
  text, text, timestamptz, uuid, text, text, text, text, text, boolean
) TO service_role;

-- Customers may read canonical tier/status but never Stripe identifiers or the
-- webhook ledger. Existing grants are restated for additive-column safety.
REVOKE ALL PRIVILEGES ON TABLE public.memberships FROM anon, authenticated;
GRANT SELECT (id, user_id, tier, status, created_at, updated_at)
  ON TABLE public.memberships TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.memberships TO service_role;
