# Plus billing authority — bounded foundation

## Actual implementation, not a live purchase claim

This slice adds separate owner-bound Plus customer/subscription/event tables; permanent-account checkout, portal and billing-state endpoints; a signature-verified Stripe webhook; and strict client contracts/transport. It does **not** activate billing, change Managed membership, compose the app entitlement view, add usage counters, register shared function configuration, build the U.S. storefront seam, deploy, or charge a customer.

The existing Managed flow creates `founding_beta` membership. Reusing it would incorrectly give scanner subscribers Managed care. These functions never write `memberships` and never use `apply_stripe_membership_event`.

## Payment/access policy

The conservative refund/dispute hold behavior below is implemented but **requires explicit founder policy approval before activation**. This is not a claim that founders have approved all billing/refund terms.

This workstream is parked at a default-off source checkpoint after the founder changed first release to scanner-only. Database and live Stripe acceptance remain pending; Plus must not block scanner rollout.

- One server-selected $4.99 USD/month licensed recurring price, quantity one. No annual plan, trial, promotion code, discounted/credit-funded grant, extra item, proration, or client-selected price.
- A confirmed permanent account is required. Owner comes from Supabase Auth; customer binding is persisted under an owner lease, never recovered by email or return-page parameters.
- Access requires current `active` Stripe subscription and its latest **paid** invoice covering the current item period with at least 499 cents paid in USD. Active status or Checkout completion alone is insufficient.
- Scheduled cancellation retains access only through that paid period. Canceled, paused, incomplete, past-due, unpaid, unconfirmed or expired periods do not grant. If an old failed-invoice event arrives after successful recovery, the handler reads current Stripe state rather than reverting to stale failure data.
- A linked partial/full refund or dispute puts that subscription in a latched `refund_or_dispute` review hold. Positive events cannot clear it. No automatic dispute-win restoration or hold-clear tool is included. A separately purchased replacement subscription can grant independently; an old held subscription is not a blanket account ban.
- Unsupported item/price/pause/proration changes suspend the previous local grant and return a retryable error rather than pretending the old payment proves the new state. Stripe retrieval outages do not invent state; already proven access remains bounded by the stored paid-period expiry.
- The event ledger is idempotent. A 120-second per-owner lease serializes current Stripe reads; commit checks the exact still-valid token, customer and owner. An expired writer cannot commit or suspend another lease's grant. Event delivery timestamps are audit evidence, not ordering authority.
- Checkout reserves a server attempt before Stripe creation. Different client retry IDs reuse its idempotency key across expired leases; only a verified terminal session may rotate. An ambiguous attempt with no bound session stops for operator review at 23 hours, before Stripe's minimum 24-hour idempotency retention expires. SDK22 uses API version `2026-03-25.dahlia`, verified in its installed source.
- Once a signed risk event is bound and the lease acquired, the negative hold is written before subsequent Stripe reads; a provider-read failure cannot restore the old grant. Processing errors are not acknowledged as success.

## Integration seams owned by the release orchestrator

1. Register `create-plus-checkout`, `plus-billing-state`, `plus-billing-portal` and `stripe-plus-webhook` in shared Supabase function configuration. Customer endpoints require bearer authentication in code. Only the signed webhook must bypass the gateway JWT requirement; its raw-body Stripe signature is mandatory.
2. Compose `loadPlusBillingAccess(ownerId)` into the existing capability projection, with owner/request fencing and cache clearing on sign-out/account switch. A checkout URL or app return never activates access. Poll/read server state after return; distinguish pending payment and failed sync.
3. Implement the **actual U.S. App Store storefront** check before exposing external-purchase calls to iOS users. Device locale, IP, browser country, a client `country` field, or this foundation's server readiness marker are not storefront attestation. `DERIVE_PLUS_US_STOREFRONT_GATE_READY` is only a release-off switch; leave it false until the app seam and Apple-policy review are complete.
4. Make purchase cancellation/error/back navigation safe, add Manage billing, and keep the published price clear. Checkout and portal open only official Stripe HTTPS hosts.
5. Quota enforcement is a separate server workstream. This slice must not be advertised as unlimited checks until the capability/quota layer consumes its authority.
6. Apply `20260929100000_plus_billing_authority.sql` in orchestrator-controlled migration order after reconciling current main. No old migration edits.

## Founder setup checklist

Do not put Stripe secret keys in Git, Expo public variables, screenshots, or chat. No Stripe account has been created/configured by this slice.

1. Create or access a Stripe business account and complete its required business, payout and identity details. Start in test mode; live activation and pricing need founder approval.
2. Create **Derive Plus**, a single recurring price: **USD $4.99 monthly**, quantity one, no free trial/annual plan/promotion. Copy its `price_...` ID.
3. Configure the Customer Portal for this product: payment-method update, invoice history, and cancellation **at period end**. Disable switching prices, quantity changes and promotion features for this first policy. Tax obligations and tax treatment require separate review; this code does not configure Stripe Tax.
4. Prepare hosted HTTPS return pages for checkout success, checkout cancel and portal return. Their copy must say payment access is confirmed in the app, not promise activation from the page. URLs come from server configuration, not client payloads. Domains are needed for these pages but a custom domain is not inherently required by these endpoints.
5. After the endpoint is deployed by the orchestrator, add a dedicated Stripe webhook endpoint ending `/functions/v1/stripe-plus-webhook`, with the SDK-compatible API version and these events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `invoice.finalization_failed`, `charge.refunded`, `charge.dispute.created`. The SDK is pinned to `stripe@22.0.0`; confirm its API version when creating the endpoint rather than copying an old Managed endpoint version.
6. Store the following as **server Supabase Edge Function secrets/configuration**. Use test values together first; switch all mode-specific values together only after test receipts and release approval.

| Variable | Value/source |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers/API keys: `sk_test_...` first, later `sk_live_...`; shared existing server name, never overwrite a live Managed key with test mode without coordination |
| `STRIPE_PLUS_PRICE_ID` | The exact Plus monthly price ID for the selected mode |
| `STRIPE_PLUS_WEBHOOK_SECRET` | Signing secret `whsec_...` of this dedicated Plus webhook endpoint |
| `DERIVE_PLUS_STRIPE_MODE` | `test` first; `live` only when ready |
| `DERIVE_PLUS_CHECKOUT_SUCCESS_URL` | Fixed HTTPS success page |
| `DERIVE_PLUS_CHECKOUT_CANCEL_URL` | Fixed HTTPS cancellation page |
| `DERIVE_PLUS_PORTAL_RETURN_URL` | Fixed HTTPS return page |
| `DERIVE_PLUS_BILLING_ENABLED` | `false` by default; `true` only for controlled test/live acceptance |
| `DERIVE_PLUS_US_STOREFRONT_GATE_READY` | `false` until the real app storefront gate is integrated and reviewed |

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` inside deployed functions; do not expose these privileged values to the app. No Stripe key belongs in Expo's public environment.

7. Run Stripe test-mode acceptance: confirmed account purchase → signed invoice/current-state reconciliation → owner-bound active read; duplicate/reordered event; unpaid/failed renewal; cancellation through period end; refund/dispute hold; account switch; foreign-owner denial; portal; checkout abandonment; non-U.S. purchase entry hidden. Then repeat relevant acceptance with the reconciled native binary and exact hosted backend. Do not claim App Store-ready or live billing from unit tests alone.

## Evidence behind the architecture

Stripe says webhook delivery order is not guaranteed and events can repeat; verification needs the unchanged raw body. Its subscription guidance warns that `active` alone does not prove every invoice paid and recommends using paid-invoice/current-subscription state for access. Current invoice/payment object APIs support subscription mapping through `invoice.parent.subscription_details` and invoice payments for charge refunds/disputes. Sources: [webhooks](https://docs.stripe.com/webhooks), [subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks), [subscription object](https://docs.stripe.com/api/subscriptions/object), [invoice-payment listing](https://docs.stripe.com/api/invoice-payment/list).

Local contract/lifecycle tests and pgTAP are receipts for this foundation, not receipts of a live Stripe charge, hosted webhook delivery, actual Apple storefront, or App Store acceptance.
