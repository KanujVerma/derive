# App Store binary source preflight

This is a bounded source audit for the first U.S. scanner-first release. Run
`node scripts/preflight-app-store-release.mjs` from the repository. It reads
fixed, non-secret source files and emits a status report. Exit 2 means a known
source blocker or remaining candidate verification; exit 1 means the audit
itself could not run. This source-only command never exits 0. `PASS` on a source
gate means only that the inspected source has that property. The overall report
cannot become `PASS` because it does not inspect a candidate archive, hosted
runtime, device, Apple account, or App Store Connect.

The optional `--public-config-env` checks the shape of the public Supabase URL
and publishable key supplied in the process environment. It never prints them.
It does not read EAS's remote environment or prove the values embedded in an
archive. Do not commit actual client values or use a service-role key.

## Source findings at `main@2f6671d25d762bca32396be220a3fb070749c5e1`

| Gate | Status | Evidence and next proof |
| --- | --- | --- |
| Bundle and version | PASS for source | `app.json` uses `com.derive.skincare`, marketing version `1.0.0`, matching `package.json`. Final archive and App Store Connect version remain unverified. |
| Native build number | READY TO VERIFY | EAS uses remote version source and production auto-increment. Read back the actual archive `CFBundleVersion`; do not infer it from source. |
| Icon and device family | PASS for source | `assets/icon.png` exists; `supportsTablet=false`. Inspect generated asset catalog and archive device family. |
| Minimum iOS | UNKNOWN | `app.json` does not set a target and no committed `ios/` project exists. Read generated `IPHONEOS_DEPLOYMENT_TARGET` in the candidate archive/build log. |
| EAS identity/profile | PASS for source | Project `4100d696-3e03-4b2c-bdb3-1986d5f1a624`; production is store distribution, non-simulator, EAS production environment. Verify actual build record and Apple bundle identity. |
| Production service mode | BLOCKED | `eas.json` explicitly sets `EXPO_PUBLIC_USE_REMOTE_SERVICE=false`; `getDeriveService()` selects `MockDeriveService` when false. Do not change it before Sami's hosted handoff and reviewed production activation. |
| Scanner-first hosted shell | BLOCKED | `resolveShellPresentation()` returns `legacy` for every non-development flavor. A production Remote flag alone would still expose the legacy shell. This needs a separate reviewed hosted scanner-first integration and end-to-end acceptance. |
| Public Supabase client | UNKNOWN | Production EAS public URL/key values were not read. `--public-config-env` accepts an explicitly supplied hosted `https://*.supabase.co` base URL and `sb_publishable_` key shape as source input; it still cannot prove archive embedding, reachability, Auth, or RLS. |
| Fixture routes | READY TO VERIFY | `app/personalize/fixture.tsx` guards its content behind `__DEV__` and development flavor; `_layout.tsx` protects the route. Inspect the final archive/deep links and customer presentation. Mock service and other fixture-backed paths remain a blocker through production service mode. |
| Encryption | READY TO VERIFY | `usesNonExemptEncryption=false` is declared. Source dependencies include platform HTTPS and Supabase transport. Review actual archive dependencies and export compliance before confirming an exemption; no custom cryptography was established by this source pass. |
| Camera/photos | PASS for corrected source strings, READY TO VERIFY for binary | `app.json` names barcode scanning and product/skin camera photos, plus library selection for shelf photos or a message attachment. `CameraCapture` disables library selection for standardized face baseline capture. `expo-camera` and `expo-image-picker` implement these paths. Check generated `Info.plist` and actual prompts against the final app. No app-level microphone, location, contacts, Bluetooth, or tracking purpose string is configured. Native plugins may add strings, so inspect archive. |
| Analytics/tracking | READY TO VERIFY | `src/services/analytics.ts` logs only in development and has no PostHog sender or session replay transport. Repo searches found no ATT/IDFA implementation. Inspect linked frameworks, privacy report, and network traffic in the final binary; source absence is not a tracking declaration. |
| Privacy manifests and required-reason APIs | READY TO VERIFY | No app-level `PrivacyInfo.xcprivacy` is committed. In the installed dependency tree, manifests exist for Expo Application, Expo Constants, Expo File System, React Native, and Async Storage. Expo File System declares file timestamps and disk space; React Native and Async Storage declare other categories. This is dependency-source evidence only. Do not add guessed reason codes. |
| Toolchain | READY TO VERIFY | Local Xcode 27.0 and iOS SDK 27.0 were read with `xcodebuild`/`xcrun`. EAS production does not pin an image, so read the actual builder image, Xcode version, and SDK from candidate build logs. |
| Archive and App Store Connect | READY TO VERIFY / UNKNOWN | No candidate archive or private Apple account metadata was inspected here. |

Apple's [current minimum upload requirement](https://developer.apple.com/news/upcoming-requirements/?id=04282026a)
is Xcode 26 or later with the iOS 26 SDK or later. EAS [selects an image based
on project configuration when `image` is omitted](https://docs.expo.dev/build-reference/infrastructure/),
so the local toolchain cannot certify its builder. Apple's [privacy manifest
guidance](https://developer.apple.com/documentation/BundleResources/privacy-manifest-files)
and [required-reason API guidance](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api)
require checking what the final target and linked SDKs actually bundle.

## Candidate evidence required after final source merge

1. Record exact Git SHA, approved production profile and remote EAS environment
   shape. Verify Remote mode and scanner-first hosted shell independently.
2. Build the authorized store candidate. Read back EAS build ID/image, Xcode,
   iOS SDK, archive bundle ID, marketing version, build number, deployment
   target, device family, icon, entitlements, and generated permission strings.
3. Generate Xcode's aggregate privacy report from that archive. Inventory all
   bundled SDK manifests, required-reason API categories/reasons, tracking
   domains, ATT/IDFA and data collection. Reconcile with App Privacy answers.
4. Confirm fixture/development routes are unavailable in the candidate and
   production diagnostics do not transmit or print sensitive data.
5. Test scanner-first guest, known and unknown product, optional context,
   history, account deletion, camera/photo permission behavior, and network
   endpoints on a physical device against the exact hosted release candidate.

The preflight intentionally performs no EAS build, submission, App Store
Connect mutation, hosted activation, or public deployment.
