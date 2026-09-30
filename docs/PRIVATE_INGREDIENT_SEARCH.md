# Private published-ingredient search

Sami P0-A, local phone-testing extension only. On a private UPC candidate, the
customer explicitly taps **Find published ingredients**. The authenticated
`private-ingredient-search` endpoint submits only barcode, name, brand and size
to Gemini 3.8 Flash with Google Search. These are candidate identity hints, not
server-attested canonical identity or proof of the formula in the scanned bottle.
No profile, photos, ingredient history or customer ID is sent to Google.

The full response, source links and unchanged Google Search Suggestions appear
in an isolated Expo-compatible WebView. JavaScript, remote subresources, local
file access, persistent browser storage and caching are disabled. Unsafe markup,
truncated answers, missing search/citation metadata and unsupported destinations
fail closed; the code never sanitizes or invents Google's required widget.
This private slice is phone-only; web shows a notice without querying Google.

## Authority and reuse

This is an ephemeral sourced answer, not an extracted ingredient dataset.
`formulaVerified=false` and `canonicalProductId=null` remain mandatory. No
canonical table, formula continuation, personal-decision input, save action,
numeric score, event tracking or response cache is added. A grounded answer can
still describe an uncertain variant or a missing list; successful search does
not mean successful package/formula verification.

[Google's grounding terms](https://ai.google.dev/gemini-api/terms) require the
associated suggestions and restrict modification, caching and reuse for other
purposes, including database construction. Grounded answers must not silently
feed the catalog or a separate grading pipeline. Such expansion needs a reviewed
provider/rights architecture rather than removing these boundaries.

## Local setup

The server environment, never an Expo environment, needs:

```dotenv
DERIVE_GEMINI_INGREDIENT_TEST_ENABLED=true
DERIVE_UPC_PRIVATE_TESTER_IDS=<exact approved local Auth UUIDs>
GEMINI_API_KEY=<server-only key>
```

Use an ignored/private server environment file with the existing local functions
server. Do not put a key in Git or an `EXPO_PUBLIC_*` variable. The private UPC
launcher deliberately disables dotenv and does not inherit model-provider keys.
No additional mobile public flag is needed: this child exists only inside the
already opted-in development UPC fallback.

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
Kanuj must verify project quota/billing; replacing the key is not necessarily
required. [Current pricing](https://ai.google.dev/gemini-api/docs/pricing) lists
3.8 Google Search grounding as unavailable on the free tier.

Automated fixtures prove transport/parser/display boundaries, not real ingredient
accuracy. A successful current-key response, full widget/citation display on the
iPhone and exact product/variant/package comparison remain pending. No hosted
deployment, public provider activation, GitHub push or App Store release is implied.
