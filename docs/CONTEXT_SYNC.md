# Derive Cross-Agent Context Sync Ledger

This repository-native ledger records meaningful cross-agent checkpoints. Current implementation/runtime/tests and the canonical docs outrank historical entries below. GitHub is the sole durable project context; Drive is limited to customer-research artifacts. Past `Drive Status` and `DRIVE_SYNC_PAYLOAD` lines document their historical checkpoints and impose no current sync requirement.

**Core Rules**:
1. A fresh agent can recover current work from `AGENTS.md`, `docs/ROADMAP.md`, `docs/OWNERSHIP.md`, relevant canonical docs, and this ledger without manual chat debriefing. Add entries for material milestones, decisions, contracts, or handoffs, not every edit.
2. **Immutable Predecessor Ledger Rule**: Ledger entries record immutable predecessor commit SHAs, base checkpoints, and CI runs. An active working pass never attempts to self-reference or predict its own resulting commit SHA.

## 2026-09-20: L0 Remote customer build readiness checkpoint

- **Predecessor:** clean `origin/main@672db7640c3c0a3c712643ab6d286901105c21dc`, the V1A PR #24 merge. This records the L0 branch decision without predicting merge or CI outcome.
- **Build architecture:** `remote-staging` is store-signed, TestFlight-capable and explicitly selects EAS preview with Remote mode and a separate build-flavor marker. Development and production profiles keep Remote disabled. The client rejects inconsistent or incomplete Remote staging configuration; staging-only diagnostics expose flavor, service mode, safe backend host and version without a key.
- **Environment handoff:** read-only `eas config` validated the remote-staging profile and reported that EAS preview has no plain-text/sensitive public variables at this checkpoint. H1A must independently verify the hosted Derive project before configuring the public URL/key in preview and making a real staging build. A fixed expected-project-ref guard was deferred because the connected Supabase project listing did not expose the previously recorded Derive project; no ref is guessed into the client.
- **Remote client audit:** existing route and session tests cover signed out, session initialization, unresolved/error bootstrap, inactive membership, pending refresh, active onboarding incomplete/complete, published/draft routine presentation, downgrade, account switch and sign out. L0 adds build-flavor and configuration tests; no additional mobile routing defect was found in this pass. These local tests do not prove the hosted lifecycle.
- **Build verification nuance:** a local web export reused a prior Mock bundle after switching shell public variables; a cache-cleared export rebuilt with the synthetic staging host. L1/H1A should clear local Metro cache when switching flavors and read the compiled staging diagnostic on-device. This is local tooling evidence, not a claim about an EAS cloud build.
- **Ownership and evidence:** founder authorization assigns H1A hosted post-auth core temporarily to Kanuj after L0 lands. H1E email delivery, H1B Stripe activation, F1 founder fallback and normal platform implementation stay with Sami. Old draft H1 PR #21 is read-only evidence, not a branch to continue. No hosted activation, real OTP, Stripe, Gemini or production Remote proof is claimed by L0.

## 2026-09-20: V1A first-customer roadmap and context reset

- **Predecessor:** `main@6f6a55615b9622ccdf2536c7e7cfb4dbb74cce0e`, the C1.5A PR #23 merge. This entry records branch documentation, not V1A merge or CI outcome.
- **Durable source:** working tree for in-progress work, GitHub `main` for shared checkpoints, repository docs for product/architecture/roadmap. Drive retains customer-research artifacts only; no living-brief sync, dual-source freshness, `DRIVE_SYNC_PAYLOAD`, or Drive completion gate applies going forward.
- **Intake integrity:** Shelf now accepts customer-entered brand, exact name and canonical category with empty actives and `isCatalogStandard: false`. Customer-added or corrected products survive empty recognition and photo retakes; exact duplicate identities merge conservatively. Unconfigured human support is hidden, Profile routes skincare questions to Ask, and a customer contact address is public only after the optional mailbox is configured and operationally verified. No hosted backend or formula contract changed.
- **Cross-lane follow-up:** Profile's former Export Personal Data row only showed a local success alert; it created no export request. V1A hides that false action. Sami owns any future authenticated export/fulfillment backend; Kanuj can restore customer UX after a working interface is handed off. This is not treated as a completed export capability.
- **Ownership:** V1A, L1 and L2 belong to Kanuj; H1, F1 and S6 belong to Sami. F1 needs H1's baseline; L1 needs H1 and F1; L2 needs L1 and Sami's production readiness. Cross-lane defects become evidence-backed tickets/blockers rather than silent edits.
- **Commerce:** $25/month membership with products separate. C1.5A landed with zero production merchant listings and a test-only Ulta example. C1.5B/C, affiliate work, public Shop, cart and broad commerce automation are parked. Future backend and mobile execution are separate single-owner milestones.
- **H1 boundary:** PR #21 remains a separate Sami workstream at the prior checkpoint. Its live state must be rechecked; V1A does not modify H1.

## 2026-09-20: C1.5A final trust closure on draft PR #23

- **Predecessor**: reviewed draft PR #23 at `4835b78e79c42cf7de2ad5ab3a09b46b79f9ae72`, based on `origin/main@63884e91526437493b001919059e04c7d6c2c878`. H1 PR #21 remains separate and draft at `50ff9fa65d45c3871e759094a196f4054c29ce5e` at re-entry.
- **Orchestrator decision**: The Product → Recommendation → MerchantListing → optional OfferSnapshot → PurchasePath architecture is approved. Remove the live Ulta listing because the merchant and brand ingredient presentations do not prove package/formula equivalence. This does not establish that Ulta sells the wrong formula. Keep the Ulta example in test-only fixture data. The production `CURATED_LISTINGS` is empty; published ADD therefore shows the truthful no-verified-option state.
- **Trust boundary**: Existing `Product.isCatalogStandard?: boolean` is an additive shared Product type field carrying existing database catalog provenance into the client. It does not mean formula-current, merchant-verified or acquisition-ready. Production listing activation requires sufficient merchant destination, product variant and formula evidence; C1.5B official merchant/feed identity and future S6 product/formula resolution can contribute. No new formula-link contract is set in C1.5A.
- **Ownership**: `RemoteDeriveService` keeps its minimal existing `is_catalog_standard` mapping. Database schema, `IDeriveService`, backend migrations, H1, membership Stripe, SMTP, hosted activation, Shopify and S6 implementation remain unchanged. C1.5C Shopify direction remains approved.
- **Validation**: Tests, both TypeScript checks, Expo export, exact-head PR CI and final branch state are separate closure gates; this entry records the decision without predicting their results.

## 2026-09-19: C1.5A multi-merchant acquisition foundation (draft branch)

- **Predecessor**: clean `origin/main@63884e91526437493b001919059e04c7d6c2c878` after fetch. H1 PR #21 remained open and draft at `50ff9fa65d45c3871e759094a196f4054c29ce5e`; its branch was not modified.
- **Decision**: ADR-32 accepts Product/Recommendation/Listing/optional Offer/PurchasePath separation. The member product detail consumes curated Shop-only direct retailer links downstream of a published ADD; no link is attached to provisional or unknown catalog provenance. C1.5B will verify official feed/attribution paths; C1.5C plans a future Derive Shopify merchant. Legitimate alternative retailers remain visible when Derive offers a real product.
- **Narrow existing-field propagation**: Remote already selects `products.is_catalog_standard` but omitted it from the client Product. C1.5A carries that existing boolean as optional `Product.isCatalogStandard`, with missing/false failing closed; no database or commerce service contract change. Demo CeraVe fixture carries explicit trusted provenance. This is necessary to prevent provisional brand/name collisions from receiving purchase links.
- **Initial coverage**: One direct CeraVe Hydrating Facial Cleanser Ulta page with size selector was opened and checked 2026-09-19. A Target page was omitted because its published ingredients conflict with Ulta and the brand page. Product-family identity is not formula/variant verification; members are prompted to check ingredients and size at the retailer. No retailer price, inventory, affiliate IDs or actual purchase tracking is stored. Orders & Refills and Scan remain unchanged.
- **S6 parked**: Sami owns a future shared Product Identity Resolver for Scan and Shelf. Candidate image/label/formula evidence needs provenance and user confirmation; C1.5A adds no S6 implementation.
- **Scope boundary**: No H1, hosted Supabase, migration, physical Stripe checkout, S5 membership, SMTP, retailer feed, Shopify, public Shop/Scan or broad app UI changes. Verification and PR CI are separate final gates; this entry does not predict their outcome.

## 2026-09-19: C1.1 Shop and Scan experience checkpoint

- **Predecessor**: clean `origin/main@953c9295573b7fe8c8bd88a0758c4a00819175c4`; separate H1 PR #21 remains draft at `50ff9fa65d45c3871e759094a196f4054c29ce5e`. C1.1 uses `kanuj/c1-1-shop-scan-experience` in its own worktree.
- **Scope**: Active-member Today and Shop headers expose direct `/shop/scan` actions; Ask's contextual route remains. One canonical scanner, five root tabs, and E1 entitlement remain unchanged. Shop's existing plan hydration distinguishes loading/error/review/covered/needs; product detail composes a presentation-only commerce section. Scan foregrounds the categorical verdict and preserves the full typed Ask handoff.
- **Verification at checkpoint**: Shop state and categorical verdict red/green unit tests passed. A phone-sized Mock preview at 390 and 320 pixels exercised direct Today/Shop/Ask Scan routes, known and unknown product paths, Scan Another, typed Scan to Ask context, covered/ADD/review/loading/error Shop states, and ADD/KEEP/PAUSE/STOP/REPLACE detail semantics. 242 unit tests, both TypeScript checks, web export, and diff check passed. Draft PR CI remains a separate gate.
- **Non-overlap**: No H1 branch changes, hosted Supabase actions, Stripe, SMTP, backend migration, shared contract, membership, public Shop/Scan, ProductOffer, or physical checkout. Sami's parallel app-wide polish remains separate. C1.5 stays unopened.

## 2026-09-19: E1 membership entitlement integration checkpoint

- **Branch / predecessor**: `kanuj/e1-membership-entitlements` from shared `main` at `e661f71c54f67e740c7987f76f2f6dc671603ae2` (CI `35471149916` success). PR and final CI remain separate acceptance gates at this checkpoint.
- **Decision**: Auth identity, onboarding readiness, and canonical membership status are separate. In Remote mode, active membership precedes onboarding and is required for Today, Plan, personalized Shop and Scan, Ask, Progress, Check-In, managed Refills, and routine generation. Inactive accounts route to `/membership`. Mock mode remains billing-free; production Remote remains `false`.
- **Billing authority**: The customer membership screen uses existing S5 Checkout and Portal sessions. Stripe-hosted navigation and local activation-pending UI never assert entitlement. Bounded retries and foreground/web-focus refresh read backend bootstrap; only the signed webhook changes membership.
- **Security and privacy**: Root protected routes deny inactive deep links. Downgrade clears local managed data but retains Auth identity and owner-readable history. E1's additive RLS policies require active membership for new skin-profile, shelf, photo, check-in, refill, and private Storage writes. JWT-gated Edge functions recheck the latest canonical membership before paid onboarding, routine generation, Scan, ordinary Ask, ingredient inference, and Check-In. Emergency Ask safety hard-stop and account deletion remain accessible without managed entitlement.
- **Verification so far**: 236 unit tests, 303 pgTAP assertions, both TypeScript checks, web export, all existing local integration harnesses, local OTP, and the new E1 lifecycle harness passed. A disposable local Remote UI account moved through none, active/incomplete, active/complete, and paused routing; a paused direct Check-In link returned to Membership. Hosted Stripe/Supabase activation smoke remains pending.
- **Unopened**: C1.5 physical-product commerce, public catalog/Shop routing, and general factual Scan.

## 2026-09-19: S5 landing and C1 integration checkpoint

- Shared `main` received S5 membership billing through PR #18 at `1c44e43cbf2e21ca8c454186076c32af50c45180`. Both jobs of resulting CI run `35468937292` passed.
- S5 charges only the server-configured Founding Beta Stripe Price. A later webhook for an older subscription now projects the customer's current Stripe subscription, preserving an active replacement entitlement. Hosted Stripe/Supabase Checkout, signed webhook, and Portal smoke remains pending; production Remote mode remains disabled.
- C1 Shop V1 is implemented on PR #19 with one audience boundary for Mock and Remote membership. Inactive audiences cannot read hydrated member product detail or enter personalized Scan; Today and Plan hide Shop commerce links, and Today/Ask do not advertise an enabled Scan. ADD acquisition and managed refill presentation require a published routine. Mock Scan-to-Ask preserves the scanned verdict.
- Remote sign-in expects a six-digit email OTP. The local Supabase Magic Link template now emits `{{ .Token }}`, with a live local OTP harness in CI. The hosted Supabase email template and OTP length must be set and smoked separately before Remote activation.
- Current Remote routing sends profile-ready inactive members to root tabs. C1 protects Shop, product detail, its Today/Plan commerce links, and Scan; the entitlement policy for other Today, Plan, and Ask capabilities remains a production Remote activation decision. This integration does not change that broader route boundary.
- Physical-product commerce, ProductOffer, product Order schema, provider selection, public catalog activation, and general public Scan remain unopened C1.5 work. Historical entries below retain their original checkpoint claims.

## 2026-09-19 — Kanuj Mobile: C1 Shop V1 Personalized Commerce UX & Architecture (Draft PR)

- **Agent / Workstream**: Kanuj (Customer Experience + Mobile)
- **Local Branch**: `kanuj/c1-shop-v1`
- **Starting Shared HEAD / origin/main**: `d5214e8564a0004f177156552b492aa27c315ed6`
- **Remote Push Status**: draft PR pending push
- **GitHub CI**: pending
- **Milestone Status**: `C1 IMPLEMENTED · DRAFT PR OPEN`; S5 active on PR #18 (`sami/s5-commerce-remote-integration`); C1.5 deferred to post-S5 merge.
- **Ownership / Shared Contracts**: Kanuj-owned mobile changes strictly in `app/**`, `src/components/**`, `src/commerce/**`, `src/services/analytics.ts`, `tests/**`, and docs. Zero modifications to `src/contracts/**`, `src/domain/**`, `src/types/schema.ts`, or backend `supabase/**`.
- **Durable Deliverables**:
  1. Approved 5-tab member navigation implemented: `Today · Plan · Shop · Ask · Progress`. Shop replaces Scan as root tab; Scan is nested as a capability under `/shop/scan` (`app/shop/scan.tsx`).
  2. Single canonical scanner invariant maintained at `app/shop/scan.tsx`. Route compatibility redirect shim at `app/(tabs)/scan.tsx` redirects directly to `/shop/scan`. Ask Scan starter pill navigates directly to `/shop/scan`.
  3. Canonical reusable product detail destination implemented at `app/shop/[productId].tsx`, resolving strictly from hydrated canonical client state (`userProducts` and routine steps). Truthful unavailable fallback; no synthetic param models; no fabricated pricing.
  4. Plan → Shop integration: Products tab links ADD and KEEP items to `/shop/[productId]`. ADD acquisition CTA is strictly suppressed while routine is draft or under review. Subtle "Shop your plan" link in shelf header.
  5. Today contextual integration: surfaces needed-products card strictly when published routine has unconfirmed ADD items (1 item -> product detail; multiple -> Shop tab). Zero cards when plan is covered.
  6. Action-to-commerce semantics formalized in `src/commerce/types.ts` (`resolveActionCommerceSemantics`): ADD eligible only on routine publish/approval; PAUSE/STOP never eligible; KEEP non-urgent in-plan status; REPLACE never sells old product. False offer copy (`Available at checkout`) removed in favor of truthful `Purchase through Derive coming soon`.
  7. Personalized member Shop home (`app/(tabs)/shop.tsx`) with `NEEDED FOR YOUR PLAN`, `YOUR ROUTINE`, `SCAN A PRODUCT`, and `ORDERS & REFILLS`.
  8. Calm empty states: "Your current plan is covered" when no items needed; review pending explainer when routine unconfirmed.
  9. Non-member and guest fallback view models without fabricated routine context or scores.
  10. Comprehensive commerce documentation in `docs/COMMERCE.md` covering audience states, Stripe vs Shopify evaluation, Product/Recommendation/Offer separation, and open business questions.
  11. 28 focused regression tests in `tests/derive.test.ts` verifying commerce invariants, boundary protection, navigation truth, and integration routes (221/221 tests pass).
- **PR Disposition**:
  - Closed superseded PR #17 (`docs(i1-b4): close reconciliation bookkeeping`).
  - Inspected and protected open PR #18 (`sami/s5-commerce-remote-integration` @ `f9e76a1`). C1 isolates physical commerce in draft branch without touching S5 membership billing.
  - Draft PR #19 updated with final closure commit.

## 2026-09-19 — Sami Platform: S5 Membership Commerce & Remote Billing Integration

- **Agent / Workstream**: Sami (Platform, Commerce & Remote Integration)
- **Local Branch**: `sami/s5-commerce-remote-integration`
- **Starting Reconciled S4 Dependency**: `8c02d41` (`sami/s4-founder-operations`, includes origin/main `87c6df5`)
- **Implementation Checkpoints**: `9ebbe5b` (S5 commerce implementation), `c921348` (stacked-PR CI coverage)
- **Remote Push Status**: `pushed / verified` on `origin/sami/s5-commerce-remote-integration`
- **GitHub CI**: `success` (Run ID: `35463849617`; Verify & Build and Database & Integration both passed)
- **Milestone Status**: `S5 IMPLEMENTED LOCALLY · HOSTED STRIPE/SUPABASE TEST-MODE CONFIGURATION PENDING`.
- **Ownership / Shared Contracts**: Sami-owned additive migration, Edge Functions, Remote adapter, integration harness, CI, environment contract, and durable docs. Shared service/domain additions are minimal (`HostedMembershipSession`, checkout/portal methods). Zero changes to Kanuj-owned `app/**` UI.
- **Durable Deliverables**:
  1. Added Stripe-hosted Founding Beta membership Checkout and Billing Portal functions. Both re-verify the authenticated Supabase member; caller-supplied user/customer/price identity is prohibited.
  2. Added a raw-body Stripe-signature webhook for Checkout completion and subscription created/updated/deleted/paused/resumed events. Supabase JWT verification is disabled only for this endpoint because Stripe supplies its own signature.
  3. Added service-role-only atomic membership projection with immutable Stripe binding precedence, normalized-email compatibility fallback, identity-conflict rejection, duplicate-event idempotency, and stale-event ordering protection.
  4. Preserved the canonical price-neutral `founding_beta` tier and three-state customer lifecycle. Stripe Price owns live money; `$25` remains display/config truth and product purchases remain separate.
  5. Added minimal server-only billing evidence columns and a privacy-minimized webhook ledger. Authenticated members cannot read Stripe customer/subscription/price/raw-status columns or webhook records.
  6. Added `RemoteDeriveService.createMembershipCheckout()` and `.createMembershipPortal()` returning validated HTTPS redirects only. Mock billing fails closed. The existing single `EXPO_PUBLIC_USE_REMOTE_SERVICE` flag remains the backend switch.
  7. Added public-only root vs. trusted-server `supabase/.env.example` separation and documented the exact test-mode Stripe/Supabase configuration. No usable credential is committed.
  8. Added S5 unit, pgTAP, authenticated Edge-boundary, and lifecycle integration coverage to CI. Product SKU checkout and full Shop remain deferred.
- **Verification at this checkpoint**:
  - Fresh `supabase db reset`: PASS through S1–S5 migrations.
  - `supabase test db`: 277/277 PASS.
  - `node scripts/test-s5-local.mjs`: all stages PASS without contacting Stripe.
  - `npm test`: 186/186 PASS.
  - `npx tsc --noEmit`: PASS.
  - `npm run typecheck:tests`: PASS.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: PASS.
  - Full S1, I1-B2, S2, S3, S4, S5, and I1-B4B local integration chain: PASS.
  - Unsigned webhook request: deterministic `400 INVALID_SIGNATURE`; unauthenticated checkout: gateway `401`.
- **Decision Status**:
  - `ADR-30: Stripe-Hosted Membership Billing & Webhook-Owned Entitlement`: IMPLEMENTED LOCALLY.
- **Next Work / External Configuration Gate**:
  - Create/link the founders' hosted Supabase project, create the Stripe test-mode recurring Founding Beta Price, store function secrets, deploy S5 functions/migration, and run one real test-mode Checkout → signed webhook → Billing Portal smoke test.
  - Do not enable production Remote mode or live Stripe mode until that hosted test-mode smoke test and cofounder review pass.

## 2026-09-19 — Pre-C1 integration: land cumulative S1–S4 (#16) onto B4 main

- **Agent / Workstream**: Kanuj integration (shared `main`)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `87c6df5c5d889cbb03fe8f9f4535cc5df2091d3c`
- **Integration method**: merged cumulative PR #16 once (`sami/s4-founder-operations` @ `8c02d414cc4a270ac629e7058af0c1dc1f233c14`). Did not merge stacked #13/#14/#15. Did not merge #17.
- **Remote Push Status**: merge commit on `origin/main`
- **GitHub CI**: merge SHA `1a19ea5e9b03f052a593fa28b401874ccf651d84` run `35463159299` SUCCESS
- **Milestone Status**: `S1 COMPLETE`. `S2 COMPLETE`. `S3 COMPLETE`. `S4 COMPLETE`. `I1-B4A COMPLETE`. `I1-B4B COMPLETE`. Next: `S5` (commerce / live Remote). `C1 Shop` not started.
- **Ownership / Shared Contracts**: Sami S1–S4 implementation retained with Kanuj B3.1/B4A/B4B. Commercial truth remains `$25/month` Founding Beta management, products separate, `founding_beta`.
- **Stacked PR disposition**: #13/#14/#15 closed as superseded by #16. #17 left open (docs bookkeeping; actual B4A/B4B already on main).
- **Explicitly NOT done**: C1 Shop; S5 Stripe/live Remote enablement; no membership-model change.

## 2026-09-18 — Sami Platform: S3 Server-Side Intelligence Services

- **Agent / Workstream**: Sami (Platform, Intelligence & Safety Orchestration)
- **Local Branch**: `sami/s3-server-intelligence`
- **Starting S2 Dependency**: `8c66a74` (`sami/s2-core-domain-persistence`, reconciled through S1 `05aa196`)
- **Reconciled origin/main Base**: `cb8a3eb05408c73702bb3dddf9b05beffac8765a`
- **Remote Push Status**: `pending commit / push` (predecessor-based bookkeeping)
- **GitHub CI**: `pending`
- **Milestone Status**: `S3 COMPLETE · REVIEW PENDING`; mobile endpoint wiring and production Remote enablement remain S5/I1.
- **Ownership / Shared Contracts**: Sami-owned Edge Functions, shared function runtime, additive transaction migration, intelligence workflows, tests, CI, and durable docs. Zero changes to `app/**`, `src/domain/**`, `src/contracts/**`, or Kanuj-owned UI. Production Remote mode remains `false`.
- **Durable Deliverables**:
  1. Added JWT-gated `propose-routine`, `scan-product`, `ask-derive`, and `infer-ingredient-signals` Edge Functions with defense-in-depth token verification and canonical server context assembly.
  2. Preserved the provider-neutral `RoutineIntelligenceProvider` boundary for routine generation, including server-only provider selection and a deterministic CI fixture. Scan and Ask use server-side Gemini structured outputs with explicit schemas, timeouts, parsing, sanitized errors, and deterministic post-model validation. All model credentials remain server-only; missing configuration fails closed.
  3. Added mandatory pre-model emergency circuit breakers and privacy-minimized urgent founder tasks. Red-flag Ask requests never call the model and never persist transcript text.
  4. Reused the single canonical B2 routine+shelf transaction instead of retaining a competing S3 overload. Added service-only user-reported product identity resolution, immutable ingredient-signal versioning, and idempotent normalization of sealed B1 onboarding reaction/formula evidence into S2 history without promoting user/model formula claims into trusted catalog truth.
  5. Corrected ingredient overlap semantics: repeated incidents from one product cannot produce a strong multi-product signal; tolerated exposures reduce suspicion; confirmed-allergy status is never synthesized.
  6. Context assembly includes prescriptions, routine/Differin schedule, safety unknown-state provenance, reactions/formulas, signals, check-ins, and private photo metadata. It excludes private Storage paths, signed URLs, image bytes, and client-local URIs from prompts.
  7. Reconciled the independently landed I1-B2.1–B2.3 implementation: preserved provider-neutral routine generation, canonical Remote read adapters, catalog provenance, version-1 replay, S2 immutable history, founder-note privacy, and fail-closed product hydration.
  8. Added S3 unit, pgTAP, and authenticated Edge integration coverage; CI now exercises the complete S1 onboarding, I1-B2 replay, S2 persistence, and S3 intelligence chain on a fresh local Supabase database.
  9. Resolved migration ordering by keeping S2 at `20260919011000_s2_core_domain_persistence.sql` and moving S3 to `20260919040000_s3_intelligence_transactions.sql`, after upstream B2 migrations `20000` and `30000`.
  10. Hardened the canonical routine validator so unresolved/withheld pregnancy state fails closed for retinoids, hydroquinone, and explicitly high-strength salicylic acid, while recognized active prescription schedules must be preserved exactly or clarified.
- **Verification**:
  - `npx supabase db reset`: PASS across S1 + B1/B1.1 + S2 + S3 migrations.
  - `npx supabase test db`: 187/187 PASS.
  - `npx supabase db lint --level warning`: zero findings.
  - `node scripts/test-i1-b1-local.mjs`: all 13 S1 stages PASS.
  - `node scripts/test-i1-b2-local.mjs`: all 8 B2 persistence/replay stages PASS.
  - `node scripts/test-s2-local.mjs`: all 5 S2 stages PASS.
  - `node scripts/test-s3-local.mjs`: all 5 S3 stages PASS.
  - `npm test`: 143/143 PASS.
  - `npx tsc --noEmit`: PASS.
  - `npm run typecheck:tests`: PASS.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: PASS.
- **Decision Status**:
  - `ADR-29: Guarded Server Intelligence & Transactional Model Outputs`: IMPLEMENTED.
  - `ARCHITECTURE_CHALLENGE-01`: still unresolved; no pricing, tier, Stripe, or membership identity changes in S3.
- **Next Work**:
  - Cofounder/agent review of the stacked draft PR, followed by S5/I1 client adapter wiring and a reviewed hosted Supabase deployment with server secrets.
  - Do not enable production Remote mode until the integration slice is reviewed end to end.

## 2026-09-18 — Sami Platform: S2 Core Domain Persistence

- **Agent / Workstream**: Sami (Platform, Persistence & Remote Mapping)
- **Local Branch**: `sami/s2-core-domain-persistence`
- **Starting S1 Dependency**: `a93c802` (`sami/s1-env-contract`)
- **Reconciled origin/main Base**: `0bcfa42`
- **Remote Push Status**: `pending commit / push` (predecessor-based bookkeeping)
- **GitHub CI**: `pending`
- **Milestone Status**: `S2 COMPLETE · REVIEW PENDING`; S3/I1-B2 server intelligence remains next.
- **Ownership / Shared Contracts**: Sami-owned additive database migration, remote service mapping, tests, CI, and durable docs. Zero changes to `app/**`, `src/domain/**`, `src/contracts/**`, or Kanuj-owned UI. Production Remote mode remains `false`.
- **Durable Deliverables**:
  1. Audited the baseline and extended existing tables rather than recreating them.
  2. Added immutable, owner-isolated `formula_snapshots`, `product_reactions`, and versioned `ingredient_signals`.
  3. Added atomic service-only `record_product_reaction`, binding every reaction to the exact historical formula snapshot in the same transaction.
  4. Added `routines.updated_at`, canonical `routine_items.product_id`, unique routine-version identity, immutable routine content/steps, and concurrency-safe `create_routine_version` append semantics.
  5. Enriched catalog, weekly check-in, photo provenance, and refill persistence additively while preserving the sealed B1 onboarding flow.
  6. Implemented full latest-routine header/item assembly in `RemoteDeriveService`, deterministic schedule derivation, explicit refill mapping, and RLS-protected refill writes.
  7. Added a 40-assertion S2 pgTAP suite and a local authenticated API harness that verifies owner isolation, atomic histories, structured check-ins/refills, and state reconstruction from a fresh client session.
- **Verification**:
  - `npx supabase db reset`: PASS.
  - `npx supabase test db`: 136/136 PASS.
  - `npx supabase db lint --level warning`: zero findings.
  - `node scripts/test-i1-b1-local.mjs`: all 13 S1 regression stages PASS.
  - `node scripts/test-s2-local.mjs`: all 5 S2 live API stages PASS.
  - `npm test`: 110/110 PASS.
  - `npx tsc --noEmit`: PASS.
  - `npm run typecheck:tests`: PASS.
- **Decision Status**:
  - `ADR-28: Additive, Append-Only Core Domain Persistence`: IMPLEMENTED.
  - `ARCHITECTURE_CHALLENGE-01`: still unresolved; no pricing or membership identity changes in S2.
- **Next Work**:
  - I1-B2/S3 consumes this substrate for authenticated context assembly, guarded routine generation, shelf-product normalization, and signal inference.
  - Production Remote mode remains disabled until the wider integration slice is complete and reviewed.
## 2026-09-19 — Kanuj: DERIVE I1-B4B Weekly Check-In Context Model, Real Remote Persistence & Longitudinal Read Path

- **Agent / Workstream**: Kanuj (Customer Experience + Mobile) primary with shared-contract + Sami-owned additive `check_ins` migration and `submit-checkin` Edge Function
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `cac1e0508d911a58ed778883f58514b8bfc134cb`
- **Prior Verified CI Run**: `35430738099` (SUCCESS on predecessor I1-B4A)
- **Remote Push Status**: `pending commit / push`
- **GitHub CI**: `pending`
- **Drive Status**: `sync-required`
- **Milestone Status**: `I1-B4A COMPLETE`. `I1-B4B COMPLETE`. `I1-B4 COMPLETE`. Next: `S4 Founder Review / Edit / Publish`. Shop, Stripe, and provider selection remain deferred.
- **Ownership / Shared Contracts**: Shared `CheckIn` / `CheckInInput` / `CheckInContextTag`. Sami-owned additive migration and `submit-checkin`. Kanuj-owned check-in/progress UI and voice fallback gating. Remote progress reads use owner-scoped RLS, not a `get-progress` function.
- **Durable Deliverables**:
  1. Canonical `CheckInContextTag` enum (10 tags) + `CheckInContextTagLabels`. `CheckIn.contextTags` required array; `contextNote` optional. `CheckInInput` both optional. Obsolete unused `changeReason` removed.
  2. Additive migration `20260919081450_i1_b4b_checkin_context.sql`: `context_tags text[] not null default '{}'`, `context_note`, nullable `adherence` (`yes`/`mostly`/`not_really`), nullable `primary_goal` (existing `Goal` values). CHECK on allowed tags, no NULL array entries, 4000-char note limits.
  3. **primaryGoal persistence decision**: persist nullable `primary_goal` because `CheckIn`/`CheckInInput` already treat it as part of the canonical record; this preserves historical goal context if the member's goal changes later. No second goal enum.
  4. **adherence persistence decision**: persist nullable `adherence` so the existing UI field is not discarded on the first real Remote write path. Legacy rows remain NULL; no backfill default.
  5. Real `submit-checkin` Edge Function (`verify_jwt = true` + `auth.getUser()`). Authenticated identity is authoritative; spoofed `userId` fails closed. Deterministic server-authored `ai_analysis_sentence` (no LLM). Context tags never drive causal claims.
  6. `RemoteDeriveService.getProgress()` reads `public.check_ins` via RLS. No `get-progress` Edge Function. `learnedInsights: []` until S3 insight persistence. `recentPhotos: []` until JWT-bound signed photo URLs exist.
  7. Weekly due derived from latest check-in using a 7-day UTC cadence.
  8. Check-in UI: always-on optional multi-select chips + one `VoiceTextArea` `checkin_note`. Production cannot inject canned demo transcripts (`ARCHITECTURE_CHALLENGE_NATIVE_DICTATION` recorded).
- **Explicitly NOT done**: S4 founder review/publish; Shop; Stripe; provider selection; food diary; period tracker; prescription changes; fake learned insights; private photo path leakage.
- **Verification Gates**:
  - `npm test`: 158/158 passing.
  - `npx tsc --noEmit`: 0 errors.
  - `npm run typecheck:tests`: 0 errors.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: clean export.
  - `npx supabase db reset`: applied 10 migrations including `20260919081450_i1_b4b_checkin_context.sql`.
  - `npx supabase test db`: 160/160 pgTAP (5 files).
  - `node scripts/test-i1-b1-local.mjs`: 11/11.
  - `node scripts/test-i1-b2-local.mjs`: 8/8.
  - `node scripts/test-i1-b4b-local.mjs`: passed.
  - `eas.json`: `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"` preserved.
  - S4 / Shop / Stripe not started.

## 2026-09-19 — Kanuj: DERIVE I1-B4A Membership & Separate Product Commerce Model Reconciliation

- **Agent / Workstream**: Kanuj (Customer Experience + Mobile) Primary with shared-contract + Sami-owned additive membership migration
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `c7f0778498f53e2ce34c54d43dc839671f24ed2c`
- **Prior Verified CI Run**: `35429680035` (SUCCESS on predecessor)
- **Remote Push Status**: `pending commit / push`
- **GitHub CI**: `pending`
- **Drive Status**: `sync-required`
- **Milestone Status**: `I1-B4A COMPLETE` (membership $25 display, products separate, `founding_beta` identity, pricing engine removed). `I1-B4B NEXT / NOT IMPLEMENTED`.
- **Ownership / Shared Contracts**: Shared `CustomerProfile.tier` / `MembershipTier`. Sami-owned additive migration on `public.memberships` with no customer write grant change. Kanuj-owned customer copy. No check-in schema/UI (B4B). No Shop. No Stripe.
- **Durable Deliverables**:
  1. `config.betaPriceMonthly = 25` (display/config only; Stripe/S5 owns charged money).
  2. `MembershipTier = 'founding_beta'` on `CustomerProfile`; `membershipDisplayLabel` projects `Founding Beta` in `userStore`.
  3. Additive migration `20260919075053_i1_b4_membership_identity_reconciliation.sql`: fail-closed preflight on unknown/NULL tiers; backfill `founding_beta_129` → `founding_beta`; default `founding_beta`; NOT NULL; CHECK `tier = 'founding_beta'`. `20260915_init.sql` untouched.
  4. Removed `src/pricing/**` (plan-pricing, fixtures, types, index) and all-in tests.
  5. Remote `mapDbCustomerProfile` accepts only `founding_beta`; fails closed on legacy `founding_beta_129` and unknown tiers.
  6. Mock default + onboard profiles use `founding_beta`.
  7. Onboarding / Profile / Orders / Refill copy: membership is Derive management; products purchased separately.
  8. ADR-26 marked implemented; ADR-15 remains SUPERSEDED/HISTORICAL; ADR-21 concierge kept, $100 all-in superseded; ARCHITECTURE_CHALLENGE-01 RESOLVED & IMPLEMENTED.
  9. Commercial-independence invariant recorded in ADR-26 and `docs/SAFETY_PRIVACY.md`.
- **Explicitly NOT done**: B4B check-in tags/note; Shop; Stripe checkout/webhooks; sixth tab; coupons/affiliates; provider selection.
- **Verification Gates**:
  - `npm test`: 146/146 passing.
  - `npx tsc --noEmit`: 0 errors.
  - `npm run typecheck:tests`: 0 errors.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: clean export.
  - `npx supabase db reset`: applied 9 migrations including `20260919075053_i1_b4_membership_identity_reconciliation.sql`.
  - `npx supabase test db`: 138/138 pgTAP (4 files).
  - `node scripts/test-i1-b1-local.mjs`: 11/11.
  - `node scripts/test-i1-b2-local.mjs`: 8/8.
  - `eas.json`: `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"` preserved.
  - B4B not started. Shop/Stripe not started.

## 2026-09-19 — Kanuj: DERIVE I1-B3.1 Client Hardening + I1-B4 Impact Map (Decision Recorded, Not Implemented)

- **Agent / Workstream**: Kanuj (Customer Experience + Mobile) Primary
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `89d69d68cbf174969942c6b95853ec9236edaaf1`
- **Prior Verified CI Run**: pending this push
- **Remote Push Status**: `pending commit / push`
- **GitHub CI**: `pending`
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**:
  - `I1-B3.1 COMPLETE` (client lifecycle hardening only; recorded after verification).
  - `I1-B4 PLANNED / NOT IMPLEMENTED` (membership $25 + separate products + check-in context tags are founder-approved direction; code/schema still $100 / `founding_beta_129` / no context tags).
- **Ownership / Shared Contracts**: Kanuj-owned client (`src/services/deriveClient.ts`, tests) plus docs. No B4A/B4B schema, type, pricing-engine deletion, check-in UI, Shop, or Stripe changes in this pass. Sami-owned `supabase/**` runtime code unchanged.
- **I1-B3.1 Durable Deliverables**:
  1. Cold Remote restart: authenticated + bootstrap `READY` + `onboardingCompleted === true` + failed plan read preserves `routine = null`, `isRoutineBeingPrepared = true`, `isPlanUnderReview = false`, `planHydrationStatus = 'error'`, customer-safe `planHydrationError`.
  2. `ensureInitialRoutineProposal` does not call `proposeRoutine()` when hydration status is `error`. Retry with `planHydrationStatus === 'error'` re-runs hydration even if `isRoutineBeingPrepared` is already true.
  3. In-flight hydration/proposal maps use per-request ownership tokens; `hydratePlanState` is a non-async function that returns the stored Promise so same-user joins keep identity.
  4. `hydrateRoutine()` is a compatibility wrapper over `hydratePlanState()` and hydrates Routine + `UserProduct[]` atomically.
  5. `tests/derive.test.ts` Section 36 covers genuine races (held first+second requests; third join must not increment call/proposal count).
- **I1-B4 Approved Direction (do not treat as shipped)**:
  - Founding Beta membership **$25/month** for Derive managing skincare. Products purchased separately. No routine-derived all-in membership price. Identity `founding_beta_129` → `founding_beta` (additive). ADR-15 SUPERSEDED; ADR-21 pricing portion SUPERSEDED; ADR-26 recorded as approved/not implemented.
  - Check-in: optional multi-select context tags + one optional context note, persisted additively; tags are context not causation; `cycle` is not a period tracker.
- **Explicitly NOT done in this pass**: `config.betaPriceMonthly` still 100; pricing engine still present; no membership or check-in migrations; no Shop; no Stripe; no sixth tab.

### I1-B4 Impact Map (design only)

| Path | Current behavior | Target behavior | Action | Owner | Shared contract? | Migration? | Tests affected | Pass |
|---|---|---|---|---|---|---|---|---|
| `src/constants/config.ts` | `betaPriceMonthly: 100` | `25` display constant; Stripe still S5 | MODIFY | Kanuj | no | no | `tests/derive.test.ts` asserts 100 | B4A |
| `src/domain/types.ts` `CustomerProfile.tier` | `'founding_beta_129'` literal | `'founding_beta'` (+ legacy alias during migrate) | MODIFY | Shared | yes | yes | Mock/Remote/profile tests | B4A |
| `src/types/schema.ts` | no membership enum; CheckIn has unused `changeReason?` | Add `CheckInContextTag`; optional context fields; drop unused `changeReason` or leave unused | MODIFY | Shared | yes | no (TS) | schema/check-in tests | B4A+B4B |
| `src/contracts/DeriveService.ts` | `submitCheckIn(CheckInInput)` unchanged | Input/result include context tags/note | MODIFY | Shared | yes | no | contract tests | B4B |
| `src/pricing/plan-pricing.ts` | $39+$5+product consumption all-in engine | Delete; no independent remaining use | REMOVE | Kanuj | no | no | pricing tests in `tests/derive.test.ts` | B4A |
| `src/pricing/product-pricing-fixtures.ts` | Arthur retail/lifespan fixtures for membership math | Delete with engine | REMOVE | Kanuj | no | no | same | B4A |
| `src/pricing/types.ts` | all-in estimate types | Delete | REMOVE | Kanuj | no | no | same | B4A |
| `src/pricing/index.ts` | barrel export | Delete directory | REMOVE | Kanuj | no | no | same | B4A |
| `app/profile/index.tsx` | shows `$100/mo`; unused `calculateMonthlyPlanPrice`; Arthur `$96/mo` demo copy | `$25/mo`; products-separate copy; remove pricing import; rewrite Arthur copy | MODIFY | Kanuj | no | no | none dedicated | B4A |
| `app/(onboarding)/10-summary.tsx` | `$100` + "OTC products included"; unused pricing import | `$25` + management-only includes | MODIFY | Kanuj | no | no | none dedicated | B4A |
| `app/orders/index.tsx` | "Included with your $100/month" | Membership does not include products; refill is separate commerce | MODIFY | Kanuj | no | no | none dedicated | B4A |
| `app/refill/index.tsx` | no membership price copy | Keep need-based refill; no all-in wording | DEFER | Kanuj | no | no | none | B4A |
| `app/(tabs)/plan.tsx` | KEEP/PAUSE/REPLACE/ADD; no membership price | Commerce entry via Products; no Shop tab | DEFER | Kanuj | no | no | none | DEFERRED |
| `src/services/mock/MockDeriveService.ts` | seeds `tier: 'founding_beta_129'` | `founding_beta`; check-in persist tags/note | MODIFY | Kanuj | yes | no | derive tests | B4A+B4B |
| `src/services/remote/RemoteDeriveService.ts` | profile map requires `founding_beta_129` else null; `submitCheckIn` invokes missing `submit-checkin` fn | Accept `founding_beta` (+ legacy during migrate); map new check-in columns/fn body | MODIFY | Shared (Kanuj adapter / Sami fn) | yes | yes | derive + pgTAP | B4A+B4B |
| `src/services/deriveClient.ts` | `submitWeeklyCheckIn` forwards current input; B3.1 hydration sealed | Pass context tags/note; no pricing change | MODIFY | Kanuj | yes | no | Section 36 stay; new check-in tests | B4B |
| `src/stores/**` | no membership price store; check-ins in routineStore | Hydrate new CheckIn fields | MODIFY | Kanuj | no | no | progress tests | B4B |
| `supabase/migrations/20260915_init.sql` | `tier` default `founding_beta_129`; check_ins has notes only | Never rewrite init; additive later migration | HISTORICAL-PRESERVE | Sami | yes | no | pgTAP historical | HISTORICAL |
| New membership migration (not created) | n/a | `UPDATE` 129→`founding_beta`; default `founding_beta`; preserve IDs/status/Stripe/timestamps | MIGRATE | Sami | yes | yes | pgTAP membership | B4A |
| New check_ins migration (not created) | n/a | `context_tags text[] not null default '{}'`; `context_note text`; keep `notes` | MIGRATE | Sami | yes | yes | pgTAP check_ins | B4B |
| `supabase/migrations/202609160001_s1_auth_rls_private_storage.sql` | insert grant `(user_id, skin_state, irritation, notes)` | Additive grant for `context_tags`, `context_note` | MODIFY | Sami | no | yes | `s1_access_control.test.sql` | B4B |
| `supabase/tests/**` | 126 pgTAP; memberships/check_ins grants | New assertions for default/backfill/grants | MODIFY | Sami | no | yes | pgTAP totals | B4A+B4B |
| `app/check-in/index.tsx` | conditional single-select CHANGE_REASONS; not submitted; TextInput notes | Multi-select chips every check-in; VoiceTextArea context note; remove CHANGE_REASONS | MODIFY | Kanuj | yes | no | new UI/contract tests | B4B |
| `src/components/ui/VoiceTextArea.tsx` | used by Ask composer | Reuse for optional check-in context note | MODIFY | Kanuj | no | no | reuse existing primitive | B4B |
| `app/(tabs)/progress.tsx` | timeline uses `notes` / `aiAnalysisSentence` | Show tags + context note cautiously; no causation copy | MODIFY | Kanuj | no | no | progress tests | B4B |
| `admin/README.md` | `$129/mo` | Historical or update to $25 management | DOC-ONLY | Sami | no | no | none | B4A |
| `AGENTS.md` | documents implemented vs approved | Keep distinguishing until B4A ships | DOC-ONLY | Shared | no | no | none | B4A |
| `docs/CONTEXT_SYNC.md` | this entry | Update to IMPLEMENTED after B4A/B4B | DOC-ONLY | Shared | no | no | none | B4A+B4B |
| `docs/ROADMAP.md` | I1-B4 PLANNED; S4/S5 rescope | Mark B4A/B4B complete only after those passes | DOC-ONLY | Shared | no | no | none | B4A+B4B |
| `docs/PRODUCT.md` / `PROJECT_CONTEXT.md` / `ARCHITECTURE.md` / `README.md` | $25 recorded as approved-not-implemented | Flip to implemented after B4A | DOC-ONLY | Shared | no | no | none | B4A |
| `docs/DECISIONS.md` ADR-15 | SUPERSEDED / HISTORICAL | Keep historical body | HISTORICAL-PRESERVE | Shared | no | no | none | HISTORICAL |
| `docs/DECISIONS.md` ADR-21 | concierge kept; $100 pricing superseded | Keep operational clauses | HISTORICAL-PRESERVE | Shared | no | no | none | HISTORICAL |
| `docs/DECISIONS.md` ADR-26 | approved / not implemented | Mark implemented after B4A | DOC-ONLY | Shared | no | no | none | B4A |
| `docs/RESEARCH.md` | hypotheses updated to $25 / commerce split | Keep N=31 caveats | DOC-ONLY | Shared | no | no | none | B4A |
| `docs/INTERFACES.md` | planned B4 contract note | Implement contract text when types change | DOC-ONLY now | Shared | yes | no | none | B4A+B4B |
| Full Shop / 6th tab | five tabs | Still five tabs | DEFER | Kanuj | no | no | n/a | DEFERRED |
| Stripe checkout / webhooks | planned S5; `webCheckoutUrl` placeholder | $25 membership then product commerce v0 | DEFER | Sami | no | maybe S5 | n/a | DEFERRED |
| Coupons / affiliates / ranking bias | none | Forbidden as silent rank/verdict input | DEFER | Shared | yes (invariant) | no | future invariant tests | DEFERRED |
| Provider/model selection | OPEN / DEFERRED | Still not next required milestone | DEFER | Sami | no | no | n/a | DEFERRED |

- **Verification Gates**:
  - `npm test`: 143/143 passing.
  - `npx tsc --noEmit`: 0 errors.
  - `npm run typecheck:tests`: 0 errors.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: clean export.
  - `npx supabase db reset`: applied existing 8 migrations; no new B4 migrations.
  - `npx supabase test db`: 126/126 pgTAP.
  - `node scripts/test-i1-b1-local.mjs`: 11/11.
  - `node scripts/test-i1-b2-local.mjs`: 8/8.
  - `eas.json`: `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"` preserved.
  - `config.betaPriceMonthly` remains `100`. No membership/check-in schema or pricing-engine deletion.

## 2026-09-19 — Kanuj: DERIVE I1-B3 Provider-Independent Initial Routine Mobile Integration

- **Agent / Workstream**: Kanuj (Customer Experience + Mobile) Primary with Sami Server Boundary Coordination
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `cb8a3eb05408c73702bb3dddf9b05beffac8765a`
- **Prior Verified CI Run**: `35415922852`
- **Remote Push Status**: `pushed` (`faa0885` → `origin/main`)
- **GitHub CI**: `pending` (CI queued after push; run expected on `faa0885`)
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `I1-B3 COMPLETE` (Provider-Independent Initial Routine Mobile Integration: (1) Connected mobile application to consume real B2 initial routine state through shared service boundary; (2) Shared contract updates: added `getUserProducts(userId: string): Promise<UserProduct[]>` and optional `proposeRoutine(input?: RoutineProposalInput): Promise<RoutineProposalResult>` to `IDeriveService`; (3) Service parity: implemented `getUserProducts` and optional `proposeRoutine` in `MockDeriveService` and `RemoteDeriveService`; (4) Routine store state lifecycle: added `isRoutineBeingPrepared`, `planHydrationStatus` (`'idle' | 'loading' | 'ready' | 'error'`), `planHydrationAttempt`, `planHydrationError`, `startPlanHydration()`, `setPlanHydrating()`, `setPlanHydrated()`, `setPlanHydrationError()`, and monotonic `resetRoutine()`; (5) Client coordinators in `src/services/deriveClient.ts`: implemented `hydratePlanState(userId?)` and `ensureInitialRoutineProposal(userId?)` with module-scoped in-flight deduplication (`inFlightHydrations`, `inFlightProposals`), remote session identity freshness, monotonic attempt checking, and restart recovery; (6) Session reset: updated `resetCustomerSessionData` in `src/services/sessionReset.ts` to clear in-flight requests and routine store state; (7) Onboarding flow: wired `app/(onboarding)/10-summary.tsx` to kick off `ensureInitialRoutineProposal` in background upon verified onboarding completion; (8) Calm preparation UI: updated `Today` (`app/(tabs)/index.tsx`) and `Plan` (`app/(tabs)/plan.tsx`) to consume `isRoutineBeingPrepared`, rendering calm preparation status ("Your routine is being prepared", "Initial Routine Setup", "Preparing your routine"), hiding "Start Routine Setup" and refill CTAs, providing empathetic retry affordance on error, and transitioning to `DRAFT · NOT ACTIVE` and real `UserProduct[]` with action badges (`KEEP`, `PAUSE`, `REPLACE`, `ADD`, `STOP`) when proposal arrives; (9) Provider neutrality: client remains 100% provider-independent with zero references to Gemini, OpenAI, Claude, or `ROUTINE_MODEL_PROVIDER`; (10) Verified with 131/131 unit tests, 126/126 pgTAP assertions, strict 0-error TypeScript checks across app and tests, clean Expo web export, and clean local B1/B2 E2E test runs; `eas.json` Remote flag preserved as `false`).
- **Ownership / Shared Contracts**: Kanuj delivered the client integration and coordinated additions to shared contract (`src/contracts/DeriveService.ts`). Sami-owned backend code (`supabase/**`, `supabase/functions/**`, `src/services/ai-workflows/**`) was strictly preserved without modification. Production provider selection remains explicitly `OPEN / DEFERRED` (`ARCHITECTURE_CHALLENGE-05`).
- **Durable Deliverables**:
  1. `src/contracts/DeriveService.ts`: Added `getUserProducts(userId: string): Promise<UserProduct[]>` and optional `proposeRoutine(input?: RoutineProposalInput)`.
  2. `src/services/mock/MockDeriveService.ts`: Implemented `getUserProducts` and optional `proposeRoutine`.
  3. `src/services/remote/RemoteDeriveService.ts`: Updated `proposeRoutine` body handling (`body: input || {}`).
  4. `src/utils/customerErrors.ts`: Added `'routine'` customer-safe error copy.
  5. `src/stores/routineStore.ts`: Added preparation lifecycle fields and attempt-safe actions (`startPlanHydration`, `setPlanHydrating`, `setPlanHydrated`, `setPlanHydrationError`, monotonic `resetRoutine`).
  6. `src/services/deriveClient.ts`: Added `hydratePlanState`, `ensureInitialRoutineProposal`, `clearInFlightHydrations`, `clearInFlightProposals`.
  7. `src/services/sessionReset.ts`: Wired `clearInFlightHydrations` and `clearInFlightProposals`.
  8. `app/(onboarding)/10-summary.tsx`: Wired background `ensureInitialRoutineProposal` kick upon completion.
  9. `app/(tabs)/index.tsx`: Rendered calm preparation card and retry affordance; hid empty setup card when pending.
  10. `app/(tabs)/plan.tsx`: Rendered calm preparation card and products evaluation copy; hid refill CTAs and setup button when pending.
  11. `tests/derive.test.ts`: Added Section 35 test suite covering parity, attempt freshness, identity switch race, pending generation derivation, concurrent deduplication, restart recovery, failure shielding, session reset, and provider neutrality (131/131 passing).
  12. `docs/INTERFACES.md` & `docs/ROADMAP.md`: Documented I1-B3 deliveries and contracts.
- **Verification Gates**:
  - `npm test`: 131/131 passing (100%).
  - `supabase test db`: 126/126 passing across all 3 test suites.
  - `npx tsc --noEmit`: 0 errors.
  - `npm run typecheck:tests`: 0 errors.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: Clean export.
  - `node scripts/test-i1-b1-local.mjs`: All 11 checks passed.
  - `node scripts/test-i1-b2-local.mjs`: All 8 checks passed.
  - `eas.json`: `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"` preserved.

## 2026-09-19 — Sami: DERIVE I1-B2.3 Final Server Boundary Cleanup

- **Agent / Workstream**: Sami (Platform + Intelligence + Operations) Primary with Kanuj Coordination
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `db8d3519c52b48bccdb53a8477a669ada9030333`
- **Prior Verified CI Run**: `35415174587`
- **Remote Push Status**: `pending commit / push`
- **GitHub CI**: `pending`
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `I1-B2.3 COMPLETE` (Final Server Boundary Cleanup: (1) Removed filesystem provider fallback and founder-machine paths (`.server-provider-config`, `/Users/kanuj/`, `Deno.readTextFile`) from `supabase/functions/propose-routine/provider.ts` and test harnesses; provider resolves strictly from `ROUTINE_MODEL_PROVIDER` process env or `public.server_runtime_config` table, failing closed with 503 `MODEL_UNAVAILABLE` when unconfigured; (2) Restored least privilege on `commit_routine_proposal` RPC via additive migration `20260919030000_i1_b2_restore_rpc_security_invoker_and_catalog_protection.sql`: redefined as `SECURITY INVOKER` with `set search_path = ''` and fully-qualified schema references, removing unnecessary `SECURITY DEFINER` and deprecated `auth.role()` check; explicit ACL strictly revokes execution from PUBLIC, anon, and authenticated, granting to service_role; (3) Hardened catalog provenance: provisional provider-proposed products (`is_catalog_standard = false`) persist only minimal review identity (`brand`, `name`, `category`) with empty `key_actives`, empty `full_ingredients`, and null `retail_price_approx`, preventing progressive accumulation of hallucinated formula facts across subsequent proposals; (4) Maintained catalog standard protection: trusted products (`is_catalog_standard = true`) retain verified category, key_actives, full_ingredients, and retail_price_approx against untrusted provider outputs; (5) Hardened confirmation fail-closed semantics in `RemoteDeriveService.getUserProducts`: null/unknown `is_confirmed_by_user` strictly resolves to `false` (`=== true`), eliminating fabricated confirmation; (6) Verified with 126/126 pgTAP assertions, 122/122 unit tests, clean strict TypeScript checks across app and tests, clean Expo web export, and clean local B1 and B2 E2E test runs; `eas.json` Remote flag strictly preserved as `false`).
- **Ownership / Shared Contracts**: Sami closed all server boundary cleanups. Kanuj's mobile UI and shared contracts (`src/contracts/**`, `src/domain/**`, `src/types/schema.ts`) remain unmodified. Production provider selection remains explicitly `OPEN / DEFERRED` (`ARCHITECTURE_CHALLENGE-05`). Kanuj's provider-independent mobile integration is now fully unblocked.
- **Durable Deliverables**:
  1. `supabase/functions/propose-routine/provider.ts`: Strict server-only resolution (process env or `server_runtime_config`), zero filesystem lookup.
  2. `supabase/migrations/20260919030000_i1_b2_restore_rpc_security_invoker_and_catalog_protection.sql`: `commit_routine_proposal` restored to `SECURITY INVOKER` with `search_path = ''`, no `auth.role()`, provisional product formula protection, and explicit ACL.
  3. `supabase/functions/propose-routine/index.ts`: Provisional catalog payload sets empty `key_actives: []`.
  4. `src/services/remote/RemoteDeriveService.ts`: `isConfirmedByUser: row.is_confirmed_by_user === true` (fail-closed on null).
  5. `tests/derive.test.ts`: Added Section 31 tests verifying fail-closed confirmation, server-only provider resolution, and zero filesystem paths (122/122 passing).
  6. `supabase/tests/i1_b2_routine_persistence.test.sql`: Added assertions for `SECURITY INVOKER`, public execute denial, trusted product formula immutability, and provisional product formula non-accumulation (126/126 passing).
  7. `scripts/test-i1-b2-local.mjs`: Cleaned up filesystem config path references.
- **Verification Gates**:
  - `npm test`: 122/122 passing (100%).
  - `supabase test db`: 126/126 passing across all 3 test suites.
  - `npx tsc --noEmit`: 0 errors.
  - `npm run typecheck:tests`: 0 errors.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: Clean export.
  - `node scripts/test-i1-b1-local.mjs`: All 11 checks passed.
  - `node scripts/test-i1-b2-local.mjs`: All 8 checks passed.
  - `eas.json`: `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"` preserved.

## 2026-09-19 — Sami: DERIVE I1-B2.2 Provider-Neutral Intelligence Boundary, Catalog Provenance & Trust Closure

- **Agent / Workstream**: Sami (Platform + Intelligence + Operations) Primary with Kanuj Coordination
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `397aa80c8eea707277160c3c13d297a72e7736e4`
- **Prior Verified CI Run**: `35413476239`
- **Remote Push Status**: `pushed to main`
- **GitHub CI**: `35415174587 (SUCCESS)`
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `I1-B2.2 COMPLETE` (Provider-Neutral Intelligence Boundary, Catalog Provenance & Trust Closure: (1) Decoupled routine intelligence into a provider-neutral interface `RoutineIntelligenceProvider` with `providerId` and `generateProposal(context)`; (2) Recorded production model selection as explicitly `OPEN / DEFERRED` under `ARCHITECTURE_CHALLENGE-05` in `docs/DECISIONS.md`; (3) Eliminated client-controllable provider defect: `x-routine-fixture` header removed from CORS and server routing; customer requests can never select a provider; (4) Governed provider selection strictly via server runtime configuration: `ROUTINE_MODEL_PROVIDER` process env or `public.server_runtime_config` table restricted to `service_role`; (5) Isolated deterministic `FixtureRoutineProvider` for reproducible CI and local E2E; (6) Refactored Gemini into optional `GeminiRoutineProvider` adapter with header authentication `x-goog-api-key` [zero key in URL params] and structured outputs; (7) Hardened context assembly in `context.ts` against exact canonical domain enums matching `src/types/schema.ts`, secondary goals, and whitespace product identity, failing closed with `400 INTAKE_CONTEXT_INVALID` without fabricating defaults; (8) Added additive migration `20260919020000_i1_b2_catalog_provenance_and_confirmation_preservation.sql` protecting trusted catalog standard products from being overwritten by model metadata and defaulting new products to `is_catalog_standard = false` with empty formula fields; (9) Implemented post-model sensitivity evaluation `validateSensitivities` failing closed on unverified formulas when sensitivities are reported and rejecting known allergens; (10) Clarified and enforced `is_confirmed_by_user` semantics: existing shelf items retain `true` across actions while newly recommended `ADD` products are `false`; (11) Verified with 119/119 unit tests, 119/119 pgTAP assertions, local B1 and B2 E2E test suites, clean TypeScript check, and clean Expo web export).
- **Ownership / Shared Contracts**: Sami delivered the provider-neutral architecture, database migration, and provenance hardening. Kanuj's mobile UI and shared contracts (`src/contracts/**`, `src/domain/**`, `src/types/schema.ts`) remain strictly unmodified. Pricing (`ARCHITECTURE_CHALLENGE-01`) and model selection (`ARCHITECTURE_CHALLENGE-05`) preserved as deferred. `eas.json` Remote flag strictly preserved as `false`.
- **Durable Deliverables**:
  1. **Provider-Neutral Edge Function Layer (`supabase/functions/propose-routine/`)**:
     - `types.ts`: Defined `RoutineIntelligenceProvider` interface.
     - `provider.ts`: Implemented `resolveRoutineProvider(supabaseAdmin)` checking process env, secure `public.server_runtime_config`, or local config file; fails closed with `503 MODEL_UNAVAILABLE` when unconfigured.
     - `fixture-provider.ts`: Implemented `FixtureRoutineProvider` and `createDeterministicTestProposal`.
     - `gemini-adapter.ts`: Implemented `GeminiRoutineProvider` with header authentication (`x-goog-api-key`).
     - `context.ts`: Enforces exact canonical enums matching `src/types/schema.ts`, secondary goals, and non-empty brand/name; fails closed (`INTAKE_CONTEXT_INVALID`).
     - `validator.ts`: Added `validateSensitivities` evaluating unverified formulas and sensitized ingredients.
     - `index.ts`: Zero client-controlled fixture header, catalog standard overwrite protection, and confirmation provenance preservation.
  2. **Additive Migration (`supabase/migrations/20260919020000_i1_b2_catalog_provenance_and_confirmation_preservation.sql`)**:
     - `commit_routine_proposal` RPC: Protects `is_catalog_standard = true` products from metadata overwrites; defaults new products to `is_catalog_standard = false` with empty formula fields; preserves `is_confirmed_by_user = true` across action updates.
     - `public.server_runtime_config`: Service-role-only configuration table for server-side runtime settings.
  3. **Verification & Test Coverage**:
     - `tests/derive.test.ts`: Added Section 30 tests covering provider interface, header auth, non-canonical enum rejection, and sensitivity validation (119/119 passing).
     - `supabase/tests/i1_b2_routine_persistence.test.sql`: Added assertions 18-23 covering catalog provenance, confirmation preservation, and `server_runtime_config` permissions (119/119 passing).
     - `scripts/test-i1-b2-local.mjs`: Hardened Step 5A (client fixture attempt returns 503) and Step 5B (server-configured fixture returns 200) and Step 6 (confirmation preservation check).
- **Verification Gates**:
  - `npm test`: 119/119 passing (100%).
  - `supabase test db`: 119/119 passing across all 3 test suites.
  - `npx tsc --noEmit`: 0 errors.
  - `npm run typecheck:tests`: 0 errors.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: Clean export.
  - `node scripts/test-i1-b1-local.mjs`: All 11 checks passed.
  - `node scripts/test-i1-b2-local.mjs`: All 8 checks passed.
  - `eas.json`: `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"` preserved.

## 2026-09-19 — Sami: DERIVE I1-B2.1 Real Model Intelligence, Trust Semantics & Error-Boundary Closure

- **Agent / Workstream**: Sami (Platform + Intelligence + Operations) Primary with Kanuj Coordination
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `23f8bee6c1f0b4d89fef730d1d2749f4d85f86e6`
- **Prior Verified CI Run**: `35410180444`
- **Remote Push Status**: `pending commit / push`
- **GitHub CI**: `pending`
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `I1-B2.1 COMPLETE` (Real Model Intelligence, Trust Semantics & Error-Boundary Closure: (1) Integrated real Gemini structured output provider with `gemini-3.8-flash` via Google AI Studio REST endpoint using `generationConfig.responseMimeType = "application/json"` and `generationConfig.responseSchema = GEMINI_PROPOSAL_RESPONSE_SCHEMA`; (2) Removed hardcoded branded product generator fallbacks [Vanicream, La Roche-Posay, EltaMD mock generators removed], failing closed with `503 MODEL_UNAVAILABLE` when model credentials or network are absent; (3) Single source of intelligence logic: deduplicated types, invariants, context assembly, and Gemini provider between `src/services/ai-workflows/routine-intelligence.ts` and `supabase/functions/propose-routine/`; (4) Enforced trust semantics: persisted AI-generated product recommendations in `public.user_products` with `is_confirmed_by_user = false` while preserving user-confirmed shelf audit products; (5) Hardened customer-safe error boundary: strictly returning typed domain codes [`UNAUTHORIZED`, `INTAKE_NOT_COMMITTED`, `INTAKE_CONTEXT_INVALID`, `MODEL_UNAVAILABLE`, `MODEL_OUTPUT_INVALID`, `CLARIFICATION_REQUIRED`, `VALIDATION_FAILED`, `PERSISTENCE_FAILED`, `INTERNAL_ERROR`], shielding clients from stack traces, table names, Postgres internals, SQL constraints, or LLM provider errors; (6) Fail-closed context assembly: invalid or missing `Goal` or `RoutineComplexity` fails closed with `400 INTAKE_CONTEXT_INVALID` without fabricating arbitrary default values; (7) Isolated deterministic test seam `createDeterministicTestProposal` under test semantics [`x-routine-fixture: 'true'` header or `ROUTINE_FIXTURE_MODE = 'true'`] for CI and local test harnesses; (8) Updated `tests/derive.test.ts` with 4 new tests [114/114 passing] and updated `scripts/test-i1-b2-local.mjs` verifying model unavailability [503] without fixture and successful routine generation with fixture; (9) Verified 114/114 unit tests, 113/113 pgTAP assertions, 0 TypeScript errors across app and tests, clean Expo web export, and `eas.json` Remote flag strictly `false`).
- **Ownership / Shared Contracts**: Sami delivered the server-side intelligence provider, error boundary, and trust semantics. Kanuj's mobile UI and shared contracts (`src/contracts/**`, `src/domain/**`, `src/types/schema.ts`) remain strictly unmodified. Pricing (`ARCHITECTURE_CHALLENGE-01`) preserved as unresolved. `eas.json` Remote flag preserved as `false`.
- **Durable Deliverables**:
  1. **Modular Edge Function Architecture (`supabase/functions/propose-routine/`)**:
     - `types.ts`: Self-contained, portable TypeScript interfaces (`AssembledRoutineContext`, `RoutineProposalStep`, `RoutineProposalProductDecision`, `CanonicalCatalogProduct`, `RoutineIntelligenceProposal`, `RoutineErrorCode`, `RoutineErrorResponse`).
     - `validator.ts`: Deterministic invariant validator enforcing Sunscreen AM invariant, Retinoid PM invariant, pregnancy/nursing contraindications, action enums, category enums, day enums, step required fields, and catalog linkage.
     - `context.ts`: `assembleCanonicalContext` with fail-closed validation checking canonical enums (`Goal`, `RoutineComplexity`, `ProductCostPreference`, `MiddayFeel`) and returning `INTAKE_CONTEXT_INVALID` without fabricating defaults.
     - `gemini-provider.ts`: Production provider `callGeminiProposalProvider(context, apiKey, modelName)` calling Google AI Studio REST endpoint with `gemini-3.8-flash` structured output, bounded error logging, and isolated deterministic test seam `createDeterministicTestProposal`.
     - `index.ts`: Customer-safe error responder, gateway JWT verification, committed intake check, replay idempotency, test seam support, validation, unconfirmed product decision persistence, and atomic RPC commitment.
  2. **Code Deduplication (`src/services/ai-workflows/routine-intelligence.ts`)**:
     - Re-exports all shared types, validator, context assembler, and Gemini schemas from `supabase/functions/propose-routine/`.
     - Aliases `generateContextGroundedProposal = createDeterministicTestProposal` for automated test suites.
  3. **Trust Semantics & Error Boundary Hardening**:
     - Persists `user_products` recommendations with `is_confirmed_by_user: false`.
     - Error responder shields raw database/internal errors, emitting only typed domain codes with empathetic, customer-safe Mineral copy.
  4. **Verification & Regression Defenses**:
     - `scripts/test-i1-b2-local.mjs`: Added Stage 5A verifying `503 MODEL_UNAVAILABLE` when key/fixture is missing (proves zero fake fallback), Stage 5B verifying proposal generation with fixture, and Stage 6 verifying `is_confirmed_by_user === false`.
     - `tests/derive.test.ts`: Added Section 29 verifying fail-closed context assembly, schema definitions, provider error handling, trust semantics, and absence of stack traces.
- **Verification Gates**:
  - `npm test`: 114/114 passing (100%).
  - `supabase test db`: 113/113 passing across all 3 test suites.
  - `npx tsc --noEmit`: 0 errors.
  - `npm run typecheck:tests`: 0 errors.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: Clean export.
  - `node scripts/test-i1-b1-local.mjs`: All 11 checks passed.
  - `node scripts/test-i1-b2-local.mjs`: All checks passed (including 5A model unavailability and 5B fixture proposal).
  - `eas.json`: `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"` preserved.

## 2026-09-18 — Sami & Kanuj: DERIVE I1-B2 Server-Side Initial Routine Intelligence, Canonical Product Normalization & Awaiting-Review Persistence

- **Agent / Workstream**: Sami (Platform + Intelligence + Operations) Primary with Kanuj Coordination
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `0bcfa42a76fb5ec1dfaf56c69cb35ab0588bd3cc`
- **Prior Verified CI Run**: `35410180444` (on commit `0bcfa42`)
- **Remote Push Status**: `pending commit / push`
- **GitHub CI**: `pending`
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `I1-B2 COMPLETE` (Server-Side Routine Intelligence, Canonical Product Normalization & Awaiting-Review Persistence: (1) Created additive PostgreSQL migration `20260919010000_i1_b2_routine_intelligence_and_persistence.sql` adding `routines.updated_at TIMESTAMPTZ` with `private.set_updated_at()` trigger, unique constraint `routines_user_id_version_unique UNIQUE (user_id, version)`, unique index on `products (lower(trim(brand)), lower(trim(name)))`, `routine_items.product_id UUID REFERENCES products(id)`, `user_products.user_product_idx UNIQUE (user_id, product_id) WHERE product_id IS NOT NULL`, select grant on `updated_at` to `authenticated` while strictly preserving `founder_notes` as internal to founder review operations, and atomic transactional RPC `commit_routine_proposal` restricted to `service_role`; (2) Created pgTAP test suite `supabase/tests/i1_b2_routine_persistence.test.sql` with 17 assertions, verifying 113/113 database tests passing across the 3 test suites; (3) Created Edge Function `supabase/functions/propose-routine/` with platform gateway JWT verification, uncommitted intake fail-closed defense, context assembly from `skin_profiles` and intake `payload_snapshot`, replay idempotency returning existing version-1 routine without duplicate writes, deterministic validation of AM/PM invariants [no AM retinoids, no PM sunscreen] and pregnancy contraindications, atomic persistence RPC invocation, and read-back; (4) Implemented `RemoteDeriveService.getRoutine(userId)` and `getUserProducts(userId)` assembling canonical domain structures with deterministic `scheduleText` derivation; (5) Created and verified repeatable local E2E test harness `scripts/test-i1-b2-local.mjs` exercising gateway auth rejection, uncommitted fail-closed rejection, full B1 intake commit, proposal generation, relational DB verification, replay idempotency, and authenticated client queries; (6) Added `test-i1-b2-local.mjs` to `.github/workflows/ci.yml`; (7) Verified 110/110 unit tests, 113/113 pgTAP assertions, 0 TypeScript errors across app and tests, and clean Expo web export).
- **Ownership / Shared Contracts**: Sami delivered the server-side intelligence pipeline, additive database migration, Edge Function, and Remote service read assembly. Kanuj's mobile components and shared contracts (`src/contracts/**`, `src/domain/**`, `src/types/schema.ts`) remain strictly unmodified. Pricing (`ARCHITECTURE_CHALLENGE-01`) preserved as unresolved. `eas.json` Remote flag preserved as `false`.
- **Durable Deliverables**:
  1. **Additive Database Migration (`supabase/migrations/20260919010000_i1_b2_routine_intelligence_and_persistence.sql`)**:
     - `public.routines`: added `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, trigger `routines_set_updated_at` calling `private.set_updated_at()`, unique constraint `routines_user_id_version_unique UNIQUE (user_id, version)`.
     - `public.products`: added `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, unique index `products_brand_name_idx ON public.products (lower(trim(brand)), lower(trim(name)))`.
     - `public.routine_items`: added `product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT`.
     - `public.user_products`: added unique index `user_products_user_product_idx UNIQUE (user_id, product_id) WHERE product_id IS NOT NULL`.
     - Granted `SELECT (updated_at)` on `public.routines` to `authenticated`; strictly retained security boundary denying client access to `founder_notes`.
     - Atomic transactional RPC `public.commit_routine_proposal(...)` executed exclusively by `service_role`.
  2. **Deterministic Validation & Routine Intelligence (`src/services/ai-workflows/routine-intelligence.ts`)**:
     - `validateRoutineProposal()` enforces Sunscreen AM invariant (no PM sunscreen), Retinoid PM invariant (no AM retinoids), pregnancy/nursing contraindication exclusions, action enums (`KEEP`, `PAUSE`, `REPLACE`, `ADD`, `STOP`), category enums, and required step fields.
     - Dynamic context-grounded proposal generation formulating barrier-supportive routines from committed intake data and shelf audits.
  3. **Edge Function (`supabase/functions/propose-routine/`)**:
     - Configured with `verify_jwt = true` in `supabase/config.toml`.
     - Fails closed on uncommitted intake (`400 INTAKE_NOT_COMMITTED`).
     - Idempotent replay handling for existing version-1 routine.
     - Assembles context, executes proposal logic, runs deterministic validation, calls `commit_routine_proposal` RPC, and returns canonical payload in status `awaiting_review`.
  4. **`RemoteDeriveService` Implementation (`src/services/remote/RemoteDeriveService.ts`)**:
     - `getRoutine(userId)`: reads `routines` + `routine_items`, partitions into `amSteps` and `pmSteps`, derives `scheduleText` via `formatRoutineStepSchedule`, and returns typed `RoutinePlan`.
     - `getUserProducts(userId)`: reads `user_products` joined with `products` and returns typed `UserProduct[]` with nested `Product`.
  5. **pgTAP Database Test Suite (`supabase/tests/i1_b2_routine_persistence.test.sql`)**:
     - 17 test assertions covering schema extensions, triggers, client denial, RPC privileges, `awaiting_review` status, version uniqueness, and task updates.
  6. **Local Full-Stack E2E Test Harness (`scripts/test-i1-b2-local.mjs`)**:
     - 8 verification stages covering gateway JWT verification, uncommitted fail-closed, complete B1 onboarding commit, initial routine generation, relational persistence and FK integrity, replay idempotency, and authenticated client queries.
- **Verification Gates**:
  - `npm test`: 110/110 passing (100%).
  - `supabase test db`: 113/113 passing across all 3 test suites.
  - `npx tsc --noEmit`: 0 errors.
  - `npm run typecheck:tests`: 0 errors.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: Clean export.
  - `node scripts/test-i1-b1-local.mjs`: All 11 checks passed.
  - `node scripts/test-i1-b2-local.mjs`: All 8 checks passed.
  - `eas.json`: `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"` preserved.

## 2026-09-18 — Kanuj & Sami: Final I1-B2 Handoff Schema-Contract Gap Correction

- **Agent / Workstream**: Kanuj & Sami Shared Alignment (Contract Truth & Schema Realignment)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `b3d4fb1f3e5e2db8769556eef1061343c402387b`
- **Prior Verified CI Run**: `35408550278` (on commit `b3d4fb1`)
- **Remote Push Status**: `pending commit / push` (Predecessor-based bookkeeping; zero self-referencing predicted commit loops)
- **GitHub CI**: `pending`
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `I1-B2 FINAL SCHEMA-CONTRACT RECONCILIATIONS FLAGGED` (Docs-only correction pass recording the final five schema-contract reconciliations and factual schema alignments for the I1-B2 server handoff: (1) Removed false `skin_profiles.pih_tendency` column from all documentation, establishing that PIH signal is preserved in `public.onboarding_submissions.payload_snapshot.pihTendencyAnswer`; (2) Flagged `B2_REQUIRED_SCHEMA_RECONCILIATION` for `public.routines.updated_at TIMESTAMPTZ` via an additive Sami migration to satisfy canonical `Routine.updatedAt`; (3) Flagged `B2_REQUIRED_SCHEMA_RECONCILIATION` for `public.routine_items.product_id UUID REFERENCES public.products(id)` via an additive Sami migration to satisfy canonical `RoutineStep.productId`; (4) Documented `RoutineStep.scheduleText` as deterministically derivable from `timing` + `days` using `formatRoutineStepSchedule` in `src/types/schema.ts` without adding a redundant column; (5) Flagged `B2_REQUIRED_PERSISTENCE_INVARIANT` requiring every B2-decided product to be normalized in `public.products` so `user_products JOIN products` resolves canonical `UserProduct.product: Product`; (6) Detailed the required `RemoteDeriveService.getRoutine()` read-assembly mapper across headers, items, and products; (7) Reinforced `public.founder_review_tasks.status` check constraint limits [`pending`, `completed`, `dismissed`]; and (8) Reconfirmed zero code changes across `app/**`, `src/**`, `supabase/**`, `admin/**`, and `tests/**` with strict preservation of founder ownership boundaries).
- **Ownership / Shared Contracts**: Coordinated documentation updates (`docs/INTERFACES.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/CONTEXT_SYNC.md`). Zero code changes across `app/**`, `src/**`, `supabase/**`, `admin/**`, or `tests/**`. Pricing (`ARCHITECTURE_CHALLENGE-01`) preserved as unresolved. `eas.json` Remote flag preserved as `false`.
- **Durable Deliverables**:
  1. **Removal of False `skin_profiles.pih_tendency`**:
     - `public.skin_profiles` does NOT contain `pih_tendency`.
     - Post-inflammatory hyperpigmentation tendency is captured during onboarding and durably preserved in `public.onboarding_submissions.payload_snapshot.pihTendencyAnswer`.
     - Context assembly for B2 must read `payload_snapshot.pihTendencyAnswer` (or canonical `skin_profiles.pih_score` / `pih_history_notes` if populated in later migrations).
  2. **`B2_REQUIRED_SCHEMA_RECONCILIATION`: Add `updated_at` to `public.routines`**:
     - Canonical `Routine` (`src/types/schema.ts`) requires `createdAt: string` and `updatedAt: string`.
     - Current PostgreSQL schema has `created_at` and `published_at`, but lacks `updated_at`.
     - Sami must add `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` to `public.routines` via an additive B2 migration, accompanied by a `BEFORE UPDATE` trigger executing `private.set_updated_at()`.
  3. **`B2_REQUIRED_SCHEMA_RECONCILIATION`: Add `product_id` to `public.routine_items`**:
     - Canonical `RoutineStep` (`src/types/schema.ts`) requires `productId: string`.
     - Current `public.routine_items` table stores product metadata by value (`product_name`, `brand`, `category`, etc.) without a `product_id` foreign key.
     - Sami must add `product_id UUID REFERENCES public.products(id)` to `public.routine_items` via an additive B2 migration.
  4. **Derivability of `RoutineStep.scheduleText`**:
     - Canonical `RoutineStep.scheduleText` is an optional display string (e.g., `"Daily (AM)"`, `"3x / week (PM)"`).
     - It can and should be derived deterministically during database-to-domain mapping from `timing` and `days` using `formatRoutineStepSchedule(timing, days)` from `src/types/schema.ts`, avoiding redundant database storage.
  5. **`B2_REQUIRED_PERSISTENCE_INVARIANT`: Canonical Product Resolution for `UserProduct`**:
     - Canonical `UserProduct` requires a full nested `product: Product` object (`id`, `brand`, `name`, `category`, `keyActives`).
     - Storing only `detected_brand` and `detected_name` in `public.user_products` cannot satisfy this contract.
     - Preferred invariant: for B2-generated routine and shelf recommendations, every decided product is normalized into `public.products`, and `public.user_products.product_id` references that row, allowing `user_products JOIN products` to hydrate canonical `UserProduct`. Existing nullable `product_id` remains for shelf items awaiting normalization.
  6. **Full Remote Routine Read Assembly**:
     - `RemoteDeriveService.getRoutine(userId)` currently reads only the `routines` table header.
     - Sami's B2 implementation must query `routines`, join or fetch `routine_items` (ordered by `order_index`), and assemble `amSteps` and `pmSteps` conforming to `Routine`.
     - Kanuj's `hydrateRoutine()` (`src/services/deriveClient.ts`) will consume this assembled structure without client contract changes.
  7. **Preserved Boundaries & Invariants**:
     - Sami Primary: Server-side intelligence pipeline, Gemini structured outputs, relational routine persistence, additive migrations, routine read assembly, founder ops.
     - Kanuj: Downstream mobile hydration, draft indicator rendering, non-blocking tab navigation, customer-safe error handling.
     - Sealed B1/B1.1 directives remain locked.
- **Verification**:
  - `npm test`: 100/100 passing (100%).
  - `npx tsc --noEmit`: 0 errors.
  - `npm run typecheck:tests`: 0 errors.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: Clean export.
  - `eas.json`: `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"` strictly preserved.

## 2026-09-18 — Kanuj & Sami: I1-B2 Handoff Contract-Truth Correction

- **Agent / Workstream**: Kanuj & Sami Shared Alignment (Contract Truth & Schema Realignment)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `de507dda2dd45d46845d7bd22a0f958058f1eb0f`
- **Prior Verified CI Run**: `35403266620` (on commit `de507dd`)
- **Remote Push Status**: `pushed` (`b3d4fb1f3e5e2db8769556eef1061343c402387b`)
- **GitHub CI**: `35408550278 — SUCCESS`
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `I1-B2 CONTRACT TRUTH ALIGNED` (Docs-only correction pass aligning B2 intelligence handoff documentation with actual repository implementation truth across TypeScript contracts, PostgreSQL schemas, and Remote service limits: resolved discrepancy 1 by restoring `RoutineProposalInput` to actual TypeScript fields [`primaryGoal`, `secondaryGoals?`, `routineComplexity`, `costPreference?`, `middayFeel?`, `postCleanseTightness?`, `activePrescriptions?`, `isPregnantOrNursing?`], distinguishing it from richer server-side context available in `public.skin_profiles` [`pregnancy_status`, `sensitivities_status`, `known_sensitivities`]; resolved discrepancy 2 by eradicating fictitious `rationales` property from `Routine`, clarifying that step reasoning belongs on `RoutineStep` via `whyChosen`; resolved discrepancy 3 by correcting `public.routine_items` database shape to actual columns [`order_index`, `timing`, `product_name`, `brand`, `category`, `amount`, `area`, `days`, `purpose`, `why_chosen`, `watch_for`], removing non-existent column references; resolved discrepancy 4 by explicitly recording the `RemoteDeriveService.getRoutine()` read-assembly dependency, noting it currently queries only the `routines` table header without assembling `routine_items` into `amSteps`/`pmSteps`; resolved discrepancy 5 by clarifying that `InitialRoutineState` is a shared domain type in `OnboardingResult` rather than a persisted DB column; resolved discrepancy 6 by correcting `public.founder_review_tasks` statuses to actual schema [`pending`, `completed`, `dismissed`], eliminating fictional `awaiting_review` task status; and established explicit three-way distinction between Current Shared Contract, Current Database Contract, and B2 Desired Semantics).
- **Ownership / Shared Contracts**: Coordinated documentation updates (`docs/INTERFACES.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/CONTEXT_SYNC.md`). Zero code changes across `app/**`, `src/**`, `supabase/**`, `admin/**`, or `scripts/**`. Pricing (`ARCHITECTURE_CHALLENGE-01`) preserved as unresolved. `eas.json` Remote flag preserved as `false`.
- **Durable Deliverables**:
  1. **RoutineProposalInput Contract Truth**:
     - Current TypeScript contract (`src/domain/types.ts`): `profile` includes `primaryGoal`, `secondaryGoals?`, `routineComplexity`, `costPreference?`, `middayFeel?`, `postCleanseTightness?`, `activePrescriptions?`, `isPregnantOrNursing?`.
     - It does NOT include `pregnancyStatus` or `sensitivitiesStatus`.
     - Richer safety context (`pregnancy_status`, `sensitivities_status`, `known_sensitivities`) is available server-side in `public.skin_profiles` and `onboarding_submissions.payload_snapshot` JSONB.
     - Any future addition of these fields to `RoutineProposalInput` is explicitly documented as a future coordinated shared-contract change.
  2. **Routine Output Contract Truth**:
     - Canonical `Routine` (`src/types/schema.ts`) has NO `rationales` property.
     - Personalized reasoning lives strictly on individual `RoutineStep` items via `whyChosen`, `purpose`, `watchFor?`, and `scheduleText?`.
  3. **`public.routine_items` Database Shape Truth**:
     - Actual PostgreSQL schema (`supabase/migrations/20260915_init.sql`): `id`, `routine_id`, `order_index`, `timing` (`'am'` | `'pm'`), `product_name`, `brand`, `category`, `amount`, `area`, `days` (`TEXT[]`), `purpose`, `why_chosen`, `watch_for`, `created_at`.
     - Eliminated non-existent columns (`step_name`, `step_order`, `frequency`, `step_type`, `product_id`). Any relational schema changes belong to Sami's B2 additive migrations.
  4. **Remote Routine Read Assembly Dependency**:
     - `RemoteDeriveService.getRoutine(userId)` currently reads only the `routines` table header and does not assemble `routine_items` into `amSteps` and `pmSteps`.
     - B2 server scope explicitly includes implementing this read assembly mapper.
     - Kanuj's `hydrateRoutine()` in `deriveClient.ts` is the downstream client consumer once Remote assembly is implemented.
  5. **`InitialRoutineState` Durability Clarification**:
     - `InitialRoutineState` (`'pending_generation'` | `'awaiting_review'`) is returned in `OnboardingResult` and is not a persisted DB column.
     - Prior to proposal, no routine exists in `public.routines` $\to$ client conceptual state is `pending_generation`.
     - After proposal persistence, routine exists with `status = 'awaiting_review'` $\to$ client derives `awaiting_review` (`isPlanUnderReview: true`).
  6. **`public.founder_review_tasks` Status Truth**:
     - Supported PostgreSQL check constraint statuses: `'pending'`, `'completed'`, `'dismissed'`.
     - There is NO `'awaiting_review'` or `'in_review'` task status in PostgreSQL today.
     - Initial routine review task is created and maintained in `'pending'` status; any routine linking via foreign key requires a Sami-owned additive migration.
  7. **Three-Way Distinction Codified**:
     - A. Current Shared Contract (TypeScript today)
     - B. Current Database Contract (PostgreSQL today)
     - C. B2 Desired Semantics (Sami implementation targets; any contract/schema additions noted as future work)
  8. **Preserved Boundaries**:
     - Sami Primary: Server-side context assembly, model invocation, routine persistence, shelf action normalization, routine-item read assembly, founder ops.
     - Kanuj: Downstream client hydration, quiet draft preview, non-blocking navigation, customer-safe error sanitization.
     - All B1/B1.1 DO NOT REIMPLEMENT directives remain sealed.
- **Verification**:
  - `npm test`: 100/100 passing (100%).
  - `npx tsc --noEmit`: 0 errors.
  - `npm run typecheck:tests`: 0 errors.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: Clean export.
  - `eas.json`: `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"` strictly preserved.

## 2026-09-18 — Sami Platform: S1 Platform Foundation Complete

- **Agent / Workstream**: Sami (Platform Foundation, Private Data Lifecycle & Environment Security)
- **Local Branch**: `sami/s1-env-contract`
- **Starting Shared HEAD / origin/main**: `de507dda2dd45d46845d7bd22a0f958058f1eb0f`
- **Final Reconciled origin/main Base**: `b3d4fb1` (I1-B2 contract-truth correction preserved before checkpoint)
- **Remote Push Status**: `pending commit / push` (Predecessor-based bookkeeping; zero self-referencing predicted commit loops)
- **GitHub CI**: `pending`
- **Milestone Status**: `S1 COMPLETE` (Consolidated the already-landed migration/RLS/auth/onboarding platform with the final environment, private-photo delivery, and account-deletion controls; production Remote mode remains deliberately disabled.)
- **Ownership / Shared Contracts**: Sami-owned platform, service configuration, Edge Functions, tests, and durable documentation only. Zero changes to Kanuj-owned UI and zero changes to `src/domain/types.ts`. `ARCHITECTURE_CHALLENGE-01` pricing remains unresolved; no new price semantics were introduced.
- **Durable Deliverables**:
  1. **Fail-Closed Mobile Environment Contract**: Added `src/config/environment.ts` with static Expo environment references, exact boolean parsing, HTTPS/local URL validation, canonical `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, a transitional legacy anon-key fallback, and rejection of secret or malformed canonical keys. Remote mode refuses to initialize without valid public client values.
  2. **Public-Only Template & Runtime Documentation**: Reduced root `.env.example` to the three approved public mobile names and documented the separate Expo, CLI/CI, local Edge, and trusted-server credential boundaries in `docs/ENVIRONMENT.md`. Stripe and PostHog remain outside S1.
  3. **Persistent Auth Compatibility Preserved**: Reconciled the environment resolver with the current `AsyncStorage` Supabase client, app-lifecycle refresh, and authenticated Remote client path; no rollback of the landed I1 Auth spine.
  4. **JWT-Bound Private Photo Delivery**: Added `photo-url` with platform `verify_jwt = true` plus handler `auth.getUser()` verification, caller-owned `user_photos` lookup, canonical path validation, no caller-supplied identity/path authority, exact 900-second signing, and private/no-store response caching. Hosted signed origins are unchanged; local internal `kong` URLs are rewritten only to an explicit or loopback public local Supabase origin.
  5. **Storage-First Account Deletion**: Added `delete-customer-account` with platform and handler JWT verification, exact destructive confirmation, unexpected-field rejection, recursive caller-namespace inventory, bounded deletion, empty-namespace verification, and Auth-user deletion strictly last so relational cascades cannot orphan private Storage objects.
  6. **Canonical Upload Boundary**: Removed the obsolete arbitrary/upserting photo uploader. The established onboarding uploader remains the sole client upload helper, restricted to server-issued paths in `customer-skin-photos` with `upsert: false`.
  7. **Regression & Full-Stack Proof**: Expanded unit/static guards for the environment allowlist and S1 endpoint invariants, and extended the local full-stack harness through owner/cross-owner signing, exact TTL, signed-object retrieval, identity-spoof rejection, destructive-confirmation enforcement, complete Storage cleanup, Auth deletion ordering, and other-member isolation.
- **Verification**:
  - `npm test`: 105/105 passing.
  - `npx tsc --noEmit`: 0 errors.
  - `npm run typecheck:tests`: 0 errors.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: clean export.
  - `npx supabase db reset`: clean rebuild through the full additive migration chain.
  - `npx supabase test db`: 96/96 pgTAP assertions passing.
  - `node scripts/test-i1-b1-local.mjs`: all 13 S1 full-stack stages passing.
  - `eas.json`: `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"` strictly preserved.

## 2026-09-18 — Kanuj & Sami: B1.1 Final Coordination & Sami I1-B2 Intelligence Handoff

- **Agent / Workstream**: Kanuj & Sami Shared Coordination (Platform Intelligence Handoff & Boundary Alignment)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `9a056bd42748257ff72474c7a8785fe4a613e90d`
- **Prior Verified CI Run**: `35399275112` (on commit `9a056bd`)
- **Remote Push Status**: `pushed` (`de507dda2dd45d46845d7bd22a0f958058f1eb0f`)
- **GitHub CI**: `35403266620 — SUCCESS` (on commit `de507dd`)
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `B1/B1.1 CLOSED & SEALED · I1-B2 HANDOFF ESTABLISHED` (Formal handoff from closed B1/B1.1 onboarding persistence to Sami's I1-B2 server intelligence stream: established explicit coordination rules and boundary definitions to prevent duplicate work or premature implementation; verified that B1/B1.1 mechanisms are fully landed, passing 100/100 unit tests, 96/96 pgTAP assertions, and clean CI 35399275112; audited existing routine intelligence prototypes and categorized server vs. client responsibilities; documented the DO NOT REIMPLEMENT canonical mechanisms; framed the I1-B2 input and output contracts; defined the normalization dependencies for product reactions, formula snapshots, and ingredient signals; and reaffirmed ARCHITECTURE_CHALLENGE-01 as unresolved so B2 does not encode commercial pricing).
- **Ownership / Shared Contracts**: Coordinated documentation updates (`docs/ROADMAP.md`, `docs/CONTEXT_SYNC.md`, `docs/ARCHITECTURE.md`, `docs/INTERFACES.md`). Zero code changes across `app/**`, `src/**`, `supabase/**`, `admin/**`, or `scripts/**`. Pricing (`ARCHITECTURE_CHALLENGE-01`) preserved as unresolved. `eas.json` Remote flag preserved as `false`.
- **Durable Deliverables**:
  1. **Canonical B1/B1.1 Mechanisms Sealed ("DO NOT REIMPLEMENT")**:
     - **Private Photo Bucket**: `customer-skin-photos` is an image-only private bucket with member-isolated path prefix (`<userId>/<angle>/<uuid>.jpg`) and `upsert: false`. Zero client signing, listing, or public URLs.
     - **Platform Gateway JWT Verification**: `supabase/config.toml` enforces `verify_jwt = true` on `prepare-onboarding` and `onboard-customer`, rejecting unauthenticated traffic at the edge. Handlers enforce `auth.getUser()` caller UUID derivation.
     - **Staging Ledger (`public.onboarding_submissions`)**: Tracks draft and committed intake states with partial unique indexes on `(user_id) WHERE status = 'draft'` and `WHERE status = 'committed'`. Isolated to `service_role`.
     - **Atomic Transactional Finalization (`public.commit_onboarding_intake`)**: Atomic PostgreSQL function executing with `SECURITY INVOKER` by `service_role`. Locks submission row `FOR UPDATE`, upserts `skin_profiles` with `onboarding_completed: false`, records `user_photos` idempotently (`ON CONFLICT (storage_path) DO NOTHING`), ensures pending `initial_routine` review task, sets `skin_profiles.onboarding_completed = true` strictly last, and marks submission `committed`.
     - **Review Task Idempotency**: `public.founder_review_tasks` enforces partial unique index on `(user_id, task_type) WHERE task_type = 'initial_routine' AND status = 'pending'`.
     - **Photo Metadata Idempotency**: Unique constraint on `public.user_photos (storage_path)`.
     - **Pure Payload Builder**: `buildOnboardingPayload` in `src/services/deriveClient.ts` captures safety provenance (`pregnancy_status`, `sensitivities_status`) and prevents unanswered states from collapsing to false negatives.
     - **Post-Commit Bootstrap Coordinator**: `app/(onboarding)/10-summary.tsx` invokes `resolveCustomerBootstrap(activeUserId)` on Supabase session identity, requiring `status === 'READY'` before navigation.
     - **Decoupled Status Semantics**: `pending_generation` (`isPlanUnderReview: false`, "Your routine is being prepared.") vs `awaiting_review` (`isPlanUnderReview: true`, "Final review").
     - **Replay Idempotency**: `onboard-customer` replays committed result without duplicate relational writes; `prepare-onboarding` resumes committed intake.
     - **CI Automation**: GitHub Actions `database` job runs official Supabase CLI with pgTAP and local E2E harness (`scripts/test-i1-b1-local.mjs`).
  2. **Explicit Sami B2 Server Scope (Platform & Intelligence)**:
     - Context assembly: Ingest intake context from `public.onboarding_submissions.payload_snapshot` and canonical `public.skin_profiles` (`pregnancy_status`, `sensitivities_status`, midday feel, tightness, goals, prescriptions, reactions, photo metadata).
     - Model execution: Server-side Gemini 2.5 Flash invocation using server secrets (zero client keys) with structured JSON output enforcing canonical schema.
     - Clinical & safety rules: Sunscreen AM invariant (sunscreens never in evening), Retinoid PM invariant (differin/tretinoin never in morning), and pregnancy/sensitivity contraindications.
     - Relational persistence: Persist routine proposal into `public.routines` (`version = 1`, `status = 'awaiting_review'`) and `public.routine_items`.
     - Shelf action normalization: Normalize shelf products into `public.user_products` with canonical actions (`KEEP`, `PAUSE`, `REPLACE`, `ADD`, `STOP`).
     - Review task progression: Transition or associate initial routine review task in `public.founder_review_tasks` for founder review.
  3. **Explicit Kanuj Client Role (Mobile & UX)**:
     - Hydrate routine via `hydrateRoutine()` in `src/services/deriveClient.ts`.
     - When `status === 'awaiting_review'`, set `isPlanUnderReview: true` and render quiet draft preview mode (`DRAFT · NOT ACTIVE` indicator) on Today and Plan tabs.
     - Preserve non-blocking navigation across Today, Plan, Scan, Ask, and Progress.
     - Zero client-side Gemini execution or direct schema modifications.
  4. **Status of Normalization Dependencies**:
     - `product_reactions`: Currently staged in `onboarding_submissions.payload_snapshot` JSONB. Relational normalization table planned for S2.
     - `formula_snapshots`: Staged in `payload_snapshot` JSONB. Relational normalization table planned for S2.
     - `ingredient_signals`: Pure inference logic exists in `src/services/ai-workflows/ingredient-intelligence.ts`. Server-side execution and persistence planned for S3.
  5. **Pricing Challenge Preservation**:
     - `ARCHITECTURE_CHALLENGE-01` remains `PROPOSED · UNRESOLVED`. I1-B2 routine intelligence must NOT assume or hardcode `$129` or resolve commercial pricing semantics.
- **Verification**:
  - `npm test`: 100/100 passing (100%).
  - `npx tsc --noEmit`: 0 errors.
  - `npm run typecheck:tests`: 0 errors.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: Clean export.
  - `eas.json`: `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"` strictly preserved.

## 2026-09-18 — Kanuj & Sami: I1-B1.1 Transactional Intake Finalization, Auth Gate & Canonical Post-Commit Routing

- **Agent / Workstream**: Kanuj & Sami Shared Integration (Platform Transactional Finalizer, Edge Gateway & Client State Routing)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `cebff0c56a1bf46720a1b8aef4b4ea44e74d9a0e`
- **Prior Verified CI Run**: `35397943476` (on commit `cebff0c`)
- **Remote Push Status**: `pushed` (`9a056bd42748257ff72474c7a8785fe4a613e90d`)
- **GitHub CI**: `35399275112 — SUCCESS` (on commit `9a056bd`)
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `I1-B1.1 COMPLETE · CLOSED & SEALED` (Transactional intake finalization, platform JWT gate, and canonical post-commit routing: resolved Finding 1 by introducing atomic PostgreSQL finalization function `public.commit_onboarding_intake` executed by `service_role` inside a single database transaction, guaranteeing atomic rollback upon any mid-finalization error; resolved Finding 2 by implementing response-loss and replay idempotency across `onboard-customer` and `prepare-onboarding` with partial unique index on `onboarding_submissions (user_id) WHERE status = 'committed'` and `user_photos (storage_path)`; resolved Finding 3 by enabling platform gateway JWT verification `verify_jwt = true` in `supabase/config.toml` while retaining handler-level `auth.getUser()` defense in depth; resolved Finding 4 by replacing raw bootstrap checks in `app/(onboarding)/10-summary.tsx` with production coordinator `resolveCustomerBootstrap(activeUserId)` requiring `status === 'READY'`; resolved Finding 5 by decoupling `pending_generation` [`isPlanUnderReview: false`, "Your routine is being prepared."] from `awaiting_review` [`isPlanUnderReview: true`, "Final review"]; hardened concurrent draft insert races; added committed local E2E test harness `scripts/test-i1-b1-local.mjs`; added automated Supabase database & integration job to GitHub Actions CI; verified via 96/96 pgTAP assertions and 100/100 unit tests).
- **Ownership / Shared Contracts**: Coordinated transactional database migration (`supabase/migrations/20260918230000_transactional_intake_and_replay_idempotency.sql`), pgTAP test suite (`supabase/tests/i1_b1_onboarding_intake.test.sql`), Edge Functions (`prepare-onboarding`, `onboard-customer`), client coordinator (`src/services/deriveClient.ts`), Summary screen (`app/(onboarding)/10-summary.tsx`), CI workflow (`.github/workflows/ci.yml`), and committed test script (`scripts/test-i1-b1-local.mjs`). Pricing (ARCHITECTURE_CHALLENGE-01) strictly preserved as unresolved. `eas.json` Remote flag strictly preserved as `false`.
- **Architectural Deliverables**:
  1. **Additive Database Migration (`20260918230000_transactional_intake_and_replay_idempotency.sql`)**:
     - Created partial unique index `onboarding_submissions_committed_user_idx` on `(user_id) WHERE status = 'committed'`.
     - Created unique index `user_photos_storage_path_idx` on `public.user_photos (storage_path)`.
     - Enforced photo path check constraints on `onboarding_submissions` (`front`, `left`, `right`, and `shelf` matching caller UUID prefixes and folder categories).
     - Created atomic transactional RPC `public.commit_onboarding_intake`: locks submission `FOR UPDATE`, handles already-committed submissions idempotently, upserts `skin_profiles` (`onboarding_completed: false`), records `user_photos` idempotently (`ON CONFLICT (storage_path) DO NOTHING`), ensures exactly one pending `initial_routine` review task, sets `skin_profiles.onboarding_completed = true` strictly last, marks submission `committed`, and returns canonical profile. Revoked `EXECUTE` from `PUBLIC`, `anon`, and `authenticated`; granted exclusively to `service_role`.
  2. **Platform Gateway JWT Verification & Edge Function Hardening**:
     - Set `verify_jwt = true` in `supabase/config.toml` for `prepare-onboarding` and `onboard-customer`.
     - Retained handler `auth.getUser()` caller UUID derivation; caller identity cannot be spoofed via request body or cross-user submission IDs.
     - Sanitized error codes (`UNAUTHORIZED`, `INVALID_PAYLOAD`, `PHOTO_VERIFICATION_FAILED`, `NO_ACTIVE_DRAFT`, `ONBOARDING_COMMIT_FAILED`, `INTERNAL_ERROR`), never leaking database or schema internals to mobile.
     - `prepare-onboarding` resumes existing committed intake without creating duplicate drafts, and recovers from concurrent draft insert races (`23505`) by re-querying the winning draft.
     - `onboard-customer` recognizes already-committed submissions and replays the canonical result without repeating relational writes.
  3. **Canonical Post-Submit Bootstrap Coordinator**:
     - `app/(onboarding)/10-summary.tsx` invokes `resolveCustomerBootstrap(activeUserId)` on the active authenticated Supabase session user.
     - Confirms `profileExists === true`, `onboardingCompleted === true`, and `useBootstrapStore.getState().status === 'READY'` before app transition.
  4. **Truthful Status Semantics**:
     - `pending_generation`: sets `routine: null`, `userProducts: []`, `isPlanUnderReview: false`, and `todayDominantStatus: 'Your routine is being prepared.'`.
     - `awaiting_review`: sets `isPlanUnderReview: true` and `todayDominantStatus: 'Final review: Your first routine gets one final quality check before it goes live.'`.
  5. **Committed Local E2E Test Harness (`scripts/test-i1-b1-local.mjs`)**:
     - Exercises full lifecycle: platform JWT gate (401), test user creation, `prepare-onboarding`, cross-user rejection, missing photos check, direct Storage upload (`upsert: false`), transactional rollback on invalid input, atomic commit, response-loss replay idempotency, prepare resumption, and single committed submission constraint.
  6. **Automated Database CI Gate (`.github/workflows/ci.yml`)**:
     - Added `database` job running `supabase/setup-cli@v1` (pinned to 2.117.0), `supabase start`, `supabase db reset`, `supabase test db`, and `node scripts/test-i1-b1-local.mjs`.
- **Verification**:
  - `npm test`: 100/100 tests passing (100%).
  - `npx supabase test db`: 96/96 assertions passing (100%).
  - `node scripts/test-i1-b1-local.mjs`: All 11 verification steps passing (100%).
  - `npx tsc --noEmit`: 0 errors.
  - `npm run typecheck:tests`: 0 errors.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: Clean export.
  - `eas.json`: `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"` strictly preserved.

## 2026-09-18 — Kanuj & Sami: I1-B1 Authenticated Remote Onboarding Intake Commit & Private Photo Pipeline

- **Agent / Workstream**: Kanuj & Sami Shared Integration (Platform Persistence, Edge Functions & Mobile Pipeline)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `e8c0f88b08c7d1973971bea8bbd0deee8b6e468c`
- **Prior Verified CI Run**: `35392766598` (on commit `e8c0f88`)
- **Remote Push Status**: `pending commit / push` (Predecessor-based bookkeeping; zero self-referencing predicted commit loops)
- **GitHub CI**: `pending`
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `I1-B1 COMPLETE` (First authenticated Remote write integration: established Colima container runtime and verified real local Supabase Postgres; implemented additive database migration `20260918213146_onboarding_intake_submission_and_idempotency.sql` creating `public.onboarding_submissions` and partial unique indexes for draft uniqueness and `founder_review_tasks` initial routine review idempotency; created and verified `prepare-onboarding` and `onboard-customer` Edge Functions; implemented private photo upload helper `uploadPhotoToStorage` enforcing `customer-skin-photos` and `upsert: false`; evolved `OnboardingResult` to support `proposedRoutine: null` and `initialRoutineState: 'pending_generation'` without routine generation in B1; enriched `OnboardingPayload` with formula snapshots, adaptive follow-ups, PIH tendency, and bad reactions; verified client screen `10-summary.tsx` and stores handle null routines and re-resolve bootstrap truth before navigating in Remote mode; and validated via 83 pgTAP assertions and 97 unit tests).
- **Ownership / Shared Contracts**: Coordinated additive shared contracts update (`src/domain/types.ts`). Additive database migration (`supabase/migrations/20260918213146_onboarding_intake_submission_and_idempotency.sql`) and dedicated pgTAP test suite (`supabase/tests/i1_b1_onboarding_intake.test.sql`). Edge Functions (`supabase/functions/prepare-onboarding/index.ts`, `supabase/functions/onboard-customer/index.ts`). Client photo upload helper (`src/services/onboardingPhotoUpload.ts`), Remote service implementation (`src/services/remote/RemoteDeriveService.ts`), client coordinator hardening (`src/services/deriveClient.ts`), and summary screen bootstrap verification (`app/(onboarding)/10-summary.tsx`). Pricing (ARCHITECTURE_CHALLENGE-01) strictly preserved as unresolved. `eas.json` Remote flag strictly preserved as `false`.
- **Architectural Deliverables**:
  1. **Additive Database Migration (`20260918213146_onboarding_intake_submission_and_idempotency.sql`)**:
     - Created `public.onboarding_submissions`: internal intake staging ledger storing opaque storage paths and sanitized intake snapshots (`payload_snapshot JSONB`) with partial unique index ensuring a single active draft per member (`WHERE status = 'draft'`). RLS enabled; all privileges revoked from `anon` and `authenticated`, restricted to `service_role`.
     - Attached `private.set_updated_at()` trigger.
     - Added partial unique index to `public.founder_review_tasks (user_id, task_type) WHERE task_type = 'initial_routine' AND status = 'pending'`, ensuring idempotency across retried submissions.
  2. **Supabase Edge Functions (`prepare-onboarding` & `onboard-customer`)**:
     - `prepare-onboarding`: Authenticates caller JWT via `supabase.auth.getUser()`, derives immutable user UUID from token, retrieves existing active draft or creates a new draft in `onboarding_submissions`, generates server-issued storage paths (`<userId>/<angle>/<uuid>.jpg`), checks existing Storage objects for upload retry/resumption, and returns upload targets.
     - `onboard-customer`: Authenticates caller JWT, enforces safety consistency (rejects pregnancy and sensitivity contradictions with HTTP 400), verifies Storage existence of required photos (`front`, `left`, `right`, and optional `shelf`), sanitizes snapshot (stripping local `file:///` URIs), commits `onboarding_submissions` to `committed`, upserts `skin_profiles` with `onboarding_completed: false`, records `user_photos` rows, idempotently inserts pending `initial_routine` founder review task, and **strictly last** sets `skin_profiles.onboarding_completed = true`.
  3. **Shared Contracts & Domain Types**:
     - Added `InitialRoutineState = 'pending_generation' | 'awaiting_review'`.
     - Evolved `OnboardingResult`: `proposedRoutine: Routine | null`, `initialRoutineState: InitialRoutineState`.
     - Enriched `OnboardingPayload`: `formulaSnapshots`, `adaptiveFollowUps`, `pihTendencyAnswer`, `hasBadReactions`, `skinPhotos.shelfUri`.
  4. **Private Photo Pipeline (`src/services/onboardingPhotoUpload.ts`)**:
     - Implemented `uploadPhotoToStorage(storagePath, localUri, client)` uploading directly to `customer-skin-photos` at server-issued path with `upsert: false`. Detects MIME types (`image/jpeg`, `image/png`, `image/webp`) and throws on error, never persisting local URIs.
  5. **RemoteDeriveService & Client Integration**:
     - Implemented 3-stage `onboard(payload)` pipeline in `RemoteDeriveService.ts`: `prepare-onboarding` -> upload photos -> `onboard-customer` (sanitizing local URIs).
     - Hardened `submitOnboarding()` in `src/services/deriveClient.ts` to safely handle `proposedRoutine: null` and `initialRoutineState: 'pending_generation'` without dereferencing `status`, and preserve proven remote membership status.
     - Updated `app/(onboarding)/10-summary.tsx` to re-resolve `CustomerBootstrapState` and verify `onboardingCompleted === true` before navigating with `router.replace('/(tabs)')` in Remote mode.
  6. **Comprehensive Verification**:
     - Colima container runtime active on host; real local Supabase Postgres, GoTrue, Storage, and Edge Runtime running cleanly.
     - 83/83 pgTAP assertions passing across `s1_access_control.test.sql` and `i1_b1_onboarding_intake.test.sql`.
     - Scratch integration test executed successfully against live local Supabase stack verifying test user authentication, `prepare-onboarding`, storage photo uploads, `onboard-customer` commit, and database records.
     - 97/97 unit tests passing in `tests/derive.test.ts`.
- **Verification**:
  - `npm test`: 97/97 tests passing (100%).
  - `npx supabase test db`: 83/83 assertions passing (100%).
  - `npx tsc --noEmit`: 0 errors.
  - `npm run typecheck:tests`: 0 errors.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: Clean export.
  - `eas.json` strictly preserves `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"`.

## 2026-09-18 — Kanuj & Sami: I1-B0 Onboarding Persistence Contract & Safety Alignment

- **Agent / Workstream**: Kanuj & Sami Shared Alignment (Mobile Client, Shared Contracts & Platform Persistence)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `80b5bb859be1adbc3aeb4b295ee4b7e0f80f46b2`
- **Prior Verified CI Run**: `35391183013` (on commit `80b5bb8`)
- **Remote Push Status**: `pending commit / push` (Predecessor-based bookkeeping; zero self-referencing predicted commit loops)
- **GitHub CI**: `pending`
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `I1-B0 COMPLETE` (Onboarding persistence contract & safety alignment: resolved ARCHITECTURE_CHALLENGE-02 by adding explicit categorical status fields `pregnancy_status` and `sensitivities_status` across database, contracts, store, and UI to prevent unanswered/withheld states from collapsing into false negatives; resolved ARCHITECTURE_CHALLENGE-03 by aligning `public.user_products.action` check constraint to accept `PAUSE` alongside `KEEP`, `REPLACE`, `ADD`, and `STOP`; implemented pure payload builder `buildOnboardingPayload` with fail-closed non-mock identity protection in Remote mode; preserved legacy fields for backward compatibility; and verified via 92/92 unit tests and 71 pgTAP test assertions).
- **Ownership / Shared Contracts**: Coordinated additive shared contracts update (`src/types/schema.ts`, `src/domain/types.ts`). Additive migration (`supabase/migrations/20260918203554_onboarding_safety_status_and_action_pause.sql`) and expanded pgTAP tests (`supabase/tests/s1_access_control.test.sql`). Client updates (`src/stores/onboardingStore.ts`, `src/services/deriveClient.ts`, `src/services/mock/MockDeriveService.ts`, `app/(onboarding)/8-safety.tsx`, `app/(onboarding)/10-summary.tsx`, `tests/derive.test.ts`). Pricing (ARCHITECTURE_CHALLENGE-01) strictly preserved as unresolved. `eas.json` Remote flag strictly preserved as `false`.
- **Architectural Deliverables**:
  1. **Additive Database Migration (`20260918203554_onboarding_safety_status_and_action_pause.sql`)**:
     - `public.skin_profiles`: added `pregnancy_status` (`CHECK in ('yes', 'no', 'prefer_not_to_say', 'unanswered')`) and `sensitivities_status` (`CHECK in ('none_known', 'reported', 'unanswered')`), `NOT NULL`, default `'unanswered'`.
     - Conservative epistemic backfill: `is_pregnant_or_nursing IS TRUE` $\rightarrow$ `'yes'`, else `'unanswered'` (never infers explicit negative); non-empty `known_sensitivities` $\rightarrow$ `'reported'`, else `'unanswered'`.
     - Least-privilege column grants for insert and update granted to `authenticated` role on `public.skin_profiles`.
     - `public.user_products`: updated `user_products_action_check` constraint to `CHECK (action in ('KEEP', 'PAUSE', 'REPLACE', 'ADD', 'STOP'))`.
  2. **Shared Canonical Schema & Domain Contracts**:
     - `src/types/schema.ts`: added `PregnancyStatusSchema`, `PregnancyStatus`, `SensitivitiesStatusSchema`, `SensitivitiesStatus`; updated `SkinProfile` to include `sensitivitiesStatus` and `pregnancyStatus`.
     - `src/domain/types.ts`: re-exported status types; updated `OnboardingPayload.safetyContext` to include `sensitivitiesStatus` and `pregnancyStatus`.
  3. **Pure Payload Builder & Remote Identity Protection (`src/services/deriveClient.ts`)**:
     - Exported `buildOnboardingPayload(onboardingState, userId?, overrideRemote?)`.
     - Preserves safety provenance and provides safe fallbacks.
     - In Remote mode, fails closed and throws if `userId` is missing, empty, or a mock ID (`usr_beta_member`, `usr_beta_001`).
     - In Mock mode, permits fallback to `'usr_beta_member'`.
  4. **Client State & UI Non-Coercion**:
     - `src/stores/onboardingStore.ts`: updated `OnboardingState` and `setSafetyContext` parameter/default types to `SensitivitiesStatus` and `PregnancyStatus`, defaulting omitted values to `'unanswered'`.
     - `app/(onboarding)/8-safety.tsx`: `hasNoSensitivities` initialized strictly to `sensitivitiesStatus === 'none_known'`; `pregnancyState` initialized strictly to `pregnancyStatus`; rendered active sensitivity chips.
     - `app/(onboarding)/10-summary.tsx`: display copy shows `'Not answered'` for unanswered pregnancy and sensitivities states; refactored to use `buildOnboardingPayload`.
  5. **Mock Service Compatibility**:
     - `src/services/mock/MockDeriveService.ts`: `onboard()` preserves `sensitivitiesStatus` and `pregnancyStatus` on the returned `SkinProfile`.
  6. **Comprehensive Test Verification**:
     - `supabase/tests/s1_access_control.test.sql`: expanded plan to 71 assertions; verified authenticated column grants, `skin_profiles` defaults, constraint violations, and `user_products.action` `PAUSE` acceptance.
     - `tests/derive.test.ts`: 92/92 tests passing (100%), including 6 dedicated tests for initial unanswered state, safety screen initialization non-coercion, explicit choices, summary display copy, pure payload builder, remote mock identity protection, and mock service preservation.
- **Verification**:
  - `npm test`: 92/92 tests passing (100%).
  - `npx tsc --noEmit`: 0 errors.
  - `npm run typecheck:tests`: 0 errors.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: Clean export.
  - `eas.json` strictly preserves `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"`.
  - Database runtime verification: Docker daemon absent on host (`DATABASE_RUNTIME_VERIFICATION_BLOCKED`).

## 2026-09-18 — Kanuj Mobile/UX: I1-A2.1 Bootstrap Freshness & Founder Surface Isolation

- **Agent / Workstream**: Kanuj (Mobile Client, UX & Prototyping)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `f57b5c908f369bc601e3ddbd08501d2405a9ec2c`
- **Prior Verified CI Run**: `35386770475` (on commit `f57b5c9`)
- **Remote Push Status**: `pending commit / push` (Predecessor-based bookkeeping; zero self-referencing predicted commit loops)
- **GitHub CI**: `pending`
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `I1-A2.1 COMPLETE` (Bootstrap freshness and founder surface isolation: bound async bootstrap resolution and profile hydration to monotonic resolution attempt generation and active session UUID, discarding stale results, older retry errors, and switched-identity projections; updated session reset to immediately invalidate outstanding requests; and enforced founder route isolation in `getAuthRedirectRoute`, redirecting Remote customers to `/(tabs)` when READY, onboarding when NEEDS_ONBOARDING, holding when UNRESOLVED/RESOLVING/ERROR, and login when SIGNED_OUT, while preserving Mock developer workflows).
- **Ownership / Shared Contracts**: Client-side implementation strictly (`src/stores/bootstrapStore.ts`, `src/services/deriveClient.ts`, `src/utils/authRouting.ts`, `tests/derive.test.ts`). Zero shared contract modifications (`CustomerBootstrapState` and `IDeriveService` untouched). Zero backend modifications (database migrations, RLS, Edge Functions, Stripe, and server intelligence untouched).
- **Architectural Deliverables**:
  1. **Monotonic Attempt Generation & Identity Guards (`src/stores/bootstrapStore.ts`, `src/services/deriveClient.ts`)**:
     - Extended `useBootstrapStore` with `resolutionAttempt: number`.
     - `setResolving(userId)` increments and returns the attempt counter.
     - `setResolved(state, attempt)` and `setError(message, attempt)` reject state transitions if the request attempt does not match the active generation.
     - `resetBootstrap()` increments `resolutionAttempt`, immediately invalidating any pending async network promises.
     - `resolveCustomerBootstrap` validates that `attempt === currentAttempt` AND `activeSessionUser === state.userId` before committing state, projecting membership, or initiating profile hydration.
     - Catch block verifies attempt and identity before committing `ERROR`, preventing older failed attempts from overwriting newer successful resolutions.
  2. **Profile Hydration Freshness (`src/services/deriveClient.ts`)**:
     - `hydrateCustomerProfile(userId)` validates that `profile.id === activeSessionUser` in Remote mode before projecting profile data into `useUserStore`.
  3. **Founder Mobile Surface Isolation (`src/utils/authRouting.ts`)**:
     - Updated `getAuthRedirectRoute`: Remote customers attempting to access `/founder/**` are strictly redirected based on their bootstrap state (`READY` $\rightarrow$ `/(tabs)`, `NEEDS_ONBOARDING` $\rightarrow$ `/(onboarding)/1-welcome`, `UNRESOLVED`/`RESOLVING`/`ERROR` $\rightarrow$ `/holding`, `SIGNED_OUT` $\rightarrow$ `/(auth)/login`).
     - Normal customer surfaces (`/(tabs)`, `/profile`, `/orders`, `/check-in`, `/refill`, `/insights/**`) remain fully permitted.
     - Mock mode developer/demo founder access remains unrestricted.
- **Verification**:
  - `npm test`: 86/86 tests passing (100%), including 5 new dedicated I1-A2.1 regression tests.
  - `npx tsc --noEmit`: 0 errors.
  - `npm run typecheck:tests`: 0 errors.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: Clean export.
  - `eas.json` strictly preserves `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"`.

## 2026-09-18 — Kanuj Mobile/UX: I1-A2 Remote Customer Bootstrap Resolution & Profile Handshake

- **Agent / Workstream**: Kanuj (Mobile Client, UX & Prototyping)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `b989ca5a1004c2d2e0f3d06d25fcc6cf154bb43c`
- **Prior Verified CI Run**: `35385390081` (on commit `b989ca5`)
- **Remote Push Status**: `pending commit / push` (Predecessor-based bookkeeping; zero self-referencing predicted commit loops)
- **GitHub CI**: `pending`
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `I1-A2 COMPLETE` (Remote profile resolution handshake: implemented `CustomerBootstrapState` shared contract and `getCustomerBootstrapState` on `IDeriveService`, deterministically distinguishing authenticated new members needing onboarding from existing onboarded members using canonical `skin_profiles.onboarding_completed`; replaced raw `as unknown as CustomerProfile` cast with safe explicit column mapping; built client `useBootstrapStore` state machine; updated `holding.tsx` to handle resolving and error states with Retry and Sign Out affordances; updated `resolveAuthRoute` and `getAuthRedirectRoute` to route new members to onboarding and onboarded members to tabs while failing closed on profile provisioning errors; and full verification ladder passed).
- **Ownership / Shared Contracts**: Coordinated additive shared-contract addition (`src/contracts/DeriveService.ts`, `src/domain/types.ts`). Client-side implementation (`src/stores/bootstrapStore.ts`, `src/stores/userStore.ts`, `src/services/deriveClient.ts`, `src/services/sessionReset.ts`, `src/utils/authRouting.ts`, `src/utils/customerErrors.ts`, `app/holding.tsx`, `app/_layout.tsx`, `app/index.tsx`, `app/(auth)/verify-otp.tsx`, `tests/derive.test.ts`). Narrow Sami-owned RemoteDeriveService implementation (`src/services/remote/RemoteDeriveService.ts`). Zero changes to database migrations, RLS, Edge Functions, Stripe, or server intelligence.
- **Architectural Deliverables**:
  1. **Canonical Bootstrap Contract (`CustomerBootstrapState`)**:
     - Defined additive `CustomerBootstrapState` in `src/domain/types.ts`: `{ userId: string; profileExists: boolean; onboardingCompleted: boolean; membershipStatus: 'active' | 'paused' | 'cancelled' | 'none'; }`.
     - Added additive `getCustomerBootstrapState(userId: string): Promise<CustomerBootstrapState>` to `IDeriveService`.
     - Tier and pricing fields strictly excluded, preserving `ARCHITECTURE_CHALLENGE-01` without resolving it prematurely.
  2. **Canonical Persistence Signals & Invariants**:
     - `public.profiles` row existence (auto-provisioned by auth triggers) does NOT indicate onboarding completion. Profile absence fails closed (`profileExists: false`) to catch provisioning triggers.
     - `public.skin_profiles.onboarding_completed` is the sole canonical source of onboarding truth. Absent row or false $\rightarrow$ `NEEDS_ONBOARDING`; true $\rightarrow$ `READY`.
     - `public.memberships` queried deterministically (latest row by `created_at` descending; absent maps to `'none'`). Membership state is informational and does NOT gate onboarding navigation in this slice.
  3. **Safe Column Mapping in `RemoteDeriveService`**:
     - Removed raw `as unknown as CustomerProfile` direct cast. Added pure mappers `mapDbBootstrapState` and `mapDbCustomerProfile`.
     - Safely maps snake_case DB columns (`full_name` $\rightarrow$ `fullName`, `created_at` $\rightarrow$ `createdAt`, `updated_at` $\rightarrow$ `updatedAt`).
     - Protected Stripe columns (`stripe_customer_id`, `stripe_subscription_id`) are excluded from customer projections.
     - Unrepresentable tiers under the frozen contract (`founding_beta_129`) return null rather than fabricating fake tiers.
  4. **Client Bootstrap State Machine (`src/stores/bootstrapStore.ts`)**:
     - Implemented `useBootstrapStore` tracking `UNRESOLVED` | `RESOLVING` | `NEEDS_ONBOARDING` | `READY` | `ERROR` lifecycle.
     - Integrated with `src/services/deriveClient.ts` via `resolveCustomerBootstrap(userId)` with customer-safe error shielding ("We couldn't finish loading your account. Please try again.").
     - Integrated with `resetCustomerSessionData()` in `src/services/sessionReset.ts` to guarantee bootstrap state is purged on sign-out, cold-start, or $A \rightarrow B$ account switch.
  5. **Holding Screen UX (`app/holding.tsx`)**:
     - Displays Direction A Mineral loading canvas with spinner while `RESOLVING` ("Finishing your setup…").
     - When `ERROR`, renders calm customer copy with "Try Again" retry action and "Sign Out" escape hatch.
  6. **Deterministic Routing Policies (`src/utils/authRouting.ts`)**:
     - Updated `resolveAuthRoute` and `getAuthRedirectRoute`: `NEEDS_ONBOARDING` routes to `/(onboarding)/1-welcome`; `READY` routes to `/(tabs)`.
     - In Remote mode, local `onboardingStore.isCompleted` is strictly ignored; canonical remote data is authoritative.
- **Verification**:
  - `npm test`: 81/81 tests passing (100%), including 14 new dedicated I1-A2 tests covering shared contract, mock state, PostgREST query execution, profile mapping, and client routing.
  - `npx tsc --noEmit`: 0 errors.
  - `npm run typecheck:tests`: 0 errors.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: Clean export.
  - `eas.json` strictly preserves `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"`.

## 2026-09-18 — Kanuj Mobile/UX: I1-A1.2 Final Auth Route & Session-Truth Closure

- **Agent / Workstream**: Kanuj (Mobile Client, UX & Prototyping)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `e75daef7b5456f4e5d4623a745089a9852863276`
- **Prior Verified CI Run**: `35380014944` (on commit `e75daef`)
- **Remote Push Status**: `pending commit / push` (Predecessor-based bookkeeping; zero self-referencing predicted commit loops)
- **GitHub CI**: `pending`
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `I1-A1.2 COMPLETE` (Final client-auth closure: implemented global Remote route enforcement via `getAuthRedirectRoute` ensuring authenticated sessions cannot bypass `/holding` via direct/deep links while preventing redirect loops; implemented 7-case fail-closed truth table in `signOutSession` where verification errors or exceptions fail closed and preserve customer state; and isolated founder mode in `useUserStore` ensuring `isFounderMode: false` on logout, remote identity projection, and account switches).
- **Ownership / Shared Contracts**: Client-side only (`app/_layout.tsx`, `src/services/authClient.ts`, `src/stores/userStore.ts`, `src/utils/authRouting.ts`, `docs/ROADMAP.md`, `docs/CONTEXT_SYNC.md`, `tests/derive.test.ts`). Shared contracts (`src/contracts/**`, `src/domain/**`, `src/types/schema.ts`) strictly frozen and untouched. Zero changes to Sami's backend lane (`supabase/**`, `admin/**`, Edge Functions, migrations, RLS, Stripe).
- **Architectural Deliverables**:
  1. **Global Remote Route Enforcement**:
     - Added pure helper `getAuthRedirectRoute(currentRoute: string[] | string, destination: AuthRouteDestination): string | null` to `src/utils/authRouting.ts`.
     - Integrated into `app/_layout.tsx` root layout. In Remote mode (`EXPO_PUBLIC_USE_REMOTE_SERVICE=true`), authenticated sessions (`SIGNED_IN`) are globally forced to `/holding` regardless of direct deep link or manual route requested (`/(tabs)`, `/(onboarding)/*`, `/profile`, `/orders`, `/check-in`, `/refill`, `/founder/*`), while `/holding` itself is recognized as satisfying the destination (preventing redirect loops).
     - Signed-out Remote sessions are globally forced to `/(auth)/login` if attempting to access any route outside the `(auth)` group, without looping when already in `(auth)`.
  2. **Fail-Closed Sign-Out Verification Truth Table**:
     - Hardened `signOutSession()` in `src/services/authClient.ts` to implement a strict 7-case fail-closed truth table.
     - When `signOut({ scope: 'local' })` returns an error or throws an exception, provider session state is verified via `getSession()`. If `getSession()` returns an error or throws an exception (lookup failure), session state is treated as UNKNOWN $\rightarrow$ fails closed (returns `{ success: false }`, customer state is NOT purged). Only when verification succeeds and confirms `session === null` is the session declared absent and customer state purged.
  3. **Founder Mode Customer-State Isolation**:
     - Enforced `isFounderMode: false` in `useUserStore.logout()` and `useUserStore.setRemoteSessionUser()`.
     - Guarantees that founder/debug mode cannot survive across Remote customer sign-outs, cold-start resets, Remote identity projections, or $A \rightarrow B$ account switches.
- **Verification**:
  - `npm test`: 76/76 passing (100%), with dedicated I1-A1.2 regression tests covering global route enforcement (12 scenarios), fail-closed sign-out truth table (7 cases), and founder mode isolation (4 scenarios).
  - `npx tsc --noEmit`: 0 errors.
  - `npm run typecheck:tests`: 0 errors.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: Clean export.
  - `eas.json` strictly preserves `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"`.

## 2026-09-18 — Kanuj Mobile/UX: I1-A1.1 Session Isolation & Post-Auth Routing Hardening Pass

- **Agent / Workstream**: Kanuj (Mobile Client, UX & Prototyping)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `ce3398d27b0e52caf94eff9c5032f46a849275e2`
- **Prior Verified CI Run**: `35371569927` (on commit `ce3398d`)
- **Remote Push Status**: `pending commit / push` (Predecessor-based bookkeeping; zero self-referencing predicted commit loops)
- **GitHub CI**: `pending`
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `I1-A1.1 COMPLETE` (Hardened post-auth routing and session isolation: implemented neutral profile-resolution holding state in Remote mode, created pure testable `resolveAuthRoute` helper, purged onboarding store state on session reset to prevent sensitive photo/goal leaks across accounts, enforced cold-start cache purge on absent sessions, detected identity switches to purge prior user caches while preserving caches on same-user token refreshes, set local device signout scope, enforced truthful sign-out verification, minimized returned token surface, and aligned architectural documentation).
- **Ownership / Shared Contracts**: Client-side only (`app/holding.tsx`, `app/(auth)/verify-otp.tsx`, `app/_layout.tsx`, `app/index.tsx`, `app/profile/index.tsx`, `src/services/authClient.ts`, `src/services/sessionReset.ts`, `src/utils/authRouting.ts`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`, `docs/CONTEXT_SYNC.md`, `tests/derive.test.ts`). Shared contracts (`src/contracts/**`, `src/domain/**`, `src/types/schema.ts`) strictly frozen and untouched. Zero changes to Sami's backend lane (`supabase/**`, `admin/**`, Edge Functions, migrations, RLS, Stripe).
- **Architectural Deliverables**:
  1. **Neutral Remote Profile Resolution (`/holding`)**:
     - Created `app/holding.tsx` rendering Direction A Mineral holding canvas ("Finishing your setup…") with safe Sign Out escape hatch.
     - In Remote mode (`EXPO_PUBLIC_USE_REMOTE_SERVICE=true`), authenticated sessions (`SIGNED_IN`) route strictly to `/holding`, decoupling client navigation from local `onboardingStore.isCompleted`. Canonical onboarding and membership determinations are deferred to server profile hydration in I1-A2.
  2. **Pure Production Routing Helper (`resolveAuthRoute`)**:
     - Created `src/utils/authRouting.ts` implementing `resolveAuthRoute(options: ResolveRouteOptions): AuthRouteDestination`.
     - Standardized route evaluation across `app/index.tsx`, `app/_layout.tsx`, `app/(auth)/verify-otp.tsx`, and `tests/derive.test.ts`.
  3. **Sensitive Onboarding State Purging**:
     - Updated `src/services/sessionReset.ts` (`resetCustomerSessionData()`) to invoke `useOnboardingStore.getState().resetOnboarding()`.
     - Ensures sensitive front/left/right skin photos, photo context notes, skin goals, adverse reaction logs, and prescriptions are purged on sign-out, cold start, and identity switch.
  4. **Cold-Start Cache Purging & Identity Switching**:
     - Updated `getCurrentSession()` in `src/services/authClient.ts`: purges customer session data when no active session is returned by provider.
     - Added identity transition check in `subscribeToAuth` and `verifyEmailOtp`: if authenticated user UUID changes ($A \rightarrow B$), purges user A's data before projecting user B. Preserves user caches across same-user token refreshes ($A \rightarrow A$).
  5. **Truthful Local Device Sign-Out**:
     - Configured `{ scope: 'local' }` in `signOutSession()` and `defaultSupabaseAdapter.signOut`, matching customer UI copy ("End session on this device").
     - Hardened error handling in `signOutSession()`: if provider signOut throws or errors, verifies whether provider session actually remains active. If session remains active, reports failure without navigating or purging; if confirmed absent, purges caches and returns success.
  6. **Token Minimization**:
     - Updated `verifyEmailOtp()` to return `VerifyOtpResult` (`{ success: boolean; userId?: string; error?: string }`), removing raw `session` (access/refresh tokens) from the UI surface.
  7. **Documentation Truth Alignment**:
     - Corrected `docs/ARCHITECTURE.md` to reflect passwordless 6-digit Email OTP as the canonical client auth mechanism, removing references to Magic Link and Email/Password.
- **Verification**:
  - `npm test`: 75/75 passing (100%), including new I1-A1.1 regression tests covering local sign-out scope, error truthfulness, cold-start purge, identity switch vs token refresh preservation, pure routing policy, and onboarding store reset.
  - `npx tsc --noEmit`: 0 errors.
  - `npm run typecheck:tests`: 0 errors.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: Clean export.
  - `eas.json` strictly preserves `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"`.

## 2026-09-18 — Kanuj Mobile/UX: I1-A1 Mobile Auth & Session Spine

- **Agent / Workstream**: Kanuj (Mobile Client, UX & Prototyping)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `af23bf57d8d258f6a26ebb8d9564847b7c489f80`
- **Prior Verified CI Run**: `35367541890` (on commit `af23bf5`)
- **Remote Push Status**: `pending commit / push` (Predecessor-based bookkeeping; zero self-referencing predicted commit loops)
- **GitHub CI**: `pending`
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `I1-A1 COMPLETE` (First vertical implementation slice for I1: Mobile passwordless Email OTP authentication flow, session persistence via `@react-native-async-storage/async-storage`, auth boundary and store projections, route gating in remote mode, auto-refresh lifecycle listeners, and sign-out cross-user cache purging implemented cleanly with full test coverage; live Derive Supabase project verification flagged as blocked on project access / configuration).
- **Ownership / Shared Contracts**: Client-side only (`package.json`, `package-lock.json`, `src/services/supabase.ts`, `src/services/authClient.ts`, `src/services/sessionReset.ts`, `src/stores/authStore.ts`, `src/stores/userStore.ts`, `src/utils/customerErrors.ts`, `app/(auth)/**`, `app/_layout.tsx`, `app/index.tsx`, `app/profile/index.tsx`, `tests/derive.test.ts`). Shared contracts (`src/contracts/**`, `src/domain/**`, `src/types/schema.ts`) strictly frozen and untouched. Zero changes to Sami's backend lane (`supabase/**`, `admin/**`, Edge Functions, migrations, RLS, Stripe).
- **Architectural Deliverables**:
  1. **Supabase Client & Session Persistence Configuration**:
     - Installed and configured `@react-native-async-storage/async-storage` for Supabase client session persistence.
     - Updated `src/services/supabase.ts` with `auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }`.
     - Supports both `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
     - Exported `startAuthAutoRefresh()` and `stopAuthAutoRefresh()` auto-refresh lifecycle helpers.
     - Fixed `uploadPrivatePhoto` storage helper to use `upsert: false`, respecting INSERT-only RLS policy on private skin photos.
     - Maintained pure Node test compatibility by avoiding any `react-native` imports in `src/services/supabase.ts`.
  2. **Auth Client Boundary & Adapter Abstraction**:
     - Created `src/services/authClient.ts` providing clean auth abstractions: `sendEmailOtp(email)`, `verifyEmailOtp(email, token)`, `getCurrentSession()`, `signOutSession()`, `subscribeToAuth(callback)`.
     - Includes robust client-side validation (`isValidEmail`, `isValidOtpToken`) and test adapter injection (`setAuthAdapter`, `resetAuthAdapter`).
     - Shields internal technical errors through `getCustomerErrorMessage('auth_*')`.
  3. **Session Projection & Cross-User Cache Purging**:
     - Created `src/stores/authStore.ts` tracking lightweight auth status (`INITIALIZING`, `SIGNED_OUT`, `SIGNED_IN`), `sessionUserId`, and `sessionEmail`.
     - Added `setRemoteSessionUser(userId, email)` to `src/stores/userStore.ts` to project authenticated identity without falsely asserting paid/active membership (`fullName: ''`, `membershipStatus: 'none'`, `tier: ''`).
     - Created `src/services/sessionReset.ts` (`resetCustomerSessionData()`) to purge user identity, active routine, check-ins, refill requests, and scan context on sign-out.
  4. **Direction A Mineral Auth Screens**:
     - Created `app/(auth)/_layout.tsx`, `app/(auth)/login.tsx` (email entry with validation, loading indicator, Mineral styling, and error handling), and `app/(auth)/verify-otp.tsx` (6-digit OTP entry, 30-second resend cooldown timer, back navigation, auto-submit on completion).
  5. **Deterministic Route Gating**:
     - Updated `app/index.tsx` and `app/_layout.tsx`:
       - Mock mode (`EXPO_PUBLIC_USE_REMOTE_SERVICE=false`): 100% bypasses auth gating, preserving instant launch.
       - Remote mode (`EXPO_PUBLIC_USE_REMOTE_SERVICE=true`): `INITIALIZING` displays minimal Mineral loading splash without screen flash; `SIGNED_OUT` routes to `/(auth)/login`; `SIGNED_IN` permits access to authenticated app routes.
     - Registered `AppState` listener in `app/_layout.tsx` to handle auto-refresh on active foreground and suspend on background.
     - Added Sign Out affordance in `app/profile/index.tsx` with confirmation dialog and cache reset.
- **Verification**:
  - `npm test`: 73/73 passing (100%), including 8 new I1-A1 regression tests covering email validation, OTP format validation, error shielding, identity projection, sign-out purging, session synchronization, auth state subscription, and route gating logic.
  - `npx tsc --noEmit`: 0 errors.
  - `npm run typecheck:tests`: 0 errors.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: Clean export.
  - `eas.json` strictly preserves `EXPO_PUBLIC_USE_REMOTE_SERVICE: "false"`.

## 2026-09-18 — Kanuj Mobile/UX: K6.3 Test Integrity & Contract Truth Hardening Pass

- **Agent / Workstream**: Kanuj (Mobile Client, UX & Prototyping)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `61d9076ea56dc3fd242019cf53a325778fe491d9`
- **Prior Verified CI Run**: `35365954751` (on commit `61d9076`)
- **Remote Push Status**: `pending commit / push` (Predecessor-based bookkeeping; zero self-referencing predicted commit loops)
- **GitHub CI**: `pending`
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `K6.3 COMPLETE` (Verification integrity and contract truth pass eliminating false-green test typechecking holes, establishing dedicated test semantic typecheck in CI, auditing and aligning test fixtures to canonical production contracts without modifying shared schemas, and separating UI display banner fallbacks from typed service domain context).
- **Ownership / Shared Contracts**: Client-side and test infrastructure only (`tsconfig.tests.json`, `package.json`, `.github/workflows/ci.yml`, `AGENTS.md`, `src/utils/scanContext.ts`, `app/(tabs)/ask.tsx`, `tests/derive.test.ts`). Shared contracts (`src/contracts/**`, `src/domain/**`, `src/types/schema.ts`) strictly frozen and untouched. Zero changes to Sami's backend lane (`supabase/**`, `admin/**`, Edge Functions, Stripe).
- **Architectural Deliverables**:
  1. **Closed False-Green CI Hole**:
     - Root `tsconfig.json` excluded `"tests"`, while `npm test` ran Node's `--experimental-strip-types` without typechecking, permitting broken types in `tests/derive.test.ts` to pass CI.
     - Added `tsconfig.tests.json` extending root configuration with `"types": ["node", "react-native"]` and targeting `tests/**/*.ts`.
     - Added `"typecheck:tests": "tsc -p tsconfig.tests.json --noEmit"` to `package.json`.
     - Added dedicated `Run test TypeScript check` step to `.github/workflows/ci.yml` directly after strict application TypeScript check.
     - Updated `AGENTS.md` completion rules to require `npm run typecheck:tests` (0 errors).
  2. **Canonical Contract Truth & Fixture Realignment**:
     - Audited all test fixtures against canonical schemas. Completely eradicated hallucinated fields (`barcode`, `confidence`, `ingredientsIdentified`, `safetyFlags`, `fitScore`) and illegal verdicts (`verdict: 'keep'`).
     - Realized test fixtures with canonical `ProductScanResult` properties (`category`, `keyActives`, `factsUsedToDecide`) and legal verdicts (`fits_plan`, `great_fit`).
     - Aligned `RemoteBackendMock` implementation in `tests/derive.test.ts` with required `SkinProfile`, `Routine`, `ProductScanResult`, and `CustomerProfile` properties.
  3. **Separation of Route Display Fallback from Service Context**:
     - Created `src/utils/scanContext.ts` with pure functions `resolveAskDisplayBanner` and `resolveAskServiceContext`.
     - Lightweight route query strings provide UI banner continuity (e.g. for deep links or external routes) but are NEVER synthesized into a synthetic `ProductScanResult`.
     - `askQuestion` transmission to `IDeriveService.askDerive` carries strictly the full typed `ProductScanResult` from `useScanContextStore`.
     - Banner dismissal clears both route banner fallback state and transient store context.
- **Verification**:
  - `npm test`: 65/65 passing (100%).
  - `npx tsc --noEmit`: 0 errors.
  - `npm run typecheck:tests`: 0 errors.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: Clean export.
  - Zero hallucinated fields or illegal verdicts in codebase.

## 2026-09-18 — Kanuj Mobile/UX: K6.2 Integration-Semantics Hardening Pass

- **Agent / Workstream**: Kanuj (Mobile Client, UX & Prototyping)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `dbd8854deeaa3dddeeb81f9e661642018887df77`
- **Prior Verified CI Run**: `35363350999` (on commit `dbd8854`)
- **Remote Push Status**: `pending commit / push` (Predecessor-based bookkeeping; zero self-referencing predicted commit loops)
- **GitHub CI**: `pending`
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `K6.2 COMPLETE` (Focused hardening pass resolving 3 concrete integration semantic gaps: Scan-to-Ask context handoff preserves full typed `ProductScanResult` across navigation boundary without string synthesis and delivers synchronously to first and subsequent Ask queries; fail-closed non-mock client identity presence check in `src/services/deriveClient.ts` with whitespace rejection; centralized customer-safe error sanitization in `src/utils/customerErrors.ts` preventing raw backend error leakage to customer UI while preserving user draft intent).
- **Ownership / Shared Contracts**: Client-side only (`src/stores/scanContextStore.ts`, `src/utils/customerErrors.ts`, `src/services/deriveClient.ts`, `app/(tabs)/ask.tsx`, `app/(tabs)/scan.tsx`, `app/(onboarding)/10-summary.tsx`, `app/check-in/index.tsx`, `app/refill/index.tsx`, `tests/**`). Shared contracts (`src/contracts/**`, `src/domain/**`) strictly frozen and untouched. Zero changes to `supabase/**`, backend migrations, RLS, Edge Functions, or Stripe.
- **Architectural Deliverables**:
  1. **Full-Fidelity Scan → Ask Context Preservation**:
     - Created `src/stores/scanContextStore.ts` (`useScanContextStore`) providing ephemeral client state for the full typed `ProductScanResult`.
     - In `app/(tabs)/scan.tsx`: `handleHandoffToAsk` populates `useScanContextStore.getState().setActiveScannedProduct(scanResult)` before navigating.
     - In `app/(tabs)/ask.tsx`: Reads `useScanContextStore.getState().activeScannedProduct` synchronously on initial query execution, eliminating React closure / render timing race conditions on the first automated request.
     - Context lifecycle: Subsequent messages retain the scanned product context; dismissing the scan banner or starting a "New chat" clears the context via `clearScanContext()`; direct navigation into Ask clears any stale context.
  2. **Fail-Closed Non-Mock Identity Presence Guard**:
     - Updated `resolveUserId()` in `src/services/deriveClient.ts` to trim inputs and reject missing, empty, and whitespace-only (`'   '`, `'\t'`, `'\n'`) strings in Remote mode.
     - Explicitly throws `'Valid member identity required: Remote operations require a non-mock customer identity.'`, cleanly distinguishing client-side non-mock presence checks from server-side authenticated session / Supabase JWT enforcement (enforced via Postgres RLS in S1/I1).
  3. **Centralized Customer-Safe Error Sanitization & Intent Preservation**:
     - Created `src/utils/customerErrors.ts` mapping domain operations (`onboarding`, `ask`, `scan`, `checkin`, `refill`, `general`) to empathetic, deterministic Direction A Mineral copy.
     - Replaced all raw `err?.message` leaks across `app/(onboarding)/10-summary.tsx`, `app/(tabs)/ask.tsx`, `app/(tabs)/scan.tsx`, `app/check-in/index.tsx`, `app/refill/index.tsx`, and `src/services/deriveClient.ts`.
     - Technical details remain in controlled `console.warn` logs for developer troubleshooting without leaking internal strings (`PostgREST`, `Supabase`, `RemoteDeriveService`) to end-users.
     - Form state preservation: Check-in and refill failures keep the user's form inputs and selected products intact for retry.
- **Verification**:
  - `npm test`: 64/64 passing (100%), including 4 new K6.2 regression tests covering scan context handoff, lifecycle clearing, customer error mapping, and user form state preservation.
  - `npx tsc --noEmit`: 0 errors.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: Clean export.
  - Zero raw `err?.message` displayed in `app/**` or `src/services/deriveClient.ts`.

## 2026-09-18 — Kanuj Mobile/UX: K6.1 Service Boundary Hardening & Fail-Closed State

- **Agent / Workstream**: Kanuj (Mobile Client, UX & Prototyping)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `9ff22dc93f35077ef97515c9ecded42b3e394a5f`
- **Prior Verified CI Run**: `35359096347` (on commit `9ff22dc`)
- **Remote Push Status**: `pending commit / push` (Predecessor-based bookkeeping; zero self-referencing predicted commit loops)
- **GitHub CI**: `pending`
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `K6.1 COMPLETE` (Focused hardening pass resolving 5 concrete gaps: Scan-to-Ask route parameters aligned, fail-closed authentication for remote service calls, fail-closed shelf product recognition in default path, canonical null routine cache projection, and mutation error handling and recoverability across client screens).
- **Ownership / Shared Contracts**: Client-side only (`src/services/DeriveService.ts`, `src/services/deriveClient.ts`, `src/services/catalog.ts`, `app/**`, `tests/**`). Shared contracts (`src/contracts/**`, `src/domain/**`) strictly frozen and untouched. Zero changes to `supabase/**`, backend migrations, RLS, Edge Functions, or Stripe.
- **Architectural Deliverables**:
  1. **Canonical Scan-to-Ask Routing**: Aligned parameters in `app/(tabs)/scan.tsx` to `{ productName, brand, verdict, reason }` while supporting legacy `scanned*` fallbacks in `app/(tabs)/ask.tsx`; avoids synthesizing artificial `ProductScanResult` records when passing query strings.
  2. **Fail-Closed Remote Identity Validation**: Added `isRemoteServiceEnabled()` helper to `src/services/DeriveService.ts`. Updated `getActiveUserId()` and introduced `resolveUserId()` in `src/services/deriveClient.ts` to strictly fail closed (throw `Error('Authentication required: Remote operations require an authenticated session.')`) when unauthenticated, empty, or mock IDs (`usr_beta_member`, `usr_beta_001`) are used in Remote mode. Mock mode retains deterministic `'usr_beta_member'` fallback.
  3. **Fail-Closed Shelf Product Recognition**: Replaced fabricated products in `recognizeShelfProducts()` with a clean fail-closed empty result (`{ products: [], unclearBottlesCount: 0 }`). Isolated demo fixture into explicit `getDemoShelfRecognitionFixture()` for developer tests. Added empty shelf guidance card in `app/(onboarding)/6-shelf.tsx`.
  4. **Canonical Null Routine Projection**: Hardened `hydrateRoutine()` in `src/services/deriveClient.ts` to project `routine: null, isPlanUnderReview: false` when backend returns `null`, preventing stale client caches.
  5. **Mutation Error Handling & Recoverability**:
     - `app/(tabs)/scan.tsx`: Catches evaluation errors, displays an error modal, and immediately clears the camera lock ref (`isScanningLockedRef.current = false`) so scanning is never permanently disabled.
     - `app/(tabs)/ask.tsx`: Displays recoverable chat error bubble from Derive on intelligence failure.
     - `app/check-in/index.tsx`: Implemented `isSubmitting`, `submitError` banner, and button loading state while keeping user input intact on failure.
     - `app/refill/index.tsx`: Implemented `isSubmitting`, `error` banner, and button loading state while keeping selection intact on failure.
- **Verification**:
  - `npm test`: 60/60 passing (100%), including 5 new regression tests verifying all 5 hardened behaviors.
  - `npx tsc --noEmit`: 0 errors.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: Clean export.

## 2026-09-18 — Kanuj Mobile/UX: K6 Mobile Service Boundary & Remote-Readiness

- **Agent / Workstream**: Kanuj (Mobile Client, UX & Prototyping)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `1ba7956213077a619a52cda8a248884a2d685f6f`
- **Prior Verified CI Run**: `35354355509` (on commit `1ba7956`)
- **Remote Push Status**: `pending commit / push` (Predecessor-based bookkeeping; zero self-referencing predicted commit loops)
- **GitHub CI**: `pending`
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `K6 COMPLETE` (Mobile application genuinely backend-swappable via `IDeriveService`; client screens decoupled from mock and AI workflow internals; zero `ai-workflows` imports in `app/**`; clean initial state guaranteed; swappability verified via unit tests; ready for I1 RemoteDeriveService activation); `K5 COMPLETE / ASC UPLOADED` (TestFlight upload verified in EAS build `3846b3b4-5a36-4f5a-b6bc-c78418987606` and submit `f19df267-fde8-45f4-8662-e803fddf87be`; physical hardware smoke deferred to I1).
- **Ownership / Shared Contracts**: Client-side only (`src/services/deriveClient.ts`, `src/services/catalog.ts`, `src/services/mock/MockDeriveService.ts`, `app/**`, `tests/**`). Shared contracts (`src/contracts/**`, `src/domain/**`) strictly frozen and untouched. Zero changes to `supabase/**`, backend migrations, RLS, Edge Functions, or Stripe.
- **Architectural Deliverables**:
  1. **Centralized Service Coordinator (`src/services/deriveClient.ts`)**: Unified client facade exposing `submitOnboarding`, `askQuestion`, `evaluateProduct`, `submitWeeklyCheckIn`, `requestProductRefill`, `hydrateOrders`, `hydrateProgress`, `hydrateRoutine`, `hydrateResearchInsights`, `hydrateCustomerProfile`, and custom hooks (`useOnboardingSubmission`, `useAskDeriveQuery`, `useProductScanEvaluation`, `useWeeklyCheckInSubmission`, `useRefillOrderSubmission`, `useActiveRoutineHydration`).
  2. **Device Scanner Partition (`src/services/catalog.ts`)**: Partitioned client catalog fixtures (`PROTOTYPE_CATALOG`), barcode lookups (`findProductByBarcode`), and shelf recognition fallback (`recognizeShelfProducts`) away from backend AI workflows.
  3. **Zero `ai-workflows` in `app/**`**: Eliminated all prohibited direct imports from `ai-workflows` across client screens (`10-summary.tsx`, `6-shelf.tsx`, `ask.tsx`, `scan.tsx`, `check-in/index.tsx`, `refill/index.tsx`, `orders/index.tsx`, `progress.tsx`, `index.tsx`, `plan.tsx`, `insights/[id].tsx`, `profile/index.tsx`).
  4. **Clean Initial State Guarantee**: `MockDeriveService` hardened to initialize with `activeRoutine = null`, empty orders, empty check-ins, empty insights, and `customerProfile = null`. Explicit `seedArthurDemoData()` available strictly for dev/test environments.
  5. **Swappability Verification**: Unit-tested runtime dependency injection via `setDeriveService()`, confirming an alternate backend transparently powers the mobile client without screen modifications.
- **Verification**:
  - `npm test`: 55/55 passing (100%).
  - `npx tsc --noEmit`: 0 errors.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: Clean export in ~2.5s.
  - Architectural lint: Zero `ai-workflows` imports in `app/**`.

## 2026-09-17 — Kanuj Mobile/UX: K5 Expo Project Link + Physical-Device Signing Attempt

- **Agent / Workstream**: Kanuj (Mobile Client, UX & Prototyping)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `d22075a5ef4f6d04f2fa0be61a446cd13bd20de5`
- **Prior Verified CI Run**: `35268975660` (on commit `d22075a`)
- **Remote Push Status**: `pending commit / push` (Predecessor-based bookkeeping; zero self-referencing predicted commit loops)
- **GitHub CI**: `pending`
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `K5 PARTIAL / BLOCKED ON APPLE SIGNING + IPHONE DEVELOPER MODE` (Expo project `@derive-skincare/derive` linked; EAS non-interactive iOS development build cannot create internal-distribution credentials without interactive Apple login; local `expo run:ios --device` reached Xcode signing but failed because Developer Mode is disabled on the connected iPhone.)
- **Ownership / Shared Contracts**: Kanuj-owned Expo/EAS mobile config only. Zero Supabase, RLS, Stripe, or shared-contract changes. Founder builds remain `EXPO_PUBLIC_USE_REMOTE_SERVICE=false`.
- **Verified Runtime**:
  1. `eas whoami` authenticated as Expo user `kanuj`; owner of personal account `kanuj` and org `derive-skincare`.
  2. `eas project:info` matches `@derive-skincare/derive` / `4100d696-3e03-4b2c-bdb3-1986d5f1a624`. Did not re-run `eas init`.
  3. Connected physical device: iPhone 17 Pro Max class (`iPhone18,2`), iOS 27, available/trusted. Developer Mode disabled.
  4. `eas build --platform ios --profile development --non-interactive` initialized remote `buildNumber` to 1, then failed: no Apple credentials suitable for internal distribution in non-interactive mode.
  5. Local device compile used existing Apple Development identity on this Mac and timed out because Developer Mode is off.
- **Durable Config This Pass**:
  1. Persisted Expo link: `extra.eas.projectId` + `owner: derive-skincare`.
  2. Set `ios.config.usesNonExemptEncryption: false` via Expo's documented TestFlight export-compliance key. Repo contains no custom crypto libraries; networking is standard OS HTTPS. Removed ignored local `ios.buildNumber` now that EAS `appVersionSource` is remote.
- **Hard Blockers Remaining**:
  - Interactive Apple Developer login for EAS-managed ad hoc credentials (`eas build --platform ios --profile development`).
  - Enable iPhone Developer Mode (Settings → Privacy & Security → Developer Mode).
  - Physical face auto-capture, barcode, production build, TestFlight.

---

## 2026-09-17 — Kanuj Mobile/UX: K5 Release Continuation After Quota Interrupt

- **Agent / Workstream**: Kanuj (Mobile Client, UX & Prototyping)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `ad841b44d15d1d3de90d12fc44642583fe8e3849`
- **Prior Verified CI Run**: `35266181623` (on commit `ad841b4`)
- **Remote Push Status**: `pending commit / push` (Predecessor-based bookkeeping; zero self-referencing predicted commit loops)
- **GitHub CI**: `pending`
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `K5 PARTIAL / BLOCKED ON EXPO AUTH + PHYSICAL IPHONE` (K5 build infrastructure verified on `ad841b4`; empty EAS Apple placeholder strings removed; unused iOS microphone permission removed; `expo-font` peer installed for native/dev-client; first-customer script aligned to current copy. EAS cloud builds, physical face/barcode validation, production build, and TestFlight remain blocked.)
- **Ownership / Shared Contracts**: Kanuj-owned mobile release config (`app.json`, `eas.json`, `docs/FIRST_CUSTOMER_TEST.md`) plus required native peer `expo-font` for `@expo/vector-icons`. Zero Supabase, RLS, Stripe, or shared-contract changes. K5 founder builds remain `EXPO_PUBLIC_USE_REMOTE_SERVICE=false`.
- **Verified From Repository / Runtime (not handoff claims)**:
  1. `expo-dev-client ~57.0.19` is in `package.json`; `expo-dev-client` is listed in `app.json` plugins.
  2. `eas.json` development profile: `developmentClient: true`, `distribution: internal`, device (not simulator) iOS, Mock/local env flag.
  3. `eas.json` production profile: `autoIncrement: true`, `distribution: store`, Mock/local env flag, `cli.appVersionSource: remote`.
  4. Bundle ID `com.derive.skincare`, version `1.0.0`, iOS build number `1`, scheme `derive`.
  5. Autolinking resolves `DeriveFaceCapture` and `expo-dev-client`; local `ios/Podfile.lock` includes both.
  6. Local simulator already has `com.derive.skincare` installed on booted iPhone 16 Pro (iOS 18.4).
  7. `eas whoami` is **Not logged in**. No `extra.eas.projectId` in app config. No physical iPhone connected (`xctrace` listed only this Mac).
- **Corrections This Pass**:
  1. Removed empty `submit.production.ios.appleId` / `ascAppId` / `appleTeamId` strings. Official EAS default is `"submit": { "production": {} }`; empty strings are not durable Apple IDs and would skip interactive App Store Connect resolution if treated as set.
  2. Removed `NSMicrophoneUsageDescription`. Native `VoiceInputButton` uses Web Speech only on web and a local sample fallback on iOS; it does not access the microphone.
  3. Kept `NSPhotoLibraryUsageDescription` because shelf capture and Ask attachments use `expo-image-picker`. Face baseline photos still disallow library upload.
  4. Installed missing `expo-font` peer required by `@expo/vector-icons` (`expo-doctor` failed this check; native/dev-client can crash without it).
  5. Aligned `docs/FIRST_CUSTOMER_TEST.md` to current Welcome / Final Review copy and removed a non-existent production "Reset state" control.
  6. Excluded `dist`, `dist-web`, and `.expo` from `tsconfig.json` so local web export artifacts cannot flake `tsc`.
- **Not Done (hard blockers)**:
  - Expo authentication / EAS project link / EAS development cloud build.
  - Physical iPhone face auto-capture and barcode validation.
  - Production EAS build and internal TestFlight upload/processing/install.

---

## 2026-09-17 — Kanuj Mobile/UX: Wire Native Face Auto-Capture, Remove Dev-Surface Leaks, and Finalize K4.4 (Pass 11 / Milestone K4.4 Finalization)

- **Agent / Workstream**: Kanuj (Mobile Client, UX & Prototyping)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `30155650a7799a8dc872da9cfbba7e8ba1e863ad`
- **Prior Verified CI Run**: `35259431491` (on commit `3015565`)
- **Remote Push Status**: `pending commit / push` (Predecessor-based bookkeeping; zero self-referencing predicted commit loops)
- **GitHub CI**: `pending`
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `K4.4 WIRED & COMPILATION READY / PHYSICAL DEVICE VALIDATION IN K5` (Native face auto-capture module autolinked, syntax-verified, and fully wired into CameraCapture and onboarding skin photo flow; dev surface leaks removed; K5 Mobile Release & TestFlight next); `S1 IN PROGRESS` (S1A data plane complete; S1B/S2 in progress).
- **Ownership / Shared Contracts**: Kanuj-owned client code (`app/**`, `src/components/**`, `src/stores/**`, `modules/**`, `tests/**`). Backward-compatible additions only. Zero changes to Supabase migrations, RLS, or Sami backend infrastructure.
- **Durable Corrections & Wiring Completed**:
  1. **Autolinked Native Apple Vision Module (`modules/derive-face-capture/`)**:
     - Added `modules/derive-face-capture/package.json` (`derive-face-capture@1.0.0`) and `modules/derive-face-capture/ios/DeriveFaceCapture.podspec`.
     - Configured `expo-module.config.json` for Apple platform (`"platforms": ["apple"]`).
     - Verified CocoaPods autolinking via `npx expo-modules-autolinking resolve -p ios`, confirming `DeriveFaceCapture` pod and `DeriveFaceCaptureModule`.
     - Validated Swift syntax and compilation via `xcrun --sdk iphonesimulator swiftc -parse` (0 errors).
     - Enhanced native view lifecycle: added busy guard in `takePhoto()`, configured connection portrait orientation and mirroring on photo and preview layer connections, and added `removeFromSuperview()` cleanup.
  2. **Ref-Forwarding & Platform Gating**:
     - Updated `modules/derive-face-capture/src/DeriveFaceCaptureView.tsx` with `React.forwardRef` exposing imperative `takePhoto()`.
     - Exported `isDeriveFaceCaptureSupported()` returning true on iOS when native view manager is available and false on web/sim fallback.
     - Updated `DeriveFaceCaptureView.web.tsx` providing safe forwardRef and web fallback.
  3. **Wired Face Auto-Capture into Onboarding**:
     - Refactored `src/components/ui/CameraCapture.tsx` to conditionally mount `<DeriveFaceCaptureView>` when `type === 'face'`, `facing === 'front'`, and native capture is supported; otherwise renders `<CameraView>`. Single camera mount invariant strictly preserved.
     - Wired `onFrameMetrics` to `AutoCaptureStateMachine.update()`, streaming hold progress to animated oval guide reticle and guidance messaging to HUD banner.
     - Triggered auto-capture on hold completion (750ms steady hold) with success haptic notification, alongside manual shutter button fallback.
     - Connected `app/(onboarding)/7-skin-photos.tsx` with `qualityGating={{ enabled: true, autoCapture: true, targetAngle: currentAngle.key, holdDurationMs: 750 }}` across all 3 baseline angles (Front, Left, Right).
  4. **Purged Developer Surfaces & Store Traps**:
     - Gated `app/profile/index.tsx` Section 3 ("Demo & Development Controls" and "Founder Review Queue") behind `{__DEV__ && (...)}`.
     - Gated `app/(tabs)/scan.tsx` "TEST PRESETS" behind `{__DEV__ && (...)}`.
     - Gated `app/(tabs)/scan.tsx` `params.sim` behind `__DEV__` and enforced fail-closed behavior on missing match (zero silent fallback to `PROTOTYPE_CATALOG[0]`).
     - Removed misleading `initializeDefaultRoutine` action from `routineStore.ts`, keeping only explicit `loadArthurDemoRoutine()` for dev/demo.
  5. **Durable Status Reconciliation**:
     - Updated `docs/DECISIONS.md` (`ARCHITECTURE_CHALLENGE-04`) to `ARCHITECTURE SELECTED & WIRED / PHYSICAL DEVICE VALIDATION IN K5`.
     - Updated `docs/ROADMAP.md` (K4.4) to `[WIRED & COMPILATION READY / PHYSICAL DEVICE VALIDATION IN K5]`.
     - Physical hardware sensor calibration and lighting tolerance testing explicitly scheduled for K5 on TestFlight.
  6. **Test Suite Expansion**:
     - Added 3 new unit tests in Section 17 of `tests/derive.test.ts` verifying `routineStore` trap removal and clean default state, scan simulation fail-closed behavior, and multi-angle auto capture state machine sequencing.
     - 51/51 tests passing (100% pass rate).
     - 0 TypeScript compilation errors (`npx tsc --noEmit`).
     - Web export passes cleanly (`EXPO_NO_TELEMETRY=1 npx expo export -p web`).

---

- **Agent / Workstream**: Kanuj (Mobile Client, UX & Prototyping)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `78b50f5be09591e2080224c35defa501ff84a693`
- **Implementation Commit**: `bee8e2a9e2353a80557786ea39e610903362657d`
- **Final Shared Pushed SHA**: `c2b933157e8ebaa64b971a533038670dc4e10b1a`
- **Remote Push Status**: `pushed / verified`
- **GitHub CI**: `success` (Run ID: `35259288838`)
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `K4.4 COMPLETE` (Baseline capture intelligence, instant barcode scanning, and beta state finalization achieved; K5 Mobile Release & TestFlight next); `S1 IN PROGRESS` (S1A data plane complete; S1B/S2 in progress).
- **Ownership / Shared Contracts**: Kanuj-owned client code (`app/**`, `src/components/**`, `src/stores/**`, `src/utils/**`, `src/services/ai-workflows/**`, `modules/**`, `tests/**`). Backward-compatible additions only (`ScanProductInput.barcode?: string`). Zero changes to Supabase migrations, RLS, or Sami backend infrastructure.
- **Durable Changes**:
  1. **Purged Demo State Contamination & Clean Default Store**:
     - `routineStore`: Reset default state to `routine: null`, `userProducts: []`, `checkIns: []`, `learnedInsights: []`, `researchInsights: []`, `refillRequests: []`, and no active tracking number.
     - Isolated Arthur demo routine and fixtures into explicit actions `loadArthurDemoRoutine()` and helper `getArthurDemoRoutineState()`.
     - Added "Demo & Development Controls" in Account Profile (`app/profile/index.tsx`) allowing one-tap switching between clean customer state and Arthur demo fixture, with direct link to `/founder`.
  2. **Empty-State Hardening & Treatment-Adaptive Advice**:
     - Hardened empty states across Progress (`app/(tabs)/progress.tsx`), Refill (`app/refill/index.tsx`), Plan (`app/(tabs)/plan.tsx`), and Today (`app/(tabs)/index.tsx`).
     - Replaced hardcoded "Differin" assumptions in chat advisor (`src/services/ai-workflows/chat-advisor.ts`) with dynamic routine and active treatment analysis.
     - Replaced static starter chips on Ask tab (`app/(tabs)/ask.tsx`) with contextual prompts reflecting actual routine status.
     - Baseline photos in Progress now read directly from onboarding store with verified status indicators (`Baseline 3-Angle Capture`, `Awaiting First 7-Day Check-in`).
  3. **Zero-Shutter Instant Barcode Scanning**:
     - Rebuilt `app/(tabs)/scan.tsx` into a continuous `CameraView` barcode scanner detecting UPC-A, UPC-E, EAN-13, and EAN-8 formats.
     - Implemented synchronous locking ref (`isScanningLockedRef`) and debounce delay to eliminate multi-trigger frame race conditions.
     - Added horizontal framing reticle with scanning laser guide, camera torch/flashlight toggle, and an Unknown Barcode action sheet with manual search fallback.
     - Preserved split evaluation architecture (`FIT FOR YOU RIGHT NOW` vs `FORMULA QUALITY`) and 1-tap Ask handoff.
  4. **Deterministic Barcode Normalization Layer (`src/utils/barcode.ts`)**:
     - Built `normalizeBarcode`: strips whitespace and non-numeric chars; maps 13-digit EAN-13 leading-0 to 12-digit UPC-A; preserves genuine 12-digit UPC-A leading zeros.
     - Built `getBarcodeLookupKeys`: generates dual-format lookup keys for resilient catalog matching.
     - Built `validateBarcodeChecksum`: standard GS1 modulo-10 algorithm for 8, 12, and 13 digits.
     - Added `findProductByBarcode(rawBarcode, catalog)` to `scan-evaluator.ts`.
  5. **Resolved ARCHITECTURE_CHALLENGE-04 (Apple-Native Auto-Capture)**:
     - Implemented `AutoCaptureStateMachine` (`src/components/camera/AutoCaptureStateMachine.ts`): a pure TypeScript deterministic state machine evaluating face presence, bounding-box centering, face size/distance, yaw angles (front [-15..15], left [-20..-65], right [20..65]), pitch, roll, and continuous hold stability (750ms). Fail closed on any criterion break.
     - Created local native Expo module `modules/derive-face-capture/` using Apple's native `Vision.framework` (`VNDetectFaceRectanglesRequest`, `VNDetectFaceCaptureQualityRequest`) and `AVFoundation`. Analyzes frames at ~8 Hz on-device without cloud transfer, persistent face embeddings, or third-party MLKit dependencies.
     - Eliminated fake Unsplash photo fallback in `CameraCapture.tsx` with fail-closed error handling and front selfie mirroring (`mirror={facing === 'front'}`).
  6. **Test Suite Expansion**:
     - Added 6 new unit tests in Section 17 of `tests/derive.test.ts` verifying RoutineStore demo isolation, barcode normalization, GS1 checksums, instant catalog lookup, and AutoCaptureStateMachine deterministic state transitions.
     - 48/48 tests passing (100% pass rate).
     - 0 TypeScript compilation errors (`npx tsc --noEmit`).
     - Web export passes cleanly (`EXPO_NO_TELEMETRY=1 npx expo export -p web`).

---

## 2026-09-17 — Kanuj Mobile/UX: Founding Beta Client Readiness (Pass 9 / Milestone K4.3)

- **Agent / Workstream**: Kanuj (Mobile Client, UX & Prototyping)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `6e7bd13fbee9103462d248ef07af4cb4af314029`
- **Implementation Commit**: `b8b5b24ddb578658a5be968a12f526bbdf926eb8`
- **Final Shared Pushed SHA**: `78b50f5be09591e2080224c35defa501ff84a693`
- **Remote Push Status**: `pushed / verified`
- **GitHub CI**: `success` (Run ID: `35255766343`)
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `K4.3 COMPLETE` (Founding Beta client readiness achieved; K5 Mobile Release & TestFlight next); `S1 IN PROGRESS` (S1A data plane complete; S1B/S2 in progress).
- **Ownership / Shared Contracts**: Kanuj-owned client code only (`app/**`, `src/components/**`, `src/stores/**`, `src/constants/**`, `tests/**`). Zero changes to Supabase migrations, RLS, shared domain/contracts (`src/domain/**`, `src/contracts/**`), or backend persistence.
- **Durable Changes**:
  1. **Centralized Beta Pricing ($100/mo)**: Sourced customer-facing beta price strictly from `src/constants/config.ts` (`config.betaPriceMonthly = 100`). Removed hardcoded `$129` strings from `app/orders/index.tsx`, `app/profile/index.tsx`, `app/(onboarding)/10-summary.tsx`, and `src/stores/userStore.ts`. Preserved `$129` in shared contracts and migrations as documented `ARCHITECTURE_CHALLENGE-01`.
  2. **Decoupled Identity Token & Demo Fixture Isolation**: Decoupled `userStore.tier` from price literals (`'Founding Beta'`). Clean default state initializes as `Beta Member` (`usr_beta_member`, `member@derive.skin`), preventing accidental Arthur greeting or demographic leakage on fresh launches. Arthur demo user cleanly isolated in explicit action `loadArthurDemoUser()`.
  3. **Truthful Onboarding Trust Copy**: Removed unsupported resumability claim ("pick up where you left off"), unverified security claims ("Private & Encrypted", "end-to-end encryption"), and clinical framing ("medical context", "Human-checked"). Framed onboarding as a focused 4-minute intake, private by design, with a manual final quality check before routine activation. Setup support framed as operational assistance (`concierge@derive.skin`), not a recurring consulting promise.
  4. **Required Baseline Photos for Paid Founding Beta**: Gated the Continue button strictly on all 3 required angles (Front, Left, Right); removed the "Skip photos for now" bypass; corrected right-profile subtext from unmeasurable "barrier resilience" to cosmetic "right cheek, jawline, and texture clarity"; updated privacy guarantee to truthful private storage at rest.
  5. **In-App Live Camera Foundation (`expo-camera`)**: Refactored `CameraCapture.tsx` from an ImagePicker modal trigger to a true in-app live viewfinder using installed `expo-camera` (`CameraView`). Includes front-facing live stream for face selfies, face oval reticle, floating top HUD instruction pill, manual shutter with haptics, captured photo review (`Use Photo` vs `Retake`), camera flip support, and permission handling with Settings redirect. Strictly disabled photo-library upload for face baseline photos.
  6. **Extensible Quality-Gating Contract & Deferred Auto-Capture**: Defined `QualityGatingConfig`, `QualityGateStatus`, and `CaptureQualityCriteria` component interfaces. Raised `ARCHITECTURE_CHALLENGE-04` deferring hands-free native frame analysis (yaw/pitch/roll, lighting, sharpness) to a dedicated native Expo module pass.
  7. **Today Actionable Research Gating**: Filtered research cards on Today to surface strictly when directly relevant to an active routine adaptation or proposed change (`recommendation === 'action'`); generic non-actionable literature (`'no_change'`) is omitted from Today to protect the 2-second status glance.
  8. **Test Suite Expansion**: Added 4 new invariant tests covering centralized pricing truth, user store demo isolation, Today actionable research filtering, and baseline photo gating (42/42 passing).
- **Architecture Challenges Raised**:
  - `ARCHITECTURE_CHALLENGE-04`: Real-Time Face-Quality Auto-Capture Requires Native Dependency & Build Architecture.
- **Unresolved / Next Work**:
  - K5: Mobile Release & TestFlight (EAS build, dev client, physical hardware validation).
  - Dedicated pass for native Apple Vision / CoreML frame processing if hands-free auto-capture is desired for beta members.

---

## 2026-09-17 — Founder Alignment: Narrow Documentation-Correctness Cleanup (Pass 8)

- **Agent / Workstream**: Kanuj & Sami Founder Alignment (Mobile/UX + Platform/Intelligence)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `3cf752d72672798bdec43cca6d416925ecdb20c0`
- **Ending Pushed SHA**: `6e7bd13fbee9103462d248ef07af4cb4af314029`
- **Remote Push Status**: `pushed / verified`
- **GitHub CI**: `success` (Run ID: `35251493589`)
- **Drive Status**: `synced by orchestrator after agent completion`
- **Milestone Status**: `S1 IN PROGRESS` (S1A data plane complete; S1B/S2 in progress); `K4 COMPLETE` (K4.1 pricing prototype & K4.2 phenotype prototype complete; K5 next).
- **Ownership / Shared Contracts**: Strictly documentation cleanup. Zero code, UI, migration, or contract edits.
- **Durable Corrections Made**:
  1. **Survey Location Correction (`docs/RESEARCH.md`)**: Corrected Wave 1 survey sampling location from "University of Washington" to "University of Wisconsin–Madison" / "UW–Madison" while preserving all sampling caveats and statistical data.
  2. **AI-Led Care Loop Reconciled with Concierge Beta (`docs/PROJECT_CONTEXT.md`)**: Clarified that scalable long-term Derive is AI-led and software-managed, while the 10-member Founding Beta uses manual founder review of early recommendations, routine adaptations, and check-ins where useful for learning. Reaffirmed that recurring founder consultation is an operational bridge, not the permanent product promise.
  3. **ADR-13 vs. ADR-21 Target vs. Temporary Override Alignment (`docs/DECISIONS.md`)**: Formally defined ADR-13 as the scalable long-term care-loop target architecture and ADR-21 as the temporary operational override for the 10-member Founding Beta learning cohort.
  4. **Pass 7 Ledger Final State (`docs/CONTEXT_SYNC.md`)**: Updated Pass 7 bookkeeping to record ending pushed commit `3cf752d`, remote verified status, GitHub CI success (`Run 35250494613`), and Drive sync status.
  5. **Planned Backend Intelligence & Edge Functions Clarification (`README.md`)**: Clarified that server-side Gemini 2.5 Flash structured intelligence and Supabase Edge Functions are planned architecture (S3 milestone); the client currently uses deterministic local reasoning via `MockDeriveService`.
  6. **Today Research Card Action-Relevance Alignment (`docs/PRODUCT.md`)**: Reconciled the Today tab research card so clinical literature surfaces on Today only when directly relevant to an active routine adaptation or barrier state, keeping general educational research on Ask, Progress, and detail views to protect Today's 2-second glance.

---

## 2026-09-17 — Founder Alignment: Founding Beta Concierge Model, $100/Mo Experiment & Durable Context Reconciliation (Pass 7)

- **Agent / Workstream**: Kanuj & Sami Founder Alignment (Mobile/UX + Platform/Intelligence)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `58277086cf7335a11fa9d5c05e9e4e56aa144957`
- **Ending Pushed SHA**: `3cf752d72672798bdec43cca6d416925ecdb20c0`
- **Remote Push Status**: `pushed / verified`
- **GitHub CI**: `success` (Run ID: `35250494613`)
- **Drive Status**: `synced by orchestrator after agent completion`
- **Milestone Status**: `S1 IN PROGRESS` (S1A data plane complete; S1B/S2 in progress); `K4 COMPLETE` (K4.1 pricing prototype & K4.2 phenotype prototype complete; K5 next).
- **Ownership / Shared Contracts**: Strictly documentation and durable architectural context reconciliation across both founder workstreams. Zero changes to UI components, database migrations, Supabase schema, or shared TypeScript contracts (`src/contracts/**`, `src/domain/**`).
- **Durable Decisions & Context Reconciled**:
  1. **Founding Beta Concierge Operating Model**: Approved high-touch concierge MVP for the first 10 paying members. Core principle: *Sell the future Derive outcome now; deliver it manually where necessary.* Kanuj manually reviews intake, baseline photos, routine construction, product sourcing/fulfillment, and weekly check-ins. Scalable long-term product remains AI-led and software-managed. Explicitly NOT a private consulting business; zero permanent recurring founder consultation promise.
  2. **Founding Beta Price Experiment ($100/mo for first 10)**: Approved beta experiment (ADR-21), distinct from long-term pricing architecture. Validates willingness-to-pay, routine adherence, and month-two retention. Customer pays one monthly price covering management plus standard OTC routine products based on actual need. No product wallet, credit balance, or rollover allowance. Existing working products preserved (`KEEP`); no shipping duplicates for calendar billing theater. ADR-10 ($129/mo) marked HISTORICAL / SUPERSEDED. ADR-15 (Personalized All-In Monthly Pricing, Arthur $96/mo demo fixture) remains PROVISIONAL / PENDING COFOUNDER BUSINESS REVIEW.
  3. **6 Beta Learning Hypotheses**: Recorded explicit success questions: Value, Behavior, Trust, Longitudinal, Fulfillment, Retention. Vanity engagement metrics must not displace evidence against these hypotheses.
  4. **Autopilot vs. Depth Philosophy**: Clarified that "Autopilot vs. Depth" is a product design philosophy, NOT user modes or a settings toggle. Default is Today + Plan + lightweight check-ins + approvals; optional depth is Scan, Ask, Progress, and research cards. Canonical 5 native tabs preserved.
  5. **Required Baseline Photos (Founding Beta)**: Required for paid Founding Beta members only. Guided Front -> Left -> Right sequence. Camera evaluates photographic capture quality only (face presence, pose, distance, centering, lighting, sharpness, stability) with auto-capture and manual fallback. On-device quality gating where practical; zero persistent face embeddings or facial recognition. Photos do not diagnose disease or measure hydration/sebum quantitatively.
  6. **Routine Change & Member Approval Policy**: Explicit trust boundary. Derive may automatically ingest check-ins, update observations, generate progress summaries, determine "no change needed", propose modifications, and estimate refill timing. Material changes (adding/replacing products, permanent removal, changing strong active frequency/intensity, introducing strong active, reintroducing adverse-history ingredient, price increase, shipping new/substitute product) require explicit member approval before activation. Prescriptions are contextual only. Safety escalation remains immediate for acute red flags.
  7. **Refill Consent Policy**: Same-product refills use low-friction confirmation ("Running low on [product]? Refill"). No fake deterministic depletion claims, no silent auto-shipment based solely on elapsed calendar days. Future standing consent for same SKU with advance notice and skip option. Substitutions require affirmative approval.
  8. **Founder Research Conversations**: Biweekly-ish customer discovery and feedback conversations for first 10 members; explicitly NOT a permanent recurring consultation feature.
  9. **Preliminary Customer-Discovery Evidence (N=31 Wave 1 Pilot)**: Recorded survey findings with explicit convenience sample caveats (UW–Madison/CS-heavy, male-skewed, not representative) and Q5 multi-select configuration note. 54.8% prioritized build/manage + adapt + progress tracking. Directional signal favoring longitudinal management/progress/adaptation over Scan/fulfillment as primary acquisition wedge. Scan and fulfillment preserved for retention defensibility.
  10. **Customer-Facing Trust & Safety Language Standards**: "Your skincare, handled." "Your first routine gets one final quality check before it goes live." Strict prohibitions on claiming AI dermatologist, unsubstantiated clinical review, photo disease diagnosis, pseudo-quantitative selfie measurements, causal allergy inference from one event, guaranteed outcomes, or unheld medical credentials.
  11. **README & Durable Docs Line-by-Line Audit**: Removed stale $129 claims, distinguished implemented stack from planned architecture, updated documentation sitemap to include `docs/PRODUCT.md` and `docs/CONTEXT_SYNC.md`, and reconciled all 12 docs across the repository.
- **Decision Status**:
  - `ADR-10: Manual Operations & $129/Month Canonical Pricing`: **HISTORICAL / SUPERSEDED**
  - `ADR-15: Personalized All-In Monthly Pricing Architecture`: **PROVISIONAL / PENDING COFOUNDER BUSINESS REVIEW**
  - `ADR-20: S1A Least-Privilege Supabase Data Plane`: **IMPLEMENTED** (full S1 in progress)
  - `ADR-21: Founding Beta Concierge Operating Model & $100/Month First-10 Pricing Experiment`: **APPROVED BETA EXPERIMENT**
- **Unresolved Founder Decisions**:
  - Long-term company pricing architecture, commercial ranges, management fee, and operations buffer after the 10-member beta (Kanuj & Sami alignment).
  - Open shared-contract challenges (ARCHITECTURE_CHALLENGE-01: `$129` in membership identity; ARCHITECTURE_CHALLENGE-02: safety unknown state collapse; ARCHITECTURE_CHALLENGE-03: `STOP` vs `PAUSE` persistence drift).
  - Formal cancellation, refund, and fulfillment terms for Founding Beta checkout.

---

## 2026-09-16 — Sami Platform: S1A Least-Privilege Data Plane

- **Agent / Workstream**: Sami (Platform, Intelligence & Operations)
- **Local Branch**: `main`
- **Starting Shared HEAD / origin/main**: `71e693d6b45f6850d5c53332172ef139fc41d3e8`
- **Pass 6 Ledger Correction Commit**: `59e57c8cae96231ae6764dece6544e7eb14c49c9`
- **Implementation Commit**: `3f37e706f89898810d10c04f8c4466d914ef69a9`
- **Ledger Sync**: This docs-only successor commit records the implementation checkpoint without self-referencing its own SHA.
- **Remote Push Status**: `pushed` (final checkpoint verified against `origin/main`)
- **Drive Status**: `sync-required` (`DRIVE_SYNC_PAYLOAD` emitted in completion report)
- **Milestone Status**: `S1 IN PROGRESS`; S1A database/auth-policy/private-storage data plane is implemented, but official Docker-backed Supabase reset/pgTAP verification, persistent mobile auth, trusted photo signing, and Storage-API-first deletion remain open.
- **Ownership / Shared Contracts**: No Kanuj-owned UI, `src/domain/**`, `src/contracts/**`, or shared TypeScript schema was changed. Sami-owned `src/services/remote/**` projections were narrowed to customer-readable columns so the new grants do not fail on wildcard expansion.
- **Durable Changes**:
  1. Added reproducible local Supabase configuration with migrations, Auth, and Storage enabled; PostgreSQL 15 remains a local pin that must be checked against the hosted project before linking.
  2. Added an additive S1A migration; the applied baseline migration was not rewritten.
  3. Added Derive-namespaced Auth triggers and locked private-schema functions that provision/backfill profiles and synchronize Auth-owned email without replacing unrelated triggers.
  4. Enabled RLS on all eleven existing application tables, normalized existing application-policy drift, revoked implicit client grants, restricted mutable columns, and established server-only default privileges for future public objects/RPCs.
  5. Kept payment identifiers, founder notes/tasks, AI analysis, fulfillment state, onboarding completion, and ownership reassignment outside client authority.
  6. Added a non-public 10 MiB image-only `customer-skin-photos` bucket with immutable, owner-bound uploads under `<auth-uuid>/<photo-type>/<opaque-file-name>` and no direct customer list/read/sign/update/delete path.
  7. Reserved photo-object and photo-metadata deletion for a future trusted Storage-API-first workflow so partial client operations cannot orphan private blobs.
  8. Added a fail-closed preflight for unexpected `storage.objects` policies because permissive policies combine with OR semantics.
  9. Added a 64-assertion pgTAP suite covering exact policy roles/commands, grants, default RPC privileges, Auth lifecycle, anonymous denial, owner/cross-owner isolation, server-only fields, bucket invariants, and Storage insert-policy behavior.
  10. Corrected documentation that previously implied the remote feature flag alone makes the current locally stored UI production-ready.
- **Verification**:
  - `npm test`: **PASS**, 38/38.
  - `npx tsc --noEmit`: **PASS**.
  - `EXPO_NO_TELEMETRY=1 npx expo export -p web`: **PASS**.
  - PostgreSQL parser: baseline migration, S1A migration, and pgTAP file all parse.
  - Fresh ephemeral PostgreSQL-compatible migration-chain verification: **PASS** for Auth trigger, future-function defaults, RLS, safe field grants, cross-user isolation, owner-bound Storage insert, and private bucket invariants.
  - Supabase CLI `2.117.0` read the project configuration, but `supabase db reset` / `supabase test db` could not run because this host has neither Docker nor Podman. The committed pgTAP suite is therefore authored and statically reviewed, not reported as officially executed.
- **Decision Status**:
  - `ADR-20: S1A Least-Privilege Supabase Data Plane`: **IMPLEMENTED** (full S1 remains in progress).
  - Flat-price membership semantics, explicit safety unknown states, and `STOP` versus `PAUSE`: **PROPOSED / UNRESOLVED ARCHITECTURE_CHALLENGES** only.
  - Phenotype/PIH persistence and personalized pricing persistence: **NOT IMPLEMENTED** in S1A.
  - Stripe: **NOT STARTED**; remains S5.
- **Architecture Challenges Raised**:
  1. `ARCHITECTURE_CHALLENGE-01`: `$129` is embedded in membership identity while pricing direction is unresolved.
  2. `ARCHITECTURE_CHALLENGE-02`: Database/shared contracts collapse pregnancy/nursing and sensitivity unknown states into `false`/empty values.
  3. `ARCHITECTURE_CHALLENGE-03`: Database persistence rejects client-valid `PAUSE` while permitting underdefined `STOP`.
- **Unresolved / Next Work**:
  - Run the official fresh Supabase reset, pgTAP suite, and Storage API upload smoke test on Docker-backed local/CI infrastructure before deployment.
  - Implement the JWT-bound 900-second photo signer and idempotent Storage-API-first deletion workflow as S1B.
  - Coordinate persistent Expo Auth session/callback/route gating and the canonical non-upserting uploader without silently changing Kanuj-owned UI.
  - Finish remote row-to-domain mapping, routine-item assembly, live functions, and integration coverage before enabling remote mode for customers.
  - Founders must resolve the three shared-contract challenges before the dependent S2/S5 persistence work is declared complete.

---

## 2026-09-16 — Kanuj Mobile/UX: Architecture-Correctness Cleanup (Pass 6)

- **Agent / Workstream**: Kanuj (Mobile Client, UX & Prototyping)
- **Local Branch**: `main`
- **Starting Local HEAD**: `ae4e49d951477d53967196729a4933fb6fb71b30`
- **Ending Commit / HEAD**: `71e693d6b45f6850d5c53332172ef139fc41d3e8` (pushed checkpoint)
- **Remote Push Status**: `pushed`
- **Drive Status**: `sync-required` (DRIVE_SYNC_PAYLOAD emitted in completion report)
- **Architecture Challenges Raised / Resolved**: None
- **Durable Changes**:
  1. **Corrected CONTEXT_SYNC Truth**: Aligned ADR numbering (ADR-15, ADR-17, ADR-18, ADR-19) and confirmed Pass 5 pushed commit SHA (`ae4e49d`).
  2. **Removed Invented Pricing Range**: Stripped unapproved `~$49–$129/mo` range from all repository documentation. Clarified that personalized all-in monthly pricing is a provisional direction, Arthur's $96/mo is an illustrative deterministic demo fixture (not a pricing commitment), and final commercial terms/ranges require founder alignment between Kanuj and Sami.
  3. **Decoupled SunResponse Semantics**: Sourced `SunResponse` strictly from behavioral self-reported sun reaction (`burns_easily`, `burns_then_tans`, `sometimes_burns_tans`, `rarely_burns_tans_easily`, `not_sure`), removing any implicit mixing with pigmentation depth.
  4. **Enforced Full Evidence Applicability Constraints**: Introduced `EvidenceApplicabilityContext` (`productHasIronOxides`, `photoprotectionRelevant`), enforced that `directRoutineInfluenceAllowed: false` hard-blocks direct routine changes regardless of study grade, and ensured missing context fails closed.
  5. **Removed Pigmentation-Alone Iron-Oxide Benefit Rule**: Iron-oxide photoprotection benefit requires a reported/confirmed post-inflammatory hyperpigmentation signal (`pihTendency: 'sometimes' | 'often'`), never inferred from pigmentation depth alone.
  6. **Distilled White-Cast Logic**: Eliminated speculative formula-category predictions; grounded white cast in catalog-verified or member observation evaluated against member cast concern.
  7. **Removed Unapproved Ingredient Prescription Rule**: Removed automatic recommendation of specific actives (Niacinamide, Azelaic acid) from PIH product documentation.
  8. **Preserved Backend Interface Semantics**: Reframed `docs/INTERFACES.md` Section 7 around semantic provenance and pricing lifecycle requirements without dictating database table/column layouts for Sami.
  9. **Strengthened AGENTS Bootstrap & Sync**: Added fast-forward-only automatic remote reconciliation (`git merge --ff-only origin/main`), divergence guard, and full `ARCHITECTURE_CHALLENGE` packet template.
  10. **Terminology Cleanup**: Replaced "human verification" with "manual final quality check" for initial routine; replaced "medical context" with "sensitive member/skincare data".
- **Decision Status**:
  - `ADR-15: Personalized All-In Monthly Plan Pricing`: **PROVISIONAL / PENDING COFOUNDER BUSINESS REVIEW**
  - `ADR-17: Phenotype-Aware, Never Race-Aware Skin Modeling`: **PROVISIONAL CLIENT ARCHITECTURE IMPLEMENTED**
  - `ADR-18: Research Evidence Grading & Member Applicability Policy`: **IMPLEMENTED (Client Prototype Policy)**
  - `ADR-19: Categorical Tint Compatibility & White Cast Assessment`: **IMPLEMENTED (Client Prototype Policy)**
  - `Backend Schema & Remote Service Evolution`: **PROPOSED (Awaiting Sami Review)**
- **Repo Docs Updated**:
  - `AGENTS.md`
  - `docs/CONTEXT_SYNC.md`
  - `docs/PROJECT_CONTEXT.md`
  - `docs/PRODUCT.md`
  - `docs/RESEARCH.md`
  - `docs/SAFETY_PRIVACY.md`
  - `docs/DECISIONS.md`
  - `docs/ROADMAP.md`
  - `docs/INTERFACES.md`
  - `docs/ARCHITECTURE.md`
- **Unresolved Founder Decisions**:
  - Final business model, commercial pricing ranges, management/operations components, first-basket financing, refund policy, and cancellation rules (Kanuj & Sami alignment).
  - Database schema & entity persistence design for phenotype provenance and routine-linked pricing snapshots (Sami review).

---

## 2026-09-16 — Kanuj Mobile/UX: Phenotype Architecture, Provenance & Evidence Policy (Pass 5)

- **Agent / Workstream**: Kanuj (Mobile Client, UX & Prototyping)
- **Local Branch**: `main`
- **Starting Local HEAD**: `4d4f41faa34a53a9a0abc8516676a37368cdbf04`
- **Ending Commit / HEAD**: `ae4e49d951477d53967196729a4933fb6fb71b30`
- **Remote Push Status**: `pushed` (verified against `origin/main`)
- **Drive Status**: `sync-required` (DRIVE_SYNC_PAYLOAD emitted in completion report)
- **Architecture Challenges Raised / Resolved**: None
- **Durable Changes**:
  1. **Phenotype-Aware, Never Race-Aware Architecture**: Built client/mock module `src/phenotype/` (`types.ts`, `profile.ts`, `evidence-policy.ts`, `tint-compatibility.ts`, `fixtures.ts`, `index.ts`). Explicitly prohibits race/ethnicity classifiers, CV colorimetry, Fitzpatrick ML inference, and demographic recommendation rules.
  2. **Categorical Provenance & Confirmation Invariant**: Modeled `ProvenancedValue<T>` with categorical confidence (`low` | `medium` | `high`) and source tracking (`self_reported`, `photo_estimate`, `observed_history`, `derived_from_history`, `external_context`). Enforced that explicit member confirmation strictly outranks unconfirmed estimates (`setOrConfirmPhenotypeValue`).
  3. **V1 Onboarding Adaptive PIH Signal**: Added single adaptive follow-up *"Do breakouts or irritation usually leave dark marks that stick around?"* with structured choices (`Rarely`, `Sometimes`, `Often`, `Not sure`) shown when `breakouts` or `dark_spots` goals are selected. Recorded as `self_reported`, `userConfirmed: true`.
  4. **Evidence Strength vs. Member Applicability**: Codified evidence policy separating methodological grade (`A` / `B` / `C` / `D`) from member applicability. Grade A/B eligible only when member criteria match; Grade C (observational/mechanistic) cannot silently alter routine steps; Grade D (preliminary/anecdotal) cannot drive product behavior.
  5. **Tinted-Product Categorical Compatibility**: Implemented shade matching without fake numerical scores. Returns `needs_confirmation` when member depth is unconfirmed; detects iron-oxide visible light photoprotection benefits for PIH-prone skin.
  6. **Personalized Pricing Prototype Correctness**: Retained deterministic 30-day consumption arithmetic ($96/mo Arthur demo estimate) with explicit separation of active routine consumption, inventory lifespan, and provisional operations.
- **Decision Status**:
  - `ADR-15: Personalized All-In Monthly Plan Pricing`: **PROVISIONAL / PENDING COFOUNDER BUSINESS REVIEW**
  - `ADR-17: Phenotype-Aware, Never Race-Aware Skin Modeling`: **PROVISIONAL CLIENT ARCHITECTURE IMPLEMENTED**
  - `ADR-18: Research Evidence Grading & Member Applicability Policy`: **IMPLEMENTED**
  - `ADR-19: Categorical Tint Compatibility & White Cast Assessment`: **IMPLEMENTED**
  - `Backend Schema & Remote Service Evolution`: **PROPOSED (Awaiting Sami Review)**
- **Repo Docs Updated**:
  - `AGENTS.md`
  - `docs/CONTEXT_SYNC.md`
  - `docs/PROJECT_CONTEXT.md`
  - `docs/PRODUCT.md`
  - `docs/RESEARCH.md`
  - `docs/SAFETY_PRIVACY.md`
  - `docs/DECISIONS.md`
  - `docs/ROADMAP.md`
  - `docs/INTERFACES.md`
  - `docs/OWNERSHIP.md`
  - `docs/DESIGN.md`
- **Unresolved Founder Decisions**:
  - Migration of `SkinPhenotypeProfile` from `src/phenotype/` to backend database schema (`supabase/migrations/`) when Sami implements remote persistence.
  - Final Stripe commerce contract and founder billing dashboard integration.

---

## 2026-09-16 — Kanuj Mobile/UX: Personalized Pricing Architecture & Correctness Pass (Pass 4)

- **Agent / Workstream**: Kanuj (Mobile Client & Prototyping)
- **Local Branch**: `main`
- **Starting Local HEAD**: `50c5a3f` -> `4d4f41f`
- **Remote Push Status**: `pushed`
- **Drive Status**: `sync-required`
- **Durable Changes**:
  - Established 3-part economic concept: retail unit price, inventory lifespan (e.g. 60–90 days), and 30-day normalized consumption.
  - Arthur fixture verified at $96/month ($39 management + $52 products + $5 provisional operations).
  - Price stability contract: routine edits do not change billing unless product consumption changes; price increases require member confirmation; price drops apply automatically.
