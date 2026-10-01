# Free-source ingredient lookup — private local test

## What runs now

After a canonical barcode miss, the existing private UPCitemdb fallback identifies
a possible product. The scanned-product screen then automatically requests
`private-product-ingredients` with only barcode and optional name, brand and size.
The authenticated, exact-allowlisted server queries two free, no-key sources in
parallel:

- **Open Beauty Facts:** barcode-based cosmetic ingredient text, when available.
- **DailyMed:** U.S. public drug labels by name/variant (sunscreen/acne/etc.). This
  is not a UPC-to-NDC conversion or a verified barcode/package match.

The phone displays separate source lists, links, retrieval dates and attribution.
It never concatenates conflicting source formulas. Failures retain the product
identity result and show missing/ambiguous/rate-limited recovery. A validated Old
Spice GTIN can open its manufacturer SmartLabel page directly; this is navigation,
not API ingestion or ingredient extraction.

Ingredient retrieval sends no photos, profile, reaction history or model keys, and
does not write database formulas or numerical scores. The saved-context panel
remains a history display; the separate local ingredient notes now compare lists
with the saved profile as described below.
Confirmed name/brand saving to My Stuff is a separate existing action. Retrieved
ingredient lists remain ephemeral and disappear on closing the screen/app.

## Personal notes and optional model wording

The same screen now compares each available ingredient list separately with the
authenticated owner's saved profile, locally. It writes full, qualified sentences
about recognized moisturizing ingredients and fragrance/alcohol considerations.
Deodorant and haircare comparisons use reactivity only, not facial dryness/goals.
These limited cosmetic rules do not determine the cause of a prior reaction or
prove product suitability. They do not read reaction history, prescriptions or
pregnancy answers. If sources have no list, the customer can paste their bottle's
ingredient text and explicitly compare it locally. Pasted text is not saved.

An optional, separate **Ask AI to explain with my skin profile** action requests
one-shot consent for Gemini wording. The new `private-ingredient-explanation`
endpoint uses supplied ingredient text and server-read minimal skin context;
it does **not** use Google Search. It remains exact-tester gated and blocks profile
processing until `DERIVE_GEMINI_PERSONAL_CONTEXT_APPROVED=true` is explicitly
approved with an appropriate paid project. The phone environment remains unapproved
with no model key loaded. No actual customer's context has been sent to Google.
No ChatGPT or Jev integration is represented by this button.

A bounded live adapter test with public ingredients and synthetic context returned
HTTP 200 and two full sentences with Gemini 3.8 Flash. An earlier bounded basic
generation returned 503. This proves one working synthetic request, not reliable
phone guidance. Real local Auth/Edge tests verified anonymous 401, forged input 400,
and the unapproved-processing gate 503 before loading a profile or calling Gemini.
The exact synthetic fixture was removed and Auth absence read back.

## Source boundaries

Open Beauty Facts rejects checksum/identity/category conflicts, including food
records with matching barcodes, missing expected brands, incompatible product forms
and conflicting SPF/strength. DailyMed keeps ambiguous labels unresolved and checks
label SETID before displaying bounded active/inactive declarations. These guards do
not prove the formula on a specific U.S. bottle or that the source is up to date.

OBF database content has ODbL obligations. This code uses the existing **private
evaluation only** gate; there is no bulk import, proprietary canonical promotion,
response cache or public activation. Review reuse/display/share-alike obligations
before customer-facing deployment. DailyMed's government-work reuse policy does
not grant blanket rights over privately contributed images or promotional text.
P&G's public website backing endpoint can technically return Old Spice ingredients,
but its terms require permission for commercial collection/display; no adapter for
that endpoint is enabled or installed.

- [OBF API](https://support.openfoodfacts.org/help/en-gb/11-open-beauty-facts/101-where-can-i-find-the-open-beauty-facts-api-and-data-exports)
- [OBF licensing](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/)
- [DailyMed API](https://dailymed.nlm.nih.gov/dailymed/app-support-web-services.cfm)
- [NLM copyright policy](https://www.nlm.nih.gov/web_policies.html#copyright)
- [P&G terms](https://termsandconditions.pg.com/en-us/)

## Local setup and limits

The new function reuses `DERIVE_UPC_PRIVATE_TEST_ENABLED=true` and
`DERIVE_UPC_PRIVATE_TESTER_IDS=<approved exact Auth UUIDs>` in an ignored local
server environment. No API key or new public mobile flag is required. JWT,
server-side Auth and tester allowlist precede input validation and outbound calls.
Only four identity fields are accepted; extra profile/owner fields are rejected.
The existing service-only external-candidate budget reserves each attempt before
source calls. It is shared with other external lookups; provider outages consume
attempts. There are no automatic retries. The ingredient sources have independent
upstream limits, so the existing application budget is not an upstream guarantee.

The current local Expo/private server connection is preserved. This is not hosted
deployment, public access, physical UI acceptance or App Store readiness.

## Actual diagnostic evidence, September 30

Real local Auth → Edge → budget → public APIs → client parser completed without
Gemini or source keys. Six diagnostic queries returned **no accepted ingredient
list**: CeraVe Hydrating Facial Cleanser, Sun Bum Face50 Premium Sunscreen, Nizoral
Anti-Dandruff Shampoo, Nivea Creme, Vaseline Rosy Lips, and the user's Old Spice
Fresh. Nizoral/Old Spice were ambiguous; OBF's CeraVe soda record was rejected.
The later Face50 token handling correction also leaves Sun Bum unresolved as
ambiguous rather than accepting a different label.
The first five barcodes were locally decoded from the supplied Target images and
are diagnostic candidates, not independently reviewed benchmark gold. These
results are not a representative target-cohort hit rate or a claim of store coverage.

A separate **name-only reference probe**, CeraVe AM Facial Moisturizing Lotion
SPF30, returned DailyMed's 461-character active/inactive declaration through the
same real Edge route. Its diagnostic barcode was synthetic identity context, not
claimed package verification. The tagged local test account was removed and Auth
absence confirmed; no products were saved by ingredient retrieval.

The repeatable integration diagnostic is
`scripts/test-product-ingredients-local.mjs --local-live-free-sources` (run with
Node's strip-types support). It requires the script's synthetic UUID temporarily
included in the **local-only** server allowlist, alongside current testers. Restore
the original ignored server environment afterward. Never add this fixture to a
hosted allowlist.

**Conclusion:** API stitching is implemented, but these free sources do not yet
provide adequate ordinary U.S. cosmetic coverage. A licensed broad ingredient
source, approved manufacturer facts, or package text supplied by the user remains
necessary to cover those misses. Google/MCP wrappers do not supply missing data or
reuse rights. The new local notes help only when an ingredient list is available;
do not claim this solves target-store coverage or establishes a personal-fit verdict.
