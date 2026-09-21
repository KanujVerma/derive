# L1A Remote staging device preflight

**Owner:** Kanuj. **Scope:** build, install, identify and exercise the signed-out Remote staging mobile binary on a physical iPhone. This is not hosted email OTP, membership, model, founder or customer-launch proof. See [FIRST_CUSTOMER_TEST.md](FIRST_CUSTOMER_TEST.md) for later complete acceptance.

## Build identity and current evidence

| Field | Observation |
| --- | --- |
| Starting shared source | Clean `main@556a43e0b70f50264c459ae476e2214061a8876a`, equal to `origin/main` before L1A branched |
| Branch | `kanuj/l1a-remote-device-preflight` |
| EAS project | `@derive-skincare/derive`, ID `4100d696-3e03-4b2c-bdb3-1986d5f1a624` |
| Build profile | `remote-staging`: `distribution=store`, `environment=preview`, iOS simulator false, `EXPO_PUBLIC_BUILD_FLAVOR=remote-staging`, `EXPO_PUBLIC_USE_REMOTE_SERVICE=true` |
| Other profiles | Development and production both explicitly keep Remote false |
| Public backend config | EAS preview URL and publishable key privately matched enabled values for existing Derive project `snojlbqovlawewwqbviz`; no complete key recorded here |
| iOS app | `com.derive.skincare`, app version `1.0.0` |
| EAS cloud build | **FINISHED** at 2026-09-20 18:37:39 UTC: `d7102b22-5de6-4a74-9c8b-ecbbda291b47`, version `1.0.0 (4)`, source commit `556a43e`, `remote-staging`, iOS STORE distribution; artifact present |
| Diagnostic-fix build | **FINISHED** at 2026-09-21 04:18:58 UTC: `4215f517-9790-4b23-888f-b0747964538c`, version `1.0.0 (5)`, exact code commit `e607031086d15b3c1e5b47a8dfd824ce5daf0500`; App Store Connect reported `VALID` and `IN_BETA_TESTING`; physical TestFlight update completed |
| Apple/TestFlight | The exact staging build used submit profile `production` only for existing `ascAppId=6813524447`; submission `8e1da554-b611-4c26-b5dd-d96b80930dba` **FINISHED** transfer at 2026-09-20 18:39:09 UTC. App Store Connect subsequently reported build `1.0.0 (4)` `VALID`, internal state `IN_BETA_TESTING`, external state `READY_FOR_BETA_SUBMISSION`. No App Store review or public release requested |
| Physical device | Direct USB CoreDevice service is connected, wired, paired and booted on Kanuj's **iPhone 17 Pro Max**, iOS **27.0**, Developer Mode enabled. With user approval after Apple's local-data warning, TestFlight replaced installed build `1` with staging build `4`, then updated to exact fix build `1.0.0 (5)`. USB installed-app readback independently confirmed bundle version `5` |

The first EAS invocation stopped locally because the isolated worktree lacked `node_modules`; it created no cloud build. A locked `npm ci` then completed, and the second invocation created the build ID above. The build used `--clear-cache` because local Metro previously reused Mock output after public environment changes. No production customer release was requested.

Local source checks after the device-discovered diagnostic fix: 267 unit tests passed; application and test TypeScript checks passed; the production Mock web export passed. Existing tests cover Remote configuration failure, staging-only diagnostics, Auth/bootstrap routing, user-switch cache clearing, inactive membership gating, downgrade and backend-only entitlement activation. A targeted source scan found no password login UI, session-token paste, client entitlement override or production Remote enablement. These are static/deterministic checks, not physical observations.

The initial finished IPA was downloaded privately for binary inspection. Its SHA-256 was `ff0bc232ca0381a0b98c71e5c75a8f27fbd4dde819f94f86c735485ba4fc1f95`; `Info.plist` reports `com.derive.skincare`, version `1.0.0`, build `4`. Compiled strings contain `REMOTE STAGING BUILD`, the exact Derive Supabase hostname and one public publishable-key-shaped value. No Gemini auth key or Stripe secret pattern was found. One apparent `sb_secret_` shape was a minified string containing Expo Router's explicit `internal` marker, not a credential. Replacement IPA SHA-256 is `650c184856f7e55cc3f52b5c4ebe4f23077af074987bf2a2e03e54759d0abdf4`; it reports build `5` and contains the `ExpoApplication` native module, staging marker and exact host.

A direct USB install was attempted only after the user approved replacement. iOS rejected the store/TestFlight IPA with `ApplicationVerificationFailed`: “Attempted to install a Beta profile without the proper entitlement.” This is the expected store-distribution boundary and left installed Derive `1.0.0 (1)` unchanged. After Mac Touch ID unlocked iPhone Mirroring, exact build `4` was installed through TestFlight and observed on device.

## Signed-out physical acceptance matrix

Record a dated observation, device model/iOS version and installed build number for each row. `BLOCKED` means no physical claim has been made.

| Check | Current result | Evidence needed |
| --- | --- | --- |
| Store-signed staging binary finishes | PASS | EAS finished build and artifact metadata above |
| Internal TestFlight upload/install | PASS | Builds `4` and `5` both became `VALID` / `IN_BETA_TESTING`; physical TestFlight replacement and update completed |
| Cold launch and restart | PASS | Initial TestFlight launch and USB terminate/relaunch reached signed-out login without native crash; restart cleared the invalid-email draft/error |
| Staging diagnostics | PASS on fix build `5` | Physical screen shows Remote Staging, Remote service, valid public configuration shape, exact `snojlbqovlawewwqbviz.supabase.co` host and `App: 1.0.0 (5)`; no key, token, user ID or server secret visible |
| Signed-out routing and form validation | PASS for observed checks | Login remained canonical; invalid email showed a customer-safe validation error; background/foreground preserved it; process restart safely cleared it |
| Background/foreground and network recovery | PASS | With explicit approval, Wi-Fi and cellular data were disabled. Build 5 cold-launched offline and remained Remote staging. Both settings were restored; the status bar regained Wi-Fi/5G, Safari reached the exact Derive Supabase Auth endpoint, and Derive returned to clean signed-out login without Mock fallback |
| Hosted OTP request/error | Offline error PASS; real delivery BLOCKED by H1E | Offline request used reserved non-deliverable `l1a-offline@example.invalid` and showed “We couldn't send a code right now. Please try again.” No real inbox, code or Magic Link was claimed |
| Camera permission/front camera | BLOCKED | Only where reachable without Auth bypass; otherwise H1E blocker |
| DeriveFaceCapture native module | Runtime BLOCKED by H1E | Auth-gated; binary strings confirm `DeriveFaceCaptureModule`, `DeriveFaceCaptureView` and `AVCaptureSession` are included |
| Barcode camera, haptics and safe area | Barcode runtime BLOCKED; login safe-area PASS; haptic not independently perceived | Binary contains barcode camera settings; signed-out screen respected iPhone safe areas. Camera/Scan remains Auth-gated |
| Authenticated intake/routine/member tabs | BLOCKED by H1E and later F1/H1P readiness | No password UI, token paste, session injection or entitlement override |

## Current handoff and limits

- **Kanuj:** L1A signed-out device preflight is physically complete. L1B later consumes F1 manual recovery; L1C separately consumes H1E/H1P for the authenticated provider path.
- **Sami F1:** founder manual routine fallback remains separate.
- **Sami H1P:** select and configure a real hosted model provider, then prove routine, Ask and Scan calls. The supplied free-tier key could not be placed in hosted Supabase secrets by the current account; H1A documented the permission and upstream 503 blockers.
- **Sami H1E:** real hosted six-digit email OTP is required before the mobile post-auth journey is reachable. H1A's password-auth test sessions cannot be imported into the app.
- **Sami H1B:** Stripe activation is later and is never inferred from the H1A fixture or L1A build.

Do not mark a row PASS from source code, CI, EAS profile labels, a web preview or simulator behavior when its criterion requires the installed physical binary. Production Remote remains off.
