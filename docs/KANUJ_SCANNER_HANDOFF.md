# Scanner and personal insights handoff

## Branch and ownership

Source branch: `sami/scanner-personal-insights-handoff`.

Create your own integration branch from this source rather than replacing your
current UX work. Your camera and shared result sheet remain the UI owners.
This handoff does not include the unfinished local PostHog or guest-storage
work. Do not add a second analytics integration or a second result screen.

```bash
git fetch origin
git switch -c kanuj/scanner-ux-integration origin/sami/scanner-personal-insights-handoff
npm ci
```

If your checkout has unpublished changes, commit or preserve them in your own
branch/worktree first. Do not reset them. Review the integration against your
latest camera/result changes before merging. The fetched GitHub main at handoff
time is `7efb9ce`, including PR193. This branch preserves that UI predecessor.

## What is implemented

- Expo Camera barcode decoding and private UPCitemdb product identity lookup.
- Published ingredient retrieval through the existing source adapters and
  SerpApi/page-reading fallback. Identity remains visible if ingredients fail.
- Automatic local analysis using saved profile/routine/product experiences.
  Reaction-product ingredient overlap feeds the existing Personal Fit findings.
  Shared research-flagged ingredients are possible concerns, not a diagnosis or
  proof of the ingredient that caused a reaction. No fabricated numerical score.
- Saved reaction names such as `Old Spice Aqua Reef` are researched without the
  user adding `deodorant`. Published headings supply the missing type. A unique
  fetched candidate proceeds automatically; genuinely different products show
  choices inside the existing reaction-report panel. The known-brand prefix
  parser is bounded, not universal recognition of arbitrary descriptions.
- Found reaction-product facts are cached on-device for the current owner for
  seven days. The original reaction report stays unchanged. Choices and replies
  are fenced across account/session changes. Current published ingredients are
  not promoted to a verified formula or historical package.
- Profile persistence and foreground refresh changes retain the result during
  brief app interruptions instead of resetting ready access on every resume.
- Optional Jev explanation uses the existing explicit consent action and only
  minimal goals/type/reactivity. The automatic local analysis does not depend
  on this model or send reaction history to it.

Key integration seams:

- `src/components/check/PrivateUpcFallback.tsx` and
  `src/components/check/PublishedProductIngredients.tsx` feed the existing sheet.
- `src/presentation/personal-decision/sourceLimitedAnalysis.ts` builds the
  source-limited Personal Fit findings, not another verdict card.
- `src/components/check/useReactionIngredientComparison.ts` and
  `src/services/reactionIngredientResearch.ts` load saved reaction product facts.
- `src/components/p0b-personalization/ReactionProductResearch.tsx` handles
  remembered-name research and inline product choices.
- `supabase/functions/_shared/web-product-ingredients.ts` implements public
  research, variant matching and attributed ingredient extraction.

## What has actually been checked

Sami has tested barcode identification on his iPhone. The newest automatic
short-name lookup has also been tested against live public sources: `Old Spice
Aqua Reef` returned nine ingredients from the manufacturer's linked SmartLabel
page without a generative extraction call. Its source is
`https://smartlabel.pg.com/00012044037522.html` and remains unverified published
evidence. That lookup took about 11 seconds, excluding the app research queue.

The working-tree implementation passed the full suite, both TypeScript checks,
web/iOS JavaScript exports and secret scans of the served iPhone bundle.
The isolated handoff snapshot, excluding unfinished analytics/guest files,
also passed all 1,294 TAP assertions across 148 TAP-producing files, both
TypeScript checks and web/iOS exports. Provider-secret scans found no matches
in the snapshot, its exports or the unpublished branch history.
Inline choice/restart/session isolation have executable regressions. Those are
not proof that the newest flow has already passed on your physical phone.
Ingredient coverage and provider latency vary. Gemini/Jev output is not
guaranteed merely because a key exists.

## Reproduce the phone setup locally

A GitHub push transfers code, not Sami's running Mac, local accounts, `.env`
files, keys, daily quota or Supabase deployment. On your Mac:

1. Install Node/npm, Docker, Supabase CLI and compatible Expo Go. Run `npm ci`.
2. Start the branch's local Supabase stack with `supabase start`. A fresh stack
   applies its migrations. For an existing stack, verify backup and migration
   state before applying pending local migrations. Never reset Sami's or your
   populated stack. The private budget functions from migrations
   `20260930010000` and `20260930020000` must exist.
3. Use your own local Auth account and complete normal profile/bootstrap setup.
   Local email OTPs can be read in the local mail inbox shown by `supabase
   status`. Find your local Auth UUID in Studio's Authentication Users page.
   A hosted UUID is not interchangeable with a local UUID.
4. Create ignored `supabase/.env.scanner-test.local` with the server settings
   below. Get provider values through the founders' secure channel or secret
   manager, never a Git commit/chat/screenshot. Only allow exact approved UUIDs.
5. Serve functions in one terminal, then Expo in another:

```bash
supabase functions serve --env-file supabase/.env.scanner-test.local
node scripts/start-private-upc-expo.mjs --port 8083
```

The launcher discovers your own Mac LAN address and local public Supabase key,
ignores root `.env` files, and checks that the private endpoint rejects anonymous
requests. It does not prove your signed-in account is allowlisted.
Connect your iPhone and Mac to the same trusted Wi-Fi, keep both terminals
running, and scan the printed Expo QR. A USB cable is not required. Allow camera
and local-network access. Do not reuse Sami's `192.168.1.68` address on your Mac.

Required settings in the ignored server file:

```dotenv
DERIVE_UPC_PRIVATE_TEST_ENABLED=true
DERIVE_UPC_PRIVATE_TESTER_IDS=<your local Auth UUID>
DERIVE_WEB_INGREDIENT_TEST_ENABLED=true
SERPAPI_API_KEY=<server-side provider value>
GEMINI_API_KEY=<server-side provider value for optional extraction fallback>
GEMINI_MODEL=<the configured extraction model>
```

For the optional consented Jev explanation, also configure:

```dotenv
DERIVE_INGREDIENT_MODEL_PROVIDER=jev
DERIVE_JEV_INGREDIENT_TEST_ENABLED=true
DERIVE_JEV_PERSONAL_CONTEXT_APPROVED=true
JEV_API_KEY=<server-side provider value>
JEV_MODEL=jev-latest
```

Enable personal processing only under the agreed minimal-context handling and
explicit in-app consent. Leave analytics off. Never put provider values in
`EXPO_PUBLIC_*` variables. Ordinary Mock mode is not this live provider test.

Private server budgets intentionally cap the whole local stack: 80 UPC attempts
per rolling day with an 11-second spacing gate, and 20 ingredient/model research
reservations per rolling day with a 10-second gate. Provider failures can consume
reservations. Existing saved-report research queues also wait between calls.
These are our test limits, not claims about the vendors' paid plans. Do not
delete quota records or bypass gates when a test is rate limited.

## Same-backend and hosted testing

If you test on Sami's running Mac/backend on the same Wi-Fi, you do not need
provider keys on your computer or phone. Use your own account in that backend;
its Auth UUID must be added to the private tester configuration and the local
functions restarted. Never share Sami's session to get around the tester gate.

This handoff does not deploy the new functions to the hosted project. For a
shared hosted test, complete restore verification, migration/function parity,
server secret/flag configuration and approved hosted tester IDs first. Use the
hosted public client configuration and a compatible development runtime, not
the local-only launcher. Keys already stored in hosted Secrets do not by
themselves make the latest source deployed. Public/App Store activation remains
a separate release operation.

## Phone acceptance

Save a real profile and a past reaction report named `Old Spice Aqua Reef`.
Confirm that research starts automatically and either shows attributed
ingredients or a real choice. Scan the actual Old Spice Fresh package and check
that both published lists feed the same Personal Fit findings. Do not infer an
allergy from brand similarity. Also try Aveeno, a missing-ingredient match, an
unknown barcode, different variants and a provider failure. Keep identity visible
when ingredient research fails. Save, restart and reopen; verify exact variant
and evidence state. Take a screenshot and resume the app; the sheet should not
disappear. Try a second profile and account to verify context changes and owner
isolation. Report identification, ingredient retrieval and useful advice
separately. Coordinate Check/result-file edits with Sami before UX integration.

Public reference barcodes from Sami's tests are `0012044038840` for Old Spice
High Endurance Fresh Scent Deodorant 3.0 oz and `0381370015314` for Aveeno Stress
Relief Body Lotion Lavender Scent 18 fl oz. Confirm your bottle's printed barcode
and label rather than applying those lists to a different package.
