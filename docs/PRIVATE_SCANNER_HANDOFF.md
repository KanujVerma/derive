# Private scanner workflow

This branch preserves the Expo camera and Kanuj's Check UI. A canonical barcode
miss can request UPCitemdb identity, Open Beauty Facts and DailyMed ingredient
evidence, then product-only SerpApi Google Light search and Gemini extraction
from bounded matching pages. Accepted ingredient text appears inside the result
sheet. Local rules compare it with saved skin context. Identity alone is not an
ingredient list, and no numerical personal-fit score is produced.

## Keys

`config/private-scanner.env.example` lists server settings. Actual values belong
in the ignored server `.env` and Supabase Edge Function Secrets, not GitHub or
mobile configuration. A cofounder using the hosted backend does not need copies
of SerpApi or Gemini keys. The deployed server consumes those keys.

## Expo testing

On Sami's Mac, keep the existing private local Supabase stack and ingredient
server running. The local launcher is `node scripts/start-private-upc-expo.mjs`.
The phone and Mac must share a network. The launcher uses only public mobile
settings and does not load provider keys into Expo.

For a hosted test on another Mac, use the reviewed branch, install dependencies,
and start Expo with dotenv loading disabled and these public settings supplied
through the environment:

```sh
EXPO_NO_DOTENV=1 \
EXPO_PUBLIC_USE_REMOTE_SERVICE=true \
EXPO_PUBLIC_BUILD_FLAVOR=development \
EXPO_PUBLIC_PRIVATE_UPC_TEST_ENABLED=true \
EXPO_PUBLIC_SUPABASE_URL=https://snojlbqovlawewwqbviz.supabase.co \
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PROJECT_KEY \
npx expo start --go --lan
```

Use the project's public publishable key, never its service-role key. Do not set
the LAN override for this hosted test. Sign into the hosted tester account; its
Auth UUID must be in the server allowlist. Local and hosted accounts are
different. No public anonymous signup or release activation is implied.

## Limits and status

External records remain attributed candidate evidence, not verified canonical
formulas. OBF remains private evaluation pending reuse/display review. UPCitemdb
trial and web requests have durable server budgets. Personal Gemini processing
stays disabled; local personalized notes do not require it. No reaction history,
identity or photos are sent in product search/extraction requests.

Application tests, TypeScript, exports, isolated migrations and owner isolation
were checked locally. The last live Gemini explanation test timed out, so this
is not a claim of reliable ingredient retrieval. Hosted publication, fresh
provider results and exact commit evidence are recorded separately in the PR.
Kanuj owns PostHog; unrelated analytics work is excluded from this publication.
