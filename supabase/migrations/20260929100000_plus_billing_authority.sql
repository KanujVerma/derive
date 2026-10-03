-- Separate Plus billing authority. Never writes memberships or Managed access.
create table public.plus_billing_customers (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 stripe_customer_id text unique check (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
 lease_token uuid, lease_until timestamptz,
 checkout_attempt_id uuid,checkout_reserved_at timestamptz,checkout_session_id text check(checkout_session_id ~ '^cs_[A-Za-z0-9_]+$'),
 created_at timestamptz not null default now(),
 check ((lease_token is null) = (lease_until is null)),
 check ((checkout_attempt_id is null) = (checkout_reserved_at is null)),
 check (checkout_session_id is null or checkout_attempt_id is not null)
);
create table public.plus_billing_subscriptions (
 stripe_subscription_id text primary key check (stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$'),
 user_id uuid not null references public.plus_billing_customers(user_id) on delete cascade,
 stripe_customer_id text not null check (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
 stripe_price_id text not null check (stripe_price_id ~ '^price_[A-Za-z0-9]+$'),
 subscription_status text not null check (subscription_status in ('active','trialing','incomplete','incomplete_expired','past_due','unpaid','paused','canceled')),
 period_end timestamptz not null, cancel_at_period_end boolean not null default false,
 paid_invoice_id text check (paid_invoice_id ~ '^in_[A-Za-z0-9]+$'), paid_until timestamptz,
 review_hold text check (review_hold='refund_or_dispute'), reconciled_at timestamptz not null default now(),
 check ((paid_invoice_id is null) = (paid_until is null)),
 check (paid_until is null or (subscription_status='active' and paid_until=period_end))
);
create index plus_billing_owner_idx on public.plus_billing_subscriptions(user_id,paid_until desc);
create table public.plus_billing_events (
 event_id text primary key check (event_id ~ '^evt_[A-Za-z0-9]+$'),
 user_id uuid not null references public.plus_billing_customers(user_id) on delete cascade,
 event_type text not null, stripe_created_at timestamptz not null, processed_at timestamptz not null default now()
);
alter table public.plus_billing_customers enable row level security;
alter table public.plus_billing_subscriptions enable row level security;
alter table public.plus_billing_events enable row level security;
revoke all on public.plus_billing_customers,public.plus_billing_subscriptions,public.plus_billing_events from public,anon,authenticated;
grant all on public.plus_billing_customers,public.plus_billing_subscriptions,public.plus_billing_events to service_role;

create function public.acquire_plus_billing_lease(p_user_id uuid,p_token uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_token is null or not exists(select 1 from auth.users u where u.id=p_user_id and u.is_anonymous is false and u.email_confirmed_at is not null) then
  raise exception 'PLUS_PERMANENT_ACCOUNT_REQUIRED';
 end if;
 insert into public.plus_billing_customers(user_id) values(p_user_id) on conflict(user_id) do nothing;
 update public.plus_billing_customers set lease_token=p_token,lease_until=clock_timestamp()+interval '120 seconds'
 where user_id=p_user_id and (lease_until is null or lease_until<=clock_timestamp());
 return found;
end; $$;
create function public.release_plus_billing_lease(p_user_id uuid,p_token uuid)
returns void language sql security invoker set search_path='' as $$
 update public.plus_billing_customers set lease_token=null,lease_until=null where user_id=p_user_id and lease_token=p_token;
$$;
create function public.bind_plus_billing_customer(p_user_id uuid,p_token uuid,p_customer_id text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_customer_id is null or p_customer_id !~ '^cus_[A-Za-z0-9]+$' then raise exception 'PLUS_INVALID_CUSTOMER'; end if;
 update public.plus_billing_customers set stripe_customer_id=p_customer_id where user_id=p_user_id and lease_token=p_token
 and lease_until>clock_timestamp() and (stripe_customer_id is null or stripe_customer_id=p_customer_id);
 if not found then raise exception 'PLUS_LEASE_OR_BINDING_CONFLICT'; end if;
end; $$;
create function public.reserve_plus_checkout_attempt(p_user_id uuid,p_token uuid,p_attempt_id uuid,p_rotate_attempt_id uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare binding public.plus_billing_customers;
begin
 select * into binding from public.plus_billing_customers where user_id=p_user_id for update;
 if not found or p_attempt_id is null or binding.lease_token is distinct from p_token or binding.lease_until<=clock_timestamp()
 or binding.stripe_customer_id is null then raise exception 'PLUS_LEASE_OR_BINDING_CONFLICT'; end if;
 if p_rotate_attempt_id is not null and (binding.checkout_attempt_id is distinct from p_rotate_attempt_id or binding.checkout_session_id is null) then
  raise exception 'PLUS_CHECKOUT_ATTEMPT_CONFLICT';
 end if;
 if binding.checkout_attempt_id is null or p_rotate_attempt_id is not null then
  update public.plus_billing_customers set checkout_attempt_id=p_attempt_id,checkout_reserved_at=clock_timestamp(),checkout_session_id=null
  where user_id=p_user_id returning * into binding;
 end if;
 return jsonb_build_object('attemptId',binding.checkout_attempt_id,'sessionId',binding.checkout_session_id,
 'reservedAt',to_char(binding.checkout_reserved_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end; $$;
create function public.bind_plus_checkout_session(p_user_id uuid,p_token uuid,p_attempt_id uuid,p_session_id text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_session_id is null or p_session_id !~ '^cs_[A-Za-z0-9_]+$' then raise exception 'PLUS_INVALID_CHECKOUT_SESSION'; end if;
 update public.plus_billing_customers set checkout_session_id=p_session_id where user_id=p_user_id and lease_token=p_token
 and lease_until>clock_timestamp() and checkout_attempt_id=p_attempt_id and (checkout_session_id is null or checkout_session_id=p_session_id);
 if not found then raise exception 'PLUS_LEASE_OR_BINDING_CONFLICT'; end if;
end; $$;
create function public.commit_plus_billing_snapshot(p_user_id uuid,p_token uuid,p_event_id text,p_event_type text,
 p_event_created_at timestamptz,p_subscription_id text,p_customer_id text,p_price_id text,p_status text,
 p_period_end timestamptz,p_cancel boolean,p_paid_invoice_id text,p_paid_until timestamptz,p_hold text)
returns boolean language plpgsql security definer set search_path='' as $$
declare binding public.plus_billing_customers; existing_owner uuid;
begin
 select * into binding from public.plus_billing_customers where user_id=p_user_id for update;
 if not found or binding.lease_token is distinct from p_token or binding.lease_until<=clock_timestamp()
 or binding.stripe_customer_id is distinct from p_customer_id then raise exception 'PLUS_LEASE_OR_BINDING_CONFLICT'; end if;
 if not exists(select 1 from auth.users where id=p_user_id and is_anonymous is false and email_confirmed_at is not null) then
  raise exception 'PLUS_PERMANENT_ACCOUNT_REQUIRED';
 end if;
 select user_id into existing_owner from public.plus_billing_events where event_id=p_event_id;
 if found then
  if existing_owner is distinct from p_user_id then raise exception 'PLUS_EVENT_OWNER_CONFLICT'; end if;
  return false;
 end if;
 if p_event_id is null or p_event_id !~ '^evt_[A-Za-z0-9]+$' or p_event_created_at is null
 or p_event_type not in ('checkout.session.completed','checkout.session.async_payment_succeeded','customer.subscription.created',
 'customer.subscription.updated','customer.subscription.deleted','customer.subscription.paused','customer.subscription.resumed',
 'invoice.paid','invoice.payment_failed','invoice.payment_action_required','invoice.finalization_failed','charge.refunded','charge.dispute.created') then
  raise exception 'PLUS_INVALID_EVENT';
 end if;
 select user_id into existing_owner from public.plus_billing_subscriptions where stripe_subscription_id=p_subscription_id;
 if found and existing_owner is distinct from p_user_id then raise exception 'PLUS_SUBSCRIPTION_OWNER_CONFLICT'; end if;
 insert into public.plus_billing_subscriptions(stripe_subscription_id,user_id,stripe_customer_id,stripe_price_id,
 subscription_status,period_end,cancel_at_period_end,paid_invoice_id,paid_until,review_hold)
 values(p_subscription_id,p_user_id,p_customer_id,p_price_id,p_status,p_period_end,p_cancel,p_paid_invoice_id,p_paid_until,p_hold)
 on conflict(stripe_subscription_id) do update set subscription_status=excluded.subscription_status,
 period_end=excluded.period_end,cancel_at_period_end=excluded.cancel_at_period_end,
 paid_invoice_id=excluded.paid_invoice_id,paid_until=excluded.paid_until,
 review_hold=coalesce(public.plus_billing_subscriptions.review_hold,excluded.review_hold),reconciled_at=clock_timestamp()
 where public.plus_billing_subscriptions.user_id=excluded.user_id
 and public.plus_billing_subscriptions.stripe_customer_id=excluded.stripe_customer_id
 and public.plus_billing_subscriptions.stripe_price_id=excluded.stripe_price_id;
 if not found then raise exception 'PLUS_SUBSCRIPTION_OWNER_CONFLICT'; end if;
 insert into public.plus_billing_events(event_id,user_id,event_type,stripe_created_at)
 values(p_event_id,p_user_id,p_event_type,p_event_created_at);
 return true;
end; $$;
create function public.suspend_plus_billing_subscription(p_user_id uuid,p_token uuid,p_subscription_id text,p_risk boolean)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.plus_billing_customers where user_id=p_user_id and lease_token=p_token
 and lease_until>clock_timestamp() for update;
 if not found then raise exception 'PLUS_LEASE_OR_BINDING_CONFLICT'; end if;
 update public.plus_billing_subscriptions set paid_invoice_id=null,paid_until=null,
 review_hold=case when p_risk then 'refund_or_dispute' else review_hold end,reconciled_at=clock_timestamp()
 where user_id=p_user_id and stripe_subscription_id=p_subscription_id;
end; $$;
create function public.read_plus_billing_access(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare subscription public.plus_billing_subscriptions; checked timestamptz:=clock_timestamp(); state text:='inactive'; reason text:='no_subscription';
begin
 if not exists(select 1 from auth.users where id=p_user_id and is_anonymous is false and email_confirmed_at is not null) then
  raise exception 'PLUS_PERMANENT_ACCOUNT_REQUIRED';
 end if;
 select * into subscription from public.plus_billing_subscriptions where user_id=p_user_id
 order by coalesce(review_hold is null and subscription_status='active' and paid_until>checked,false) desc,
 reconciled_at desc,stripe_subscription_id limit 1;
 if found then
  if subscription.review_hold is not null then state:='review_required';reason:='refund_or_dispute';
  elsif subscription.subscription_status<>'active' then reason:='subscription_inactive';
  elsif subscription.paid_until is null then reason:='payment_unconfirmed';
  elsif subscription.paid_until<=checked then reason:='expired';
  else state:='active';reason:=null; end if;
 end if;
 return jsonb_build_object('schemaVersion','plus-billing/v1','ownerId',p_user_id,'state',state,'reason',reason,
 'validUntil',case when state='active' then to_char(subscription.paid_until at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') else null end,
 'cancelAtPeriodEnd',coalesce(subscription.cancel_at_period_end,false),
 'checkedAt',to_char(checked at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end; $$;
revoke all on function public.acquire_plus_billing_lease(uuid,uuid),public.release_plus_billing_lease(uuid,uuid),
 public.bind_plus_billing_customer(uuid,uuid,text),public.read_plus_billing_access(uuid),
 public.suspend_plus_billing_subscription(uuid,uuid,text,boolean),
 public.reserve_plus_checkout_attempt(uuid,uuid,uuid,uuid),public.bind_plus_checkout_session(uuid,uuid,uuid,text),
 public.commit_plus_billing_snapshot(uuid,uuid,text,text,timestamptz,text,text,text,text,timestamptz,boolean,text,timestamptz,text)
 from public,anon,authenticated;
grant execute on function public.acquire_plus_billing_lease(uuid,uuid),public.release_plus_billing_lease(uuid,uuid),
 public.bind_plus_billing_customer(uuid,uuid,text),public.read_plus_billing_access(uuid),
 public.suspend_plus_billing_subscription(uuid,uuid,text,boolean),
 public.reserve_plus_checkout_attempt(uuid,uuid,uuid,uuid),public.bind_plus_checkout_session(uuid,uuid,uuid,text),
 public.commit_plus_billing_snapshot(uuid,uuid,text,text,timestamptz,text,text,text,text,timestamptz,boolean,text,timestamptz,text) to service_role;
