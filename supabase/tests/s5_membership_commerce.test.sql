begin;

select plan(20);

select has_column('public', 'memberships', 'stripe_price_id', 'memberships stores Stripe price identity');
select has_column('public', 'memberships', 'stripe_subscription_status', 'memberships stores raw Stripe lifecycle');
select has_column('public', 'memberships', 'cancel_at_period_end', 'memberships stores scheduled cancellation state');
select has_column('public', 'memberships', 'last_stripe_event_created_at', 'memberships stores webhook ordering boundary');
select has_column('public', 'memberships', 'updated_at', 'memberships has an update timestamp');
select has_table('public', 'stripe_webhook_events', 'minimal webhook idempotency ledger exists');

select ok(
  (select relrowsecurity from pg_class where oid = 'public.stripe_webhook_events'::regclass),
  'webhook ledger has RLS enabled'
);

select ok(
  has_column_privilege('authenticated', 'public.memberships', 'status', 'select')
    and not has_column_privilege('authenticated', 'public.memberships', 'stripe_customer_id', 'select')
    and not has_column_privilege('authenticated', 'public.memberships', 'stripe_subscription_id', 'select')
    and not has_column_privilege('authenticated', 'public.memberships', 'stripe_price_id', 'select')
    and not has_column_privilege('authenticated', 'public.memberships', 'stripe_subscription_status', 'select'),
  'members can read canonical state but no Stripe billing identifiers'
);

select ok(
  not has_table_privilege('authenticated', 'public.stripe_webhook_events', 'select')
    and not has_table_privilege('anon', 'public.stripe_webhook_events', 'select'),
  'webhook delivery ledger is server-only'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.apply_stripe_membership_event(text,text,timestamp with time zone,uuid,text,text,text,text,text,boolean)',
    'execute'
  )
    and not has_function_privilege(
      'authenticated',
      'public.apply_stripe_membership_event(text,text,timestamp with time zone,uuid,text,text,text,text,text,boolean)',
      'execute'
    ),
  'only service_role may project verified Stripe events'
);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('55000000-0000-4000-8000-000000000001', 's5-one@example.test', '{}'::jsonb),
  ('55000000-0000-4000-8000-000000000002', 's5-two@example.test', '{}'::jsonb);

set local role service_role;

select is(
  (
    public.apply_stripe_membership_event(
      'evt_s5active',
      'customer.subscription.created',
      '2026-09-19T10:00:00Z',
      '55000000-0000-4000-8000-000000000001',
      's5-one@example.test',
      'cus_s5one',
      'sub_s5one',
      'active',
      'price_s5founding',
      false
    ) ->> 'status'
  ),
  'active',
  'active Stripe subscription activates canonical membership'
);

select results_eq(
  $$
    select stripe_customer_id, stripe_subscription_id, stripe_price_id, stripe_subscription_status
    from public.memberships
    where user_id = '55000000-0000-4000-8000-000000000001'
  $$,
  $$values ('cus_s5one'::text, 'sub_s5one'::text, 'price_s5founding'::text, 'active'::text)$$,
  'verified event binds minimal Stripe identity to the member'
);

select is(
  (select count(*)::integer from public.stripe_webhook_events where event_id = 'evt_s5active'),
  1,
  'applied event is recorded once'
);

select ok(
  (
    public.apply_stripe_membership_event(
      'evt_s5active',
      'customer.subscription.updated',
      '2026-09-19T11:00:00Z',
      '55000000-0000-4000-8000-000000000001',
      null,
      'cus_s5one',
      'sub_s5one',
      'canceled',
      'price_s5founding',
      false
    ) ->> 'duplicate'
  )::boolean,
  'duplicate webhook delivery is idempotent'
);

select is(
  (
    public.apply_stripe_membership_event(
      'evt_s5stale',
      'customer.subscription.deleted',
      '2026-09-19T09:00:00Z',
      '55000000-0000-4000-8000-000000000001',
      null,
      'cus_s5one',
      'sub_s5one',
      'canceled',
      'price_s5founding',
      false
    ) ->> 'status'
  ),
  'active',
  'out-of-order older webhook cannot regress current membership state'
);

select is(
  (
    public.apply_stripe_membership_event(
      'evt_s5pastdue',
      'customer.subscription.updated',
      '2026-09-19T12:00:00Z',
      null,
      null,
      'cus_s5one',
      'sub_s5one',
      'past_due',
      'price_s5founding',
      false
    ) ->> 'status'
  ),
  'paused',
  'non-entitled billing status maps conservatively to paused'
);

select is(
  (
    public.apply_stripe_membership_event(
      'evt_s5cancelled',
      'customer.subscription.deleted',
      '2026-09-19T13:00:00Z',
      null,
      null,
      'cus_s5one',
      'sub_s5one',
      'canceled',
      'price_s5founding',
      false
    ) ->> 'status'
  ),
  'cancelled',
  'canceled Stripe subscription maps to canonical cancelled'
);

select is(
  (
    public.apply_stripe_membership_event(
      'evt_s5emailfallback',
      'customer.subscription.created',
      '2026-09-19T10:00:00Z',
      null,
      ' S5-TWO@EXAMPLE.TEST ',
      'cus_s5two',
      'sub_s5two',
      'trialing',
      'price_s5founding',
      false
    ) ->> 'status'
  ),
  'active',
  'normalized customer email is a compatibility fallback when metadata is absent'
);

select results_eq(
  $$
    select user_id
    from public.memberships
    where stripe_customer_id = 'cus_s5two'
  $$,
  $$values ('55000000-0000-4000-8000-000000000002'::uuid)$$,
  'email fallback binds the correct Supabase member'
);

select throws_ok(
  $$
    select public.apply_stripe_membership_event(
      'evt_s5conflict',
      'customer.subscription.updated',
      '2026-09-19T14:00:00Z',
      '55000000-0000-4000-8000-000000000002',
      null,
      'cus_s5one',
      'sub_s5one',
      'active',
      'price_s5founding',
      false
    )
  $$,
  'P0001',
  'S5_STRIPE_IDENTITY_CONFLICT',
  'conflicting authenticated metadata and Stripe binding fails closed'
);

select * from finish();
rollback;
