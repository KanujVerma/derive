-- First-party, opt-in-gated product measurement. No client or vendor transport
-- is activated by this migration. Product/skin identities and free text have
-- no valid storage shape here. The Edge function independently validates V1.
create table public.product_measurement_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  schema_version smallint not null default 1 check (schema_version = 1),
  event_name text not null,
  properties jsonb not null,
  received_at timestamptz not null default clock_timestamp(),
  constraint product_measurement_properties_bounded check (
    jsonb_typeof(properties) = 'object' and octet_length(properties::text) <= 512
  ),
  constraint product_measurement_event_shape check (
    case
      when event_name = 'app_opened' then
        properties = jsonb_build_object('platform', properties -> 'platform')
        and jsonb_typeof(properties -> 'platform') = 'string'
        and properties ->> 'platform' in ('ios', 'android', 'web', 'unknown')
      when event_name = 'acquisition_touch' then
        properties = jsonb_build_object('channel', properties -> 'channel')
        and jsonb_typeof(properties -> 'channel') = 'string'
        and properties ->> 'channel' in ('direct', 'organic', 'friend', 'creator', 'club', 'paid', 'unknown')
      when event_name in ('referral_opened', 'referral_shared') then
        properties = jsonb_build_object('channel', properties -> 'channel')
        and jsonb_typeof(properties -> 'channel') = 'string'
        and properties ->> 'channel' in ('friend', 'creator', 'club', 'unknown')
      when event_name = 'check_started' then
        properties = jsonb_build_object('inputMethod', properties -> 'inputMethod')
        and jsonb_typeof(properties -> 'inputMethod') = 'string'
        and properties ->> 'inputMethod' in ('barcode', 'search', 'photo', 'unknown')
      when event_name = 'check_completed' then
        properties = jsonb_build_object(
          'inputMethod', properties -> 'inputMethod',
          'outcome', properties -> 'outcome',
          'personalized', properties -> 'personalized'
        )
        and jsonb_typeof(properties -> 'inputMethod') = 'string'
        and properties ->> 'inputMethod' in ('barcode', 'search', 'photo', 'unknown')
        and jsonb_typeof(properties -> 'outcome') = 'string'
        and properties ->> 'outcome' in ('useful', 'unknown_product', 'insufficient_evidence', 'failed')
        and jsonb_typeof(properties -> 'personalized') = 'boolean'
        and (properties ->> 'outcome' = 'useful' or properties ->> 'personalized' = 'false')
      when event_name in ('personal_decision_viewed', 'my_stuff_viewed', 'check_saved') then
        properties = '{}'::jsonb
      when event_name = 'plus_trigger_reached' then
        properties = jsonb_build_object('trigger', properties -> 'trigger')
        and jsonb_typeof(properties -> 'trigger') = 'string'
        and properties ->> 'trigger' in ('quota', 'compare', 'shelf_analysis', 'history', 'research', 'other')
      when event_name = 'paywall_viewed' then
        properties = jsonb_build_object('source', properties -> 'source')
        and jsonb_typeof(properties -> 'source') = 'string'
        and properties ->> 'source' in ('quota', 'compare', 'shelf_analysis', 'history', 'research', 'other')
      when event_name in ('plus_plan_selected', 'plus_purchase_started') then
        properties = jsonb_build_object('plan', properties -> 'plan')
        and jsonb_typeof(properties -> 'plan') = 'string'
        and properties ->> 'plan' in ('monthly', 'annual')
      when event_name in ('managed_viewed', 'managed_learn_more', 'managed_interest') then
        properties = jsonb_build_object('source', properties -> 'source')
        and jsonb_typeof(properties -> 'source') = 'string'
        and properties ->> 'source' in ('check', 'plan', 'account', 'other')
      when event_name = 'experiment_exposed' then
        properties = jsonb_build_object(
          'experiment', properties -> 'experiment', 'variant', properties -> 'variant'
        )
        and jsonb_typeof(properties -> 'experiment') = 'string'
        and properties ->> 'experiment' in ('plus_offer_v1', 'managed_early_access_v1')
        and jsonb_typeof(properties -> 'variant') = 'string'
        and properties ->> 'variant' in ('control', 'treatment')
      else false
    end
  )
);
create index product_measurement_owner_time_idx
  on public.product_measurement_events (user_id, received_at desc);

alter table public.product_measurement_events enable row level security;
revoke all on public.product_measurement_events from public, anon, authenticated;
grant select, insert on public.product_measurement_events to service_role;
-- No customer policy: even an authenticated customer cannot query an event
-- history or insert one directly. First-party review uses service-role tools.

create function public.record_product_measurement(
  p_user_id uuid, p_event_name text, p_properties jsonb
)
returns uuid
language plpgsql volatile security invoker set search_path = ''
as $$
declare v_id uuid;
begin
  if p_user_id is null or p_event_name is null or p_properties is null then
    raise exception 'INVALID_PRODUCT_MEASUREMENT';
  end if;
  -- This same per-owner lock is used by begin_customer_account_deletion.
  -- An event cannot commit behind the account-deletion fence.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 191027));
  if not exists (select 1 from public.profiles
    where id = p_user_id and deletion_started_at is null) then
    raise exception 'PRODUCT_MEASUREMENT_OWNER_UNAVAILABLE';
  end if;
  -- Operational abuse cap, not a Free Check/product quota. Keep it independent
  -- of entitlement, payment, or feature access.
  if (select count(*) from public.product_measurement_events
      where user_id = p_user_id and received_at > clock_timestamp() - interval '1 minute') >= 60
     or (select count(*) from public.product_measurement_events
      where user_id = p_user_id and received_at > clock_timestamp() - interval '1 day') >= 1000 then
    raise exception 'PRODUCT_MEASUREMENT_RATE_LIMIT';
  end if;
  insert into public.product_measurement_events (user_id, event_name, properties)
    values (p_user_id, p_event_name, p_properties) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.record_product_measurement(uuid,text,jsonb)
  from public, anon, authenticated;
grant execute on function public.record_product_measurement(uuid,text,jsonb)
  to service_role;
