# K-FREE-1 scanner-first shell handoff

## Boundary and starting point

Kanuj's branch `kanuj/k-free-1-scanner-first-shell` starts from clean `main@2ca5e09687ed3b8f99b4dbf1bd73d8a0d601eb26`. Before this pass, the app's root tabs were Today / Plan / Shop / Ask / Progress; `app/shop/scan.tsx` held Check a Product, and Mock and Remote routing led through managed-first onboarding. Remote Staging deliberately hid Check.

This milestone changes only customer presentation. It adds no anonymous Auth, backend access, shared contract, persisted My Stuff data, deterministic Personal Fit, OCR, paid enrollment, Stripe, H1P, or TestFlight build. Sami's S-FREE-1 branch is not consumed.

## Presentation and routes

`src/utils/shellPresentation.ts` is a pure client presentation decision, not an entitlement check. Development Mock activates `scanner_first_preview`; Remote, Remote Staging, and production Mock remain `legacy`. No new environment variable is used. The target roots are exactly CHECK / MY STUFF / PLAN / SHOP. The local preview lands directly on CHECK without onboarding. Its pure landing resolver also expresses the future managed-to-PLAN destination for integration tests; no backend access state is inferred today.

| Route | Local scanner preview | Current Remote/Remote Staging |
| --- | --- | --- |
| `/(tabs)/check` | Root CHECK | Hidden from tab bar; Remote Staging direct route remains gated |
| `/(tabs)/my-stuff` | Truthful empty shell | Hidden from tab bar |
| `/(tabs)/plan` | Static Managed Skincare shell; no routine generation | Existing managed Plan and hydration |
| `/(tabs)/shop` | Free presentation shell; no Mock membership data or offers | Existing Shop |
| `/(tabs)/index`, `ask`, `progress` | Not target roots; Today redirects to CHECK | Existing roots and route behavior |
| `/shop/scan` | Same Check implementation as root | Existing legacy deep link |
| `/profile` | Local account/settings shell with no fake account | Existing profile/settings |

The two Check routes are thin wrappers over `src/components/check/CheckProductScreen.tsx`. Search state, barcode camera, S6 states, candidate handling, formula presentation, and contextual Ask behavior remain in that one component. The target preview injects a single sourced product-only CeraVe fixture from the catalog seed. It has no variant, GTIN, formula, or Personal Fit claim. Unrecognized names and barcodes stay unresolved. Live authenticated catalog and S6 calls remain the legacy member path; the preview does not pretend anonymous access exists.

All four target roots expose Account and Settings with at least a 44-point target. MY STUFF reads no demo or member state. Preview PLAN cannot invoke `ensureInitialRoutineProposal`; legacy Plan still can. Preview Shop does not inherit the Mock store's active membership. The old Today, Ask, Progress, onboarding, legacy scanner, profile, and managed Shop implementations remain available in the legacy shell.

## Wave-1 integration handoff

After S-FREE-1 lands, the integration owner should consume Sami's stable access contract at the client boundary and replace only the preview activation in `resolveShellPresentation`. Route free access to CHECK and managed access to PLAN using `resolveShellLanding`; keep the existing tab structure and canonical Check component. Replace the local sample search injection with the authorized free catalog and identity service, then verify anonymous lifecycle and RLS before enabling Remote free Check. Preserve the current Remote Staging gate until a separate release decision. K-FREE-2 owns optional post-value personalization, K-FREE-3 owns My Stuff persistence/history, K-FREE-4 owns image evidence, and K-PAID-1 owns the managed Plan experience. No step here authorizes a TestFlight submission.

## Validation

Focused shell tests cover mode selection, exact tab sets, free/managed landing, shared Check route, safe preview fixture, Plan isolation, free Shop presentation, account affordances, and Remote Staging gate. Local validation passed 341 unit tests, both TypeScript checks, and web and iOS JavaScript exports. Exact-head PR and main CI are landing gates recorded in the PR. Browser-based visual QA was blocked because the browser tool could not verify an administrator policy for localhost; no bypass was used.
