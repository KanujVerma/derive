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

## K-FREE-1B: scanner-first beta UX refinement

Kanuj's physical review found that the first K-FREE-1 shell led with Search and left My Stuff, Plan, and Shop too spacious and explanatory. This pass keeps the four-root IA and changes only its mobile presentation. CHECK opens the barcode viewfinder when permission is granted. Undetermined permission shows Scan barcode and Search by name without prompting on mount; denied permission keeps Search available. Search remains one tap from the camera and one tap back. The camera reads barcodes only; it does not claim label, package, or ingredient recognition.

All target roots now compose the existing `ScreenHeader` with the same 44-point Account control, native person icon, press feedback, and light haptic. My Stuff uses one mineral `GroupedSection` with three honest statuses and no dead chevrons. Plan states Managed Skincare, $25/month, the useful managed-care differences, separate product purchases, and enrollment status without activating billing or routine generation. Shop has one Coming soon state and a Check action without invented commerce. The floating native glass tab bar is unchanged; only Search over the viewfinder uses existing `GlassContainer`. Ordinary content remains opaque mineral surface and hairlines.

Customer copy removes development/runtime explanations, repeated empty-state prose, and generic marketing filler. Existing semantic Button, GroupedSection, ScreenHeader, Icon, and GlassContainer components are reused. Remote and Remote Staging still use the legacy shell; S-FREE-1 integration, K-FREE-2/3/4, and K-PAID-1 remain separate. No EAS or TestFlight build is part of this pass.

Full physical acceptance remains separate because iPhone Mirroring cannot expose the camera. Manual checks: launch Development Mock and confirm Check opens the live barcode viewfinder if already permitted, or the Scan barcode/Search by name choice if permission is undetermined; decline permission and verify Search; scan a known and unknown barcode; switch camera to Search and back; feel account, scan, mode-switch, and reset haptics. Inspect tab-bar glass/spacing and safe area on the device, then foreground/background once. No new Apple submission is authorized by this checklist.

### Physical Expo Go check on iPhone Mirroring

On 2026-09-23, an unlocked iPhone running this branch from the local Development Mock server showed the four-root shell and functional Check header. The camera-permitted state opened the barcode viewfinder, Search was one tap away, the sourced CeraVe result showed separate Personal Fit and Formula Details without a raw source URL, and Check another product returned to the viewfinder. My Stuff rendered one compact grouped section, Plan showed $25/month and enrollment status, Shop showed one Check action, and Account showed no fake connected user. The floating tab bar and root headers remained aligned, with no visible clipping. A Home/background and foreground return kept the shell usable. The blue gear was Expo Go's own development overlay.

iPhone Mirroring reports that the iPhone camera is unavailable from Mac. Therefore the live camera image, barcode recognition, first-time/denied permission prompts, and felt haptic quality were not accepted through this session. Kanuj should check those directly on the iPhone using the manual list above. This pass made no EAS/TestFlight build.

## Wave-1 local integration landed

`local_free_integration` reuses the same four-root shell and canonical Check component when Development Remote points to an exact local Supabase host. It creates anonymous Auth only if no session exists, reads server `FreeAccessState`, lands free users on Check and active permanent managed users on Plan, and keeps the legacy managed bootstrap for managed users only. Integrated free Check uses live `catalog-products` and factual `resolve-product-identity`, never the preview sample or managed `scan-product`. Personal Fit is unavailable pending S-FREE-2. Free Plan, Shop, and My Stuff retain their truthful shells. Anonymous Account links Privacy/Support and uses the existing deletion lifecycle.

Remote Staging and production keep their former behavior; hosted anonymous signup stays gated. Fresh local reset, 425 pgTAP assertions, the S-FREE-1 guest smoke, and the Wave-1 mobile client smoke passed. Expo Go on an iPhone 17 Pro simulator displayed the no-login Check landing, Plan, Shop, and anonymous Account. The physical phone's loopback path and barcode hardware were not proved by this local simulator pass. No EAS/TestFlight build was created.
