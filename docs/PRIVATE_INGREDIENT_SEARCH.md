# Private published-ingredient search

Sami P0-A, local phone-testing extension only. On a private UPC candidate, the
customer explicitly taps **Find published ingredients** or, after one-shot
permission, **Ingredients + my skin**. The authenticated
`private-ingredient-search` endpoint submits barcode, name, brand and size
plus the separately approved minimal context, when requested, to Gemini 3.8 Flash
with Google Search. These product fields are candidate identity hints, not
server-attested canonical identity or proof of the formula in the scanned bottle.
Ingredients-only sends no profile, photos, ingredient history or customer ID.
Contextual mode adds only saved cosmetic goals, skin behavior and reactivity;
the server reads the authenticated owner's latest profile. No owner identifier,
photos, reproductive answers, prescriptions, sensitivities free text, routine,
or reaction history is sent. It is disabled until paid-project processing and
provider privacy handling are explicitly approved.

The full response, source links and unchanged Google Search Suggestions appear
in an isolated Expo-compatible WebView. JavaScript, remote subresources, local
file access, persistent browser storage and caching are disabled. Unsafe markup,
truncated answers, missing search/citation metadata and unsupported destinations
fail closed; the code never sanitizes or invents Google's required widget.
This private slice is phone-only; web shows a notice without querying Google.

## Authority and reuse

This is an ephemeral sourced answer, not an extracted ingredient dataset.
`formulaVerified=false` and `canonicalProductId=null` remain mandatory. No
canonical table, formula continuation, personal-decision-engine input, save action,
numeric score, event tracking or response cache is added. Contextual mode requests
limited cosmetic commentary within the same original answer, not a second grading
pipeline. A grounded answer can
still describe an uncertain variant or a missing list; successful search does
not mean successful package/formula verification.

[Google's grounding terms](https://ai.google.dev/gemini-api/terms) require the
associated suggestions and restrict modification, caching and reuse for other
purposes, including database construction. Grounded answers must not silently
feed the catalog or a separate grading pipeline. Such expansion needs a reviewed
provider/rights architecture rather than removing these boundaries.

Google explicitly includes developer-supplied contextual information in a
Grounded Result. We interpret the single original answer as the minimal viable
contextual-display path, not legal approval for a general extraction pipeline.
The whole answer, citations and Google suggestions remain together and unchanged.
Deodorant/haircare must not inherit facial-skincare suitability; the prompt limits
them to sourced skin-contact considerations. Food/drink/non-personal-care prompts
request unsupported guidance. These are model instructions, not measured category
accuracy or a guarantee against hallucinations. Missing/conflicting lists must not
receive positive suitability guidance. This never invokes Kanuj's canonical
deterministic personal-decision engine or Jev.

## Local setup

The server environment, never an Expo environment, needs:

```dotenv
DERIVE_GEMINI_INGREDIENT_TEST_ENABLED=true
DERIVE_UPC_PRIVATE_TESTER_IDS=<exact approved local Auth UUIDs>
GEMINI_API_KEY=<server-only key>
# Enable only AFTER confirming paid billing + approved privacy handling/adult test access.
DERIVE_GEMINI_PERSONAL_CONTEXT_APPROVED=false
```

Use an ignored/private server environment file with the existing local functions
server. Do not put a key in Git or an `EXPO_PUBLIC_*` variable. The private UPC
launcher deliberately disables dotenv and does not inherit model-provider keys.
No additional mobile public flag is needed: this child exists only inside the
already opted-in development UPC fallback.

The contextual request is the unchanged product identity plus
`personalization: 'basic_skin_context'` and `contextSharingConsent: true`.
Missing/false consent, extra profile fields, or client-supplied owners are rejected.
With the approval flag off, no profile read, reservation or provider request occurs.
With approval on, the newest P0-B profile takes precedence even if unanswered or
withheld; the legacy free profile is used only when no modern profile exists.
Only the minimal projection leaves the server. An opaque SHA-256 fingerprint is
re-read after retrieval; changes/deletion/read failures suppress stale guidance.
The answer represents saved context at search time, not a live profile subscription.

Google's [paid/unpaid processing terms](https://ai.google.dev/gemini-api/terms)
exclude personal/sensitive input from unpaid services. A present/authenticating
API key is not evidence of a paid project. Confirm active Cloud Billing in the
key's project before approving contextual mode. Public/teen activation and
privacy/support/App Store acceptance remain separate; this exact-allowlisted slice
is for adult private testing only. Google's paid service still retains prompts
temporarily for abuse detection; we do not promise zero provider retention.

Apply `20260930020000_private_grounded_search_budget.sql` locally after a fresh
isolated migration reset/test. The service-only ledger retains timestamps only,
reserves before Google, permits 20 attempted calls per rolling day with ten-second
global spacing, and survives owner deletion. Provider failures count. Google
may perform multiple searches inside one attempt; this cap is not a dollar cap.
No automatic retries or model/provider fallback are implemented.

## Current live limitation

The existing local key's product-only test returned HTTP 429 `RESOURCE_EXHAUSTED`
on Gemini 3.8 Flash. The older 2.5 Flash endpoint returned HTTP 404 stating it is
unavailable to this account. No billing setting was changed. The phone backend
is intentionally configured with a blank ingredient key while that is resolved;
it returns a typed configuration failure and leaves the working UPC lookup intact.
The fresh check in this contextual pass again returned 429. Both Gemini and Jev
keys authenticate at their respective read-only model endpoints. Jev is a typed
text-decision provider, not a web retriever, and cannot substitute for missing
ingredients. Kanuj must verify project quota/billing; replacing the key is not necessarily
required. [Current pricing](https://ai.google.dev/gemini-api/docs/pricing) lists
3.8 Google Search grounding as unavailable on the free tier.

Automated fixtures prove transport/parser/display boundaries, not real ingredient
accuracy. A successful current-key response, full widget/citation display on the
iPhone and exact product/variant/package comparison remain pending. No hosted
deployment, public provider activation, GitHub push or App Store release is implied.

## Current verification and phone-test sequence

Reconciled current main `575566b` through merge `3982ad6`, preserving Kanuj's
per-Check intent and result presentation. Full source suite: **940/940 TAP tests**
across 107 TAP-producing files, plus all 20 assertion-only test files completed
successfully (127 total test files). Both TypeScript checks and fresh web/iOS
JavaScript exports passed. Provider credential values were absent from both exports.
Fresh disposable reset replayed all 38 migrations; **702/702 pgTAP assertions**
passed across 31 files. Real isolated Auth/Edge/client tests verified 401/403/400,
typed missing-key 503, approval-off `personalization_disabled`, and forged context
400 with zero Google calls. Exact synthetic owners were removed/read back absent,
and the proof containers stopped with volumes preserved.

Founder approved minimal context on an explicit tap, then confirmed the current
Gemini project uses free quota rather than paid processing. The personal-context
approval flag therefore remains **off**. No sensitive context was sent to Google.
The real product-only request returned 429; ingredient accuracy, original answer
rendering on the iPhone and personalized usefulness are still **not verified**.

Once active project billing/available quota and privacy approval are confirmed:

1. Connect the ignored server-side key and enable the approved private context flag;
   restart local functions only. Never expose the key to Expo or Git.
2. Reload the existing private Expo project; in **My Stuff → Skin profile**, save
   your cosmetic goals, skin behavior and reactivity.
3. Scan a personal-care barcode, compare the external candidate's exact name/size
   with your package, then tap **Ingredients + my skin → Allow this search**.
4. Compare the sourced published list with the bottle. Check that the answer
   explains relevant limitations/uncertainty, not a numerical score or diagnosed
   allergy. For deodorant, facial goals must not produce facial-skincare suitability.
5. Test profile-change/account-switch and missing-list recovery; no public release
   claim follows from this private test.
