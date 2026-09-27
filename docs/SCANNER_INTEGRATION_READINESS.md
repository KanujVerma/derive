# Scanner integration readiness — 2026-09-27

## Scope and source recovery

Starting main: `105b3a3c41132287e7b4df1331eefe72111e58d4` (P0-A runtime #89). A later fetch found P0-B1 #91 on `7ed5a9f1c7d2038cb6818e3901af5a377a52a703`, with #90 and #92 active. Reconcile that checkpoint and rerun gates before publication. Unpublished P0-B work is active on the counterpart host, not abandoned work to reconstruct. #80 owns trusted assessment/service provenance; #88 owns canonical Check/editor/My Stuff and saved-history UI composition. No competing P0-B renderer or packet producer is added here.

## Implemented boundaries

- `supabase/functions/_shared/product-evidence-extraction.ts` is a pure provider-neutral candidate DTO, parser and resolver projection. The client contract re-exports its types; the evaluator uses the same parser. It independently binds evidence ID/role, bounds arrays/text, rejects unexpected fields/accessors and private-path output, preserves literal numbers and ingredient order, and sanitizes failures. Candidate barcode text is label resemblance, never an authoritative barcode lookup, identity, formula or concentration. No provider calls, image reads or endpoint orchestration were added.
- `EXPO_PUBLIC_DEV_SUPABASE_LAN_URL` permits physical QA against an exact opted-in RFC1918 IPv4 address on HTTP port 54321, only with development flavor, Remote mode and the actual development JS runtime. Release, staging and production remain blocked. This is client presentation/testing configuration, not a server authorization or hosted guest activation flag. Details and teardown precautions are in [ENVIRONMENT.md](ENVIRONMENT.md).
- `node scripts/preflight-scanner-device.mjs` performs six read-only local readiness probes. Safe output contains source head, cleanliness, toolchain/model counts and configuration shape, not device names/identifiers, credentials, paths or native errors. Failed probes remain unknown. It does not authenticate, contact Supabase, install, launch or change permissions. It cannot prove Expo Go compatibility, installed app identity or physical acceptance.
- The agent guide records evidence-grounded challenge and escalation: surface major architecture decisions; continue bounded implementation; preserve active counterpart work.

## Physical testing and first observed blocker

The founder connected a USB iPhone and opened Expo Go while the Mac used the phone hotspot. An ignored `.env.local` in the isolated worktree points only at a disposable local backend; the original dirty auth checkout and hosted settings are untouched. The app server and local Auth health endpoint responded. A browser inspection rendered Check, Search by name, package photos and four tabs without an error overlay. This is browser evidence, not iPhone camera acceptance.

The first physical attempt returned: “You need to be signed in to Expo Go and Expo CLI.” The local CLI reported not logged in. Stop physical verification at that boundary: the founder must sign into the same Expo account in the phone app and local CLI, then restart the development server. Never send passwords or Expo credentials through chat. [Expo's current account requirement](https://docs.expo.dev/troubleshooting/expo-go-sign-in-required/) is development tooling, not a customer requirement to log into Expo when Derive ships as its own app.

The founder subsequently completed local CLI login; `expo whoami` verified an account, and the agent restarted the same local server. The founder then opened Derive successfully on the iPhone and supplied screenshots showing a real camera feed, an unknown barcode result and an empty product search. The original account error is not a Derive Auth failure and does not justify changing Supabase, customer credentials or security policy.

### Capture UX recovery, separate review increment

After reconciliation with `main@86c9e03985c299a407e3f041fcad83afd0fee90a`, the screenshots demonstrated an actual layout defect: the floating tab bar covered the shutter. The capture host now presents a full-screen modal with a native safe-area provider, rather than rendering below the tab bar. Compact instructions and wrapping mode chips scroll separately from the action footer. Barcode mode includes a visible alignment aid; detection still uses the whole preview, not a claimed region-of-interest filter. Busy shutter and selected-mode accessibility are explicit. The two capture leaves changed; canonical Check, root navigation and product data did not.

The founder reloaded the development app and answered **yes** when asked whether capture hides the tabs and leaves the shutter fully visible. Browser inspection also verified full-screen permission presentation and Close returning to Check. No Mac camera permission was granted. This evidence confirms the reported overlap recovery, not every camera lifecycle, alternate device, font-scale or customer-journey test. Full test/build checks and exact-head CI remain distinct from physical acceptance.

After loading the current development bundle, the founder operates the real camera and permission prompts. Observe cold launch/guest access, allow/deny/retry, barcode capture, three package roles, retake/cancel, double tap, connection interruption, unknown/candidate recovery and owner switch. Use [the existing physical checklist](../src/components/check/capture/K4_COMPOSE_DEVICE_CHECKLIST.md). Record exact source/runtime/environment and each result; do not record private images, owner identifiers or token-bearing URLs. Do not call a browser render, JavaScript export or developer inventory a camera pass.

## Acceptance that remains open

- #81/#86 P0-A remain partial: no rights-cleared real-photo corpus, approved live extractor or observed accuracy/latency/cost benchmark. No photo recognition is claimed.
- P0-B work through merged #96 is preserved in the reconciled tree. Kanuj remains owner of canonical Check, editor, My Stuff and result composition. This capture-only increment does not certify complete same-snapshot service/UI acceptance.
- Phone app load, real camera feed, unknown-barcode recovery and capture-tab/shutter visibility were observed or founder-confirmed. Deny/retry, retake, interruptions, small-device/font-scale coverage and the complete customer journey remain unverified. A JavaScript export or browser render is not a physical camera pass.
- No hosted migration/function deployment, guest activation, billing/referral/link changes, #35/#71 changes or original-auth cleanup occurred. Existing local volumes are preserved. The temporary local database project ID must be restored before committing configuration.

## Verification record

Before P0-B1 reconciliation: all **43 unit files / 533 tests**, both TypeScript checks, web and iOS JavaScript exports; a fresh isolated reset followed by **19 pgTAP files / 486 assertions** and **all 17 current CI integration harnesses** passed. This checkpoint is not sufficient evidence for the later reconciled tree. Final exact-head results and CI belong in the PR/return packet, not a predicted self-referencing SHA in this ledger.

After reconciling `main@7ed5a9f`: all **44 unit files / 551 tests**, both independent TypeScript checks, web and iOS JavaScript exports passed. Release exports deliberately disabled dotenv loading so the ignored physical-QA LAN configuration was not compiled into them. A second fresh isolated reset, **19 pgTAP files / 486 assertions**, and **all 17 integration harnesses** passed. No test failure was waived. The temporary project ID was restored; no Supabase configuration change is included in the PR. Exact-head CI and physical acceptance remain separate gates.

After reconciling `main@86c9e03` and applying the capture UX recovery: **50 unit files / 590 tests**, both TypeScript checks and web/iOS JavaScript exports passed, with release dotenv loading disabled again. The three added source-boundary tests failed against the old capture and pass against the fix; they do not prove pixel geometry. The UX increment changes no backend/schema. Earlier local database counts are historical, not a fresh certification of this later P0-B tree; current exact-head CI must pass its reset/pgTAP/integration job before merge.
