# H1A hosted Remote core record

This is current hosted post-auth evidence and a repeatable smoke procedure. It is not email OTP, Stripe, model-provider, TestFlight, or launch proof. No secret, password, token, photo, or real customer data belongs in this file. Production Remote remains off.

## Exact project and source

On 2026-09-20, the connected Supabase project lookup and authenticated CLI independently returned `Derive`, ref `snojlbqovlawewwqbviz`, organization `xcgzqufanetdduddqiee`, region `us-east-2`, `ACTIVE_HEALTHY`, PostgreSQL `17.6.1.166`. Every hosted test and management SQL command specified that ref. The project was not created, reset, or relinked, and no migration or Edge Function was deployed.

Old draft PR [#21](https://github.com/KanujVerma/derive/pull/21) is historical evidence. Its 2026-09-19 readback first recorded this project, all 15 migrations, 13 active functions, a private photo bucket, and negative smoke with two disposable password-auth users. H1A carried forward and reran the still-useful negative harness. Old PR #21 did not prove email OTP, Stripe, Gemini, an active-member lifecycle, or a published routine. Its direct-host shadow schema diff could not connect, so full independent schema-drift proof remains unverified.

Other unique #21 observations remain dated historical evidence, not 2026-09-20 acceptance: hosted Auth then used the default link-only Magic Link template with custom SMTP off, while the app requires a real six-digit code; unauthenticated `prepare-onboarding` returned 401; an unsigned webhook returned 400 `INVALID_SIGNATURE`; Data API exposed `public` and `graphql_public` with selective application grants. H1E must recheck the email settings before calling OTP passed, and H1B must prove a signed webhook rather than relying on the unsigned rejection. The old PR's H1 handoff recorded the inability to run a full direct-host shadow schema diff. No stale branch was merged into H1A.

## Current hosted readback, 2026-09-20

| Boundary | Result and limit |
| --- | --- |
| Migration ledger | PASS: 15 versions through `20260919222230_e1_membership_entitlements`, matching current source; no new migration needed. |
| Edge inventory | PASS: 13 functions ACTIVE. Twelve customer/founder functions have `verify_jwt=true`; only `stripe-membership-webhook` has `verify_jwt=false` and checks the Stripe signature in its handler. Inventory is not full lifecycle proof. |
| RLS and bucket | PASS: all 21 public tables have RLS enabled. `customer-skin-photos` is private, 10 MiB per object, with image MIME restrictions. Targeted client reads and denials were exercised below; full grant/schema diff was not run. |
| Initial state | One pre-existing Auth user and profile, zero memberships, founder accounts, routines, products, Storage objects, and review tasks. The pre-existing identity was not used or modified. |
| Provider configuration | BLOCKED: hosted secret names contain no `GEMINI_API_KEY`; the founder has not selected a final model. `propose-routine` returned 503 `MODEL_UNAVAILABLE` after committed intake. The free-tier key was verified outside Supabase, but the current management account was denied permission to store it in hosted secrets. No hosted provider call or structured proposal is claimed. |
| EAS preview | PASS for configuration only: linked project `@derive-skincare/derive` has preview `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. A private readback matched both exactly to the verified project and its enabled public key. No TestFlight binary or device diagnostic was observed. |
| Security advisors | Eight informational `rls_enabled_no_policy` notices on deliberately server-only tables; one warning says leaked-password protection is disabled. See [RLS notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). |
| Performance advisors | Five unindexed foreign keys, 14 unused indexes, and one duplicate routine index warning. No schema change was made solely from an advisor. See [foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), and [duplicate indexes](https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index). |

Supabase's [Data API exposure change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically) makes table grants separate from RLS. Targeted customer calls passed below; full grant and exposure inventory should be repeated before production activation.

The user supplied a Gemini auth key and explicitly required free usage. Google AI Studio showed its Derive project as **Free tier** with billing not set up. Google's [current pricing](https://ai.google.dev/gemini-api/docs/pricing) lists standard `gemini-3.8-flash` input/output as free at that tier. A read-only model lookup returned 200 for that key. The attempted Supabase `secrets set` was denied for insufficient project permissions, and names-only readback confirmed no `GEMINI_API_KEY` was stored. One synthetic call through Derive's actual adapter to its default `gemini-3.8-flash` returned Google 503 high demand; a bounded retry returned the same. A diagnostic to `gemini-2.5-flash` returned 404 unavailable to new users, and one to free-tier `gemini-3.6-flash` returned 503 high demand. No validated structured proposal resulted, and no paid request or production model choice was made. Google [documents retry for transient 503](https://ai.google.dev/gemini-api/docs/troubleshooting), but this run stopped after bounded attempts.

## Controlled hosted smoke

`scripts/test-h1-hosted-negative.mjs` ran against the exact project using only its public key. It generated two disposable password-auth users, proved each owned profile read, cross-user profile denial, seven inactive premium Edge 403s, founder 403, blocked client membership insertion, and blocked inactive private upload. Both users self-deleted. This is a current repeat of the narrow older PR #21 result, not OTP or billing proof.

`scripts/test-h1a-hosted-core.mjs` ran two disposable active-core passes. It created password-auth sessions. An authenticated management CLI transaction checked the exact fresh `h1a-*@example.test` Auth IDs and inserted one active membership and one founder allowlist row. No client-callable activation route, app flag, RLS exception, or Stripe identifier was added. The active membership is a synthetic H1A fixture only. The founder allowlist is a disposable test identity, not permanent founder onboarding.

The second pass verified:

- PASS: canonical active membership read from the member client; ordinary member denied founder dashboard; allowlisted founder dashboard succeeded. The founder's ordinary client could not read the member's profile or skin profile.
- PASS: `prepare-onboarding` created member-prefixed front/left/right paths. Three synthetic images uploaded to private Storage. `onboard-customer` committed hosted intake with goal, routine preference, skin behavior, safety state, manual Shelf brand/name/category, and one synthetic reaction history entry.
- PASS: the committed `onboarding_submissions.payload_snapshot` held the manual product with empty `keyActives`, one reaction, and safety answers. `user_photos` and private Storage each held three member-owned records/objects; one founder review task was created. The separate longitudinal `product_reactions` table remained empty; proposal context uses the committed snapshot. No formula, ingredient, catalog, or payment authority was invented.
- PASS: owner photo signing returned a 900-second URL that retrieved the object; the other user's signed-photo request returned 404; other-user photo metadata reads returned no rows; a public object URL did not retrieve the photo.
- BLOCKED: `propose-routine` returned 503 `MODEL_UNAVAILABLE` because the model/provider is not selected or configured. No `awaiting_review` routine, founder routine edit/publish, published customer read, or routine-dependent member tab proof followed.
- PASS: both disposable users self-deleted through `delete-customer-account`. Source inspection shows Storage removal and empty-namespace verification before Auth deletion; hosted readback after each run found zero test memberships, founder rows, submissions, photo rows, Storage objects, and tasks. The original one Auth user/profile remained. The exact internal sequence was reviewed in source and final state observed; per-step production logs were not independently captured.

The staged run is intentional: the CLI `provision` phase uses authenticated management access and generated test IDs, never the public client. It requires `H1A_HOSTED_ALLOW_DISPOSABLE_TESTS=YES`, the exact project URL, an enabled public publishable key, and a private `/private/tmp/derive-h1a-*` state path. `create`, `provision`, `run`, and `cleanup` are separate so the operator can inspect the exact project before each mutation and perform SQL readback before deletion. Never run it in CI, against a real customer, or with a service-role key in `EXPO_PUBLIC_*`. Always run `cleanup` even if a `run` assertion fails; retain the private state file and report only generated disposable IDs or synthetic email identifiers if cleanup fails.

With those environment variables set and the CLI authenticated for the exact project, run `node scripts/test-h1a-hosted-core.mjs create`, verify the two generated IDs in the Derive project, run `node scripts/test-h1a-hosted-core.mjs provision`, then `run`, read back only those test IDs, and finally `cleanup`. Set `H1A_SUPABASE_CLI` to the installed CLI binary if `supabase` is not on `PATH`. The script records pending disposable credentials before signup, then atomically replaces its private state after each result. If interrupted, repeat `run` for the saved account; uploaded photo targets are skipped and committed intake is resumed. `cleanup` accepts an older state file so a forgotten fixture remains removable. Check Auth, membership, founder, intake, photo and Storage counts afterward. If a deletion succeeds but its state update fails, verify the retained ID is absent from hosted Auth before manually clearing the state; do not guess from a failed retry.

## Acceptance matrix

| Gate | H1A result |
| --- | --- |
| Hosted project and migration readback | PASS |
| Hosted functions and JWT settings | PASS inventory, not full behavior |
| Controlled Auth session | PASS with disposable password-auth identities; email OTP deferred to H1E |
| Controlled staging entitlement | PASS via guarded management SQL; Stripe deferred to H1B |
| No client entitlement bypass | PASS in source boundary and blocked client insertion |
| Real email OTP | DEFERRED TO H1E, Sami |
| Stripe Checkout and signed webhook | DEFERRED TO H1B, Sami |
| Real model provider and validated proposal | BLOCKED on final model choice, upstream 503 and permission to store the key in hosted server secrets |
| Hosted onboarding, manual Shelf, reaction snapshot | PASS for tested synthetic intake |
| Private photos and signer | PASS for three synthetic images and tested cross-user boundary |
| `awaiting_review` proposal | BLOCKED by provider gate |
| Founder authorization/dashboard | PASS with disposable allowlist; routine edit/publish BLOCKED by absent proposal |
| Published routine and member surfaces | BLOCKED by absent published routine; no Mock substitute claimed |
| Selected cross-user/inactive security | PASS for tested profile, skin, photo, function, membership and Storage paths; populated routine/check-in/refill/order boundaries unverified |
| Photo-bearing account deletion | PASS for tested final state; code order reviewed |
| Advisors | WARN as above |
| Physical staging build and production Remote | No device build observed; production remains OFF |

## Next owner handoff

Sami owns the model/provider decision, F1 manual routine fallback, H1E email, H1B Stripe, and future platform fixes. Kanuj owns L1A physical-device acceptance after there is a publishable routine path. With the provider undecided, L1A can preflight build/auth/intake but cannot pass its happy-path routine/member checks. F1 may supply the alternate routine origin, but it is a separate Sami milestone and must use the same guarded publication pipeline. Do not charge customer #1 until the later full launch gate passes.
