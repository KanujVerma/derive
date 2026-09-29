begin;
select plan(30);
select has_table('public','plus_billing_subscriptions','Plus has a separate subscription authority');
select ok((select relrowsecurity from pg_class where oid='public.plus_billing_subscriptions'::regclass),'Plus subscriptions enable RLS');
select ok(not has_table_privilege('authenticated','public.plus_billing_subscriptions','select'),'Clients cannot read raw billing state');
select ok(not has_table_privilege('anon','public.plus_billing_customers','insert'),'Guests cannot mint billing bindings');
select ok(not has_function_privilege('authenticated','public.read_plus_billing_access(uuid)','execute'),'Only server projects Plus access');
insert into auth.users(id,email,email_confirmed_at,is_anonymous,raw_user_meta_data) values
 ('75000000-0000-4000-8000-000000000001','plus-one@example.test',now(),false,'{}'),
 ('75000000-0000-4000-8000-000000000002','plus-two@example.test',now(),false,'{}'),
 ('75000000-0000-4000-8000-000000000003',null,null,true,'{}'),
 ('75000000-0000-4000-8000-000000000004','plus-unconfirmed@example.test',null,false,'{}');
set local role service_role;
select throws_ok($$select public.acquire_plus_billing_lease('75000000-0000-4000-8000-000000000003','75000000-0000-4000-8000-000000000011')$$,'P0001','PLUS_PERMANENT_ACCOUNT_REQUIRED','Anonymous account cannot buy');
select throws_ok($$select public.acquire_plus_billing_lease('75000000-0000-4000-8000-000000000004','75000000-0000-4000-8000-000000000011')$$,'P0001','PLUS_PERMANENT_ACCOUNT_REQUIRED','Unconfirmed account cannot buy');
select is(public.acquire_plus_billing_lease('75000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000011'),true,'Owner acquires lease');
select is(public.acquire_plus_billing_lease('75000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000012'),false,'Concurrent owner lease fails');
select lives_ok($$select public.bind_plus_billing_customer('75000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000011','cus_plusone')$$,'Customer binds under lease');
select throws_ok($$select public.bind_plus_billing_customer('75000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000012','cus_plustwo')$$,'P0001','PLUS_LEASE_OR_BINDING_CONFLICT','Stale lease cannot bind');
select is(public.read_plus_billing_access('75000000-0000-4000-8000-000000000001')->>'state','inactive','Customer binding is not payment');
select is(public.commit_plus_billing_snapshot('75000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000011','evt_pluspaid','invoice.paid',now(),'sub_plusone','cus_plusone','price_plus','active',now()+interval '30 days',false,'in_plusone',now()+interval '30 days',null),true,'Verified paid period commits');
select is(public.read_plus_billing_access('75000000-0000-4000-8000-000000000001')->>'state','active','Paid Plus is active');
select is((select count(*)::int from public.memberships where user_id='75000000-0000-4000-8000-000000000001'),0,'Plus does not grant Managed membership');
select is(public.commit_plus_billing_snapshot('75000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000011','evt_pluspaid','invoice.paid',now(),'sub_plusone','cus_plusone','price_plus','active',now()+interval '30 days',false,'in_plusone',now()+interval '30 days',null),false,'Signed event replay is idempotent');
select is((select count(*)::int from public.plus_billing_events where event_id='evt_pluspaid'),1,'Replay records one event');
select is(public.commit_plus_billing_snapshot('75000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000011','evt_pluscancel','customer.subscription.updated',now()-interval '1 day','sub_plusone','cus_plusone','price_plus','active',now()+interval '30 days',true,'in_plusone',now()+interval '30 days',null),true,'Old delivery timestamp can reconcile current truth');
select is(public.read_plus_billing_access('75000000-0000-4000-8000-000000000001')->>'cancelAtPeriodEnd','true','Cancellation retains paid period');
select throws_ok($$select public.commit_plus_billing_snapshot('75000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000012','evt_plusstale','invoice.paid',now(),'sub_plusone','cus_plusone','price_plus','active',now()+interval '30 days',false,'in_plusone',now()+interval '30 days',null)$$,'P0001','PLUS_LEASE_OR_BINDING_CONFLICT','Expired writer token is fenced');
select lives_ok($$select public.suspend_plus_billing_subscription('75000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000011','sub_plusone',true)$$,'Refund/dispute suspends before provider fetch');
select is(public.read_plus_billing_access('75000000-0000-4000-8000-000000000001')->>'state','review_required','Signed risk becomes review hold');
select is(public.commit_plus_billing_snapshot('75000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000011','evt_plusafterhold','invoice.paid',now(),'sub_plusone','cus_plusone','price_plus','active',now()+interval '30 days',false,'in_plusone',now()+interval '30 days',null),true,'Later paid snapshot commits');
select is(public.read_plus_billing_access('75000000-0000-4000-8000-000000000001')->>'state','review_required','Positive event cannot clear a review hold');
select is(public.acquire_plus_billing_lease('75000000-0000-4000-8000-000000000002','75000000-0000-4000-8000-000000000012'),true,'Other owner has separate lease');
select lives_ok($$select public.bind_plus_billing_customer('75000000-0000-4000-8000-000000000002','75000000-0000-4000-8000-000000000012','cus_plustwo')$$,'Other customer binds');
select throws_ok($$select public.commit_plus_billing_snapshot('75000000-0000-4000-8000-000000000002','75000000-0000-4000-8000-000000000012','evt_plusforeign','invoice.paid',now(),'sub_plusone','cus_plustwo','price_plus','active',now()+interval '30 days',false,'in_plusone',now()+interval '30 days',null)$$,'P0001','PLUS_SUBSCRIPTION_OWNER_CONFLICT','Subscription cannot change owner');
select is(public.read_plus_billing_access('75000000-0000-4000-8000-000000000002')->>'reason','no_subscription','Other owner does not inherit grant');
select lives_ok($$select public.release_plus_billing_lease('75000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000011')$$,'Lease releases normally');
select is(public.acquire_plus_billing_lease('75000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000012'),true,'Next update can acquire after release');
select * from finish();
rollback;
