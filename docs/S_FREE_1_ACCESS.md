# S-FREE-1 access boundary and Kanuj handoff

This is the platform contract after S-FREE-1. It is not a claim that the current mobile app presents the free funnel or that hosted guest signup is enabled. A Supabase anonymous Auth session has a real user UUID and the Postgres `authenticated` role; it is **not** the public `anon` API role. Server code determines identity from a verified Auth user (`is_anonymous`), never a client flag. Free access is independent of a managed membership. Managed care requires both a permanent identity and an active managed membership.

## Operation matrix

`FREE` means any authenticated guest or permanent user without a membership. `MANAGED` requires permanent identity plus active membership. `BOTH` is a narrowly scoped account/lifecycle or historical owner-read operation. `INTERNAL` requires trusted service/founder authority. A `BOTH` owner read does not permit a free write to that table.

| Surface | Class | Enforcement / exact boundary |
| --- | --- | --- |
| `access-state` | FREE | JWT + verified Auth identity; returns separate free/managed states. |
| `catalog-products` search/detail | FREE | JWT; only sourced canonical products and public provenance, never member context. |
| `resolve-product-identity` | FREE/BOTH | Free factual typed, barcode, and catalog evidence; managed members may also use private product-photo evidence. Owner-bound S6 cases and five trust states remain. Free cases never create founder-review tasks. |
| `scan-product`, `ask-derive`, `infer-ingredient-signals` | MANAGED | Existing provider/context service and active-member gate retained; this is not free Personal Fit. |
| `prepare-onboarding`, `onboard-customer`, `propose-routine`, `submit-checkin` | MANAGED | Permanent identity + active membership. |
| `photo-url` | BOTH | JWT + exact owner photo ID/path; historical owner photo retrieval only, not a free photo-intake path. |
| `delete-customer-account` | BOTH | JWT + exact confirmation; caller identity derived from token; private Storage cleared and verified before Auth deletion. |
| `create-membership-checkout`, `create-membership-portal` | MANAGED transition | Permanent identity required; existing billing/entitlement rules still apply. No Stripe activation in this milestone. |
| `stripe-membership-webhook`, `founder-operations`, admin console | INTERNAL | Signed webhook or founder-authenticated operator; guest founder access explicitly denied. |
| `profiles` read and own display-name/phone update | BOTH | Owner RLS; Auth trigger supplies profile; guest email is nullable, never fabricated. Client cannot write email/ownership. |
| `memberships` read | BOTH | Owner projection only; free users normally have no row. No client insert/update/delete. A synthetic active guest row does not confer managed rights. |
| `skin_profiles`, `user_products`, `check_ins`, `refill_requests` | MANAGED | Owner reads of any historical rows; direct writes require `current_member_is_active()`, which verifies permanent Auth identity as well as latest active membership. Guest cannot create Wave-2/3 context by direct Data API. |
| `routines`, `routine_items`, `user_photos` | MANAGED | Owner historical reads only. Routine mutation service-only; photo metadata insert and skin-photo Storage upload require permanent active membership. |
| `products` direct Data API | MANAGED | Guest raw-row reads are closed, including ingredient/caution columns that may lack package-level provenance. Free facts come through bounded catalog/resolver endpoints. Managed historical catalog/Shelf reads preserved; operator provenance columns remain ungranted. |
| `product_resolution_cases`, `product_resolution_evidence`, `product_resolution_candidates` | FREE/BOTH | Owner read only; server writes; no cross-user read. |
| `product_variants`, `product_formula_versions`, `product_identifiers`, catalog aliases | INTERNAL | Service-only truth/provenance; public facts exposed through bounded catalog/resolver endpoints. |
| Research/reference data | INTERNAL or existing owner projection | No new guest research table grants or synthesis endpoint in Wave 1. |
| `customer-product-evidence` private Storage | MANAGED | Existing permanent active-member insert policy; no client read/list/update/delete; free photo evidence rejected before resolver use. |
| `customer-skin-photos` private Storage | MANAGED | Same managed upload boundary; signed historical retrieval via `photo-url` only. |
| `claim_external_beta_access()` | MANAGED staging shortcut | Security-definer RPC rejects guest even if the release flag is open. Permanent idempotent, paused/cancelled and Stripe-bound behavior preserved. |
| Catalog search / S6 record / managed routine RPCs | INTERNAL | Executable only by service role; no direct guest RPC access. |

The public `anon` Data API role has no application-table privileges. All owner access above is enforced on the backend, not by hidden navigation. Closing guest raw-product reads avoids presenting legacy ingredient fields as if their formulas were verified.

## Stable mobile contract

Kanuj may establish a real anonymous Supabase Auth session with `signInAnonymously()` when hosted activation is approved, then call `getFreeAccessState()` from `src/services/remote/freeAccess.ts` or invoke `access-state` with that session. The response is:

```ts
interface FreeAccessState {
  userId: string;
  identityKind: 'anonymous' | 'permanent';
  freeProductAccess: true;
  managedMembershipStatus: 'active' | 'paused' | 'cancelled' | 'none';
  managedAccess: boolean;
}
```

`managedAccess` is true only for a permanent identity whose latest managed membership is active. Guest responses always report `none` and `false`; no `founding_beta` membership is created. This additive interface does not replace the existing managed bootstrap. The new Edge Function is `access-state`, with JWT verification and `Cache-Control: private, no-store`. `catalog-products` and `resolve-product-identity` are legal free calls; all managed actions remain gated. `UNAUTHORIZED` is 401 for no/invalid session; `PERMANENT_ACCOUNT_REQUIRED` is 403 for managed account actions; `MEMBERSHIP_REQUIRED` is 403 for a permanent user without active membership; `PHOTO_EVIDENCE_MANAGED_ONLY` is 403 for free product-photo evidence; `IDENTITY_UNAVAILABLE`/`ACCESS_UNAVAILABLE` are fail-closed 503 states. Do not infer managed access from the existence of an Auth session.

Wave 1 resolver evidence is typed product identity, barcode, and existing catalog facts. Ingredient/label text may remain in the pre-existing S6 input contract, but no new OCR/photo extraction or free private upload is activated. Exact formula verification still needs authoritative identifier-to-version provenance. Unknown and ambiguous remain explicit S6 states, not a fabricated product score or Personal Fit. Free unresolved cases are owner-persisted with `requiresFounderReview=false`; this is a deliberate queue-abuse boundary, not a claim that they were reviewed.

K-FREE-1 owns silent sign-in, routing and presentation. S-FREE-2 owns deterministic free fit/profile persistence; S-FREE-3 owns free shelf/history; S-FREE-4 owns camera/OCR/private photo evidence; S-PAID-1 owns managed upgrade; S-OPS-1 owns anonymous abuse controls, linking/conflicts, cleanup and session-loss UX. Do not wire existing managed bootstrap or provider `scan-product` as a free Check substitute.

## Activation and verification

Local `supabase/config.toml` enables anonymous sign-ins for the test stack. Hosted project `snojlbqovlawewwqbviz` must remain **DELIBERATELY GATED**: no hosted anonymous Auth setting was enabled by S-FREE-1. Before enabling it, S-OPS-1 must provide abuse/rate/CAPTCHA and anonymous lifecycle controls, then repeat hosted RLS, beta-claim, direct managed denial, free catalog/resolver, deletion and rollback checks. The hosted catalog remains too sparse for a useful general release. The only new database migration is `20260923180000_s_free_1_identity_boundary.sql`; `access-state` is the new function and existing resolver/shared access checks change. Local acceptance: fresh reset, complete pgTAP suite, real guest HTTP smoke, unit/TypeScript/export checks. See the S-FREE-1 `CONTEXT_SYNC` checkpoint for exact counts and CI/PR disposition.
