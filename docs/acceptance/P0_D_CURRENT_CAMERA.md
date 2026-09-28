# P0-D current camera acceptance, 2026-09-27

## Physical current-source checkpoint, 2026-09-28

**Environment:** iPhone 17 Pro Max, iOS 27.0, wired and trusted; Expo Go 57.0.9 opened a Metro LAN bundle from source `77768e209870f962aab12fe0a04086c492015d59` with dotenv disabled, `EXPO_PUBLIC_BUILD_FLAVOR=development`, and Remote service disabled. This is Development Mock. Main later advanced to `666fe1d` only through catalog documentation, a read-only script and its test, with no app-runtime file change. The separately installed Derive 1.0.0 (10) app was not used. Xcode CoreDevice screenshots of the phone supported observation; a founder performed the taps. Temporary screenshots were kept outside Git, and no customer photo or private account record was submitted.

| Physical step | Observed result | Limit |
| --- | --- | --- |
| Launch and Check entry | Expo Go loaded the current source; Check showed one Open camera action, Search by name, Account, and four root tabs. The controls were visible without clipping on the 17 Pro Max. | Development Mock, not a signed candidate or hosted guest first launch. |
| Auto camera | Open camera presented a live physical preview. Close, torch, guide, mode chooser and shutter were visible together; the bottom tabs did not cover the shutter. The founder confirmed the torch toggled. | Permission success was observed, but a fresh permission prompt, denial, Settings recovery, rapid taps and interruptions were not tested. |
| Manual fallback | Choose what to capture revealed Auto, Barcode, Front label, Ingredients and Packaging while keeping the shutter visible. Close returned to Check. | No shutter photo, ambiguous-still review, Retake or package evidence handoff was observed. |
| Name-search fallback | Search opened the native keyboard without hiding the field or result action. Entering `CeraVe` showed one Renewing SA Cleanser result; tapping Check opened its result. | This is a Development Mock result, not hosted catalog coverage or a real bottle/barcode match. |
| Result and optional context | The result showed sourced product identity, explicitly said exact package formula was not verified, and showed Personal Fit as not personalized. Personalize opened step 1 of 3 with Back, Skip, goals and a visible Continue action; Skip returned to the same factual result without entered context. | No actual personal decision, profile save, supported formula or customer comprehension is proven. The preview gave no verified personal recommendation or package-verification action. |
| My Stuff and Account | My Stuff showed honest empty profile, products, Check history and reactions; Account opened. In this no-account preview, Account showed only `No account set up.` | Privacy, Support and deletion entries were not visible in Development Mock. The separate hosted free-account UI has source paths for them, but no physical or hosted acceptance was run. |

### Camera visual follow-up, 2026-09-28

After the initial checkpoint, the same iPhone loaded the isolated camera source at `abaa9b2e2d35774d677669b70c350580142b1e77` through Expo Go in Development Mock. The founder opened the live camera, opened the bottom-right `Auto` selector, and closed it. CoreDevice screenshots showed circular Mineral-colored Close and Torch controls without the earlier white outlines, a centered shutter, a compact `Auto` selector, a five-row mode menu with the current choice marked, and no persistent instruction above the shutter. The preview remained live in both observed states. A blue floating gear belonged to the phone's system overlay, not Derive's capture controls.

This verifies the open and collapsed layouts on the iPhone 17 Pro Max. The screenshots cannot establish animation smoothness, VoiceOver, smaller-screen fit, or a camera-to-result transition. No product, barcode, or photo was captured in this follow-up. [PR #152](https://github.com/KanujVerma/derive/pull/152) merged this visual change after both exact-head CI jobs passed; its main merge is `5ceba5b5bc0412aa8803d3dcfc5394afdff0650a`.

No real skincare product was at hand, so UPC-A, EAN-13, EAN-8, ingredient-panel capture, difficult visual cases, and actual product identification remain **UNVERIFIED**. Small-screen/Dynamic Type, VoiceOver, save/revisit, owner transition, network loss, current hosted runtime, signed binary, TestFlight and an unassisted participant also remain open. These directed founder interactions are not the K4 human-study pass. The source release preflight still fails on production Mock service and legacy shell.

## Earlier source and Simulator checkpoint, 2026-09-27

Scope: Kanuj's Check entry and the merged Sami Auto camera at starting main `aefbd46085698d49be9789b7742acbf2a1288471`. This earlier section records source and development Simulator evidence only. Issue [#100](https://github.com/KanujVerma/derive/issues/100) remains open.

## Environments and evidence

| Layer | Actual observation | Limit |
| --- | --- | --- |
| Source and tests | Current branch uses `CheckCaptureHost` and `ProductEvidenceCapture`. The focused Auto, operation-gate and capture UX tests passed 15/15 before the entry fix. The new entry and existing composition tests failed on the old entry, then passed 6/6 after the fix. After rebasing onto merged K3 main `137facf71e19111c7dbdaa743a37510af1cd8a5b`, full `npm test` passed across 62 test files and 665 registered TAP cases; the 21 focused tests, app/test TypeScript, web export and iOS export also passed. | Unit and source assertions cannot prove native camera behavior. Exact-head CI is required after publication. |
| Simulator | iPhone 17 Pro, iOS 26.5, Expo Go 57, current-source development Mock, with no service call. Metro bundled 1,700 modules and Check rendered. Before the fix, AX and screenshot showed `Scan a barcode` as primary and package photos hidden behind `Other ways to identify`. After the fix, AX and screenshot showed `Check a product`, `Open camera` and `Search by name` directly. | XcodeBuildMCP `tap` and `touch` reported success for several Check controls, but repeated snapshots showed no navigation or disclosure. No in-camera interaction can be counted. |
| Smaller Simulator | iPhone 16e, iOS 18.4, booted; the installed Expo Go app received the current-source URL. | The `Open in Expo Go?` system prompt remained after an automation-reported tap. The app layout was not observed there. |
| Physical | Paired/wired iPhone 17 Pro Max, iOS 27.0, Developer Mode enabled. A single `devicectl` lock-state check returned `passcodeRequired: true`. | No current-source app installation, camera control, barcode, layout or recovery was observed. Do not use the older installed Derive binary as current-source proof. |
| Live service and human | None in this K1 pass. | Development Mock does not prove hosted Auth, product resolution, private upload, result flow or first-time customer comprehension. |

Screenshots captured through XcodeBuildMCP: pre-fix `/var/folders/ff/ztddg8yn7c9fmbdh7rdwnc2m0000gn/T/screenshot_optimized_931492ea-80b1-4259-808d-949e06b65a9b.jpg`; changed entry `/var/folders/ff/ztddg8yn7c9fmbdh7rdwnc2m0000gn/T/screenshot_optimized_209edd79-14c9-4edb-a5a1-f7ec8ff938bd.jpg`. These are temporary host artifacts, not portable release receipts.

## Current-camera matrix

| Scenario | Source or test evidence | Native status |
| --- | --- | --- |
| Check entry, simple Auto default | Target Check now has one `Open camera` primary action and a visible name-search fallback. `openCapture('barcode')` reaches the existing host; `ProductEvidenceCapture` initializes `intent` to `auto`. Search return uses the same path. | Changed entry visibly rendered on iPhone 17 Pro Simulator. Opening its camera remains unverified because taps did not change UI. |
| UPC-A, EAN-13, EAN-8 | `isObservedRetailBarcode` tests check symbology-bound lengths and check digits, including Expo iOS's 12-digit UPC-A event labeled EAN-13. Compressed UPC-E remains excluded. | No optical scan observed on Simulator or physical phone. |
| Package shutter, ambiguous still, correction, Retake | Source exposes shutter, explicit `Which part is in this photo?` when Auto cannot classify a still, role choices, `Use photo` only after a choice, and Retake. | No native capture or review observed. |
| Torch, Close, cancellation, background/foreground | Source exposes torch and Close; operation-gate tests cover cancelled pending operations. | No native control or lifecycle result observed. |
| Repeated taps and barcode/photo races | Focused tests cover the synchronous operation gate and same-tick barcode-to-review evidence snapshot. | No native stress run observed. |
| Permission denial and Settings recovery | Source shows `Enable camera` or `Open Settings` according to permission state. | Neither denial nor recovery observed. |
| Return to Check/result, unknown recovery | Source keeps the existing capture handoff, search and unresolved-result paths. | No camera-to-result or live-service transition observed. |
| Touch size, safe area, small screen and large text | Source uses 44-point minimum role/top controls, a 72-point shutter, safe-area insets and scrolling for controls. | No in-camera layout or Dynamic Type observation. |

## Finding and disposition

The first Check screen still presented a barcode-only primary action after Auto had landed inside the capture host. `CaptureEntry.tsx` labeled the action `Scan barcode` and hid photo choices, while `CheckProductScreen.tsx` mounted it for the target shell. This made the current customer entry contradict the one-camera Auto intent. The Kanuj-owned composition fix replaces that entry with `Open camera` and a visible `Search by name` fallback, and changes the search-return label. It reuses Sami's existing Auto host. Sami's camera and capture files remain untouched.

The Simulator input result is a tooling blocker, not evidence that Check controls are broken. XcodeBuildMCP found the controls and reported taps, but the screen hash and visible UI did not change for `Scan barcode`, `Search by name`, `Other ways to identify`, or the updated `Open camera`. The same limitation prevented clearing the smaller Simulator's system prompt. The camera, physical, hosted and unassisted customer gates remain open.

## Next acceptance pass

On an actually unlocked supported iPhone, install or load the exact candidate source and record binary/runtime identity. Exercise Check to Auto, UPC-A, EAN-13 and EAN-8, still capture through clarification and Use photo, manual correction, torch, Retake, Close, denied permission and Settings recovery, background/foreground, rapid taps, both capture races and Check/result return. Repeat on a smaller supported layout with large text, inspect 44-point touch behavior and bottom controls, then conduct the separate eligible unassisted adult comprehension session. Record each layer without carrying a source or Simulator pass into physical, hosted or human acceptance.
