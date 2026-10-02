# Search, scan and return — 2026-10-01

Owner: Kanuj for Check composition and customer acceptance; Sami retains capture/platform/truth ownership. Immutable base: remote main `7efb9ce446c6b7b54b3803fa85522b47da2a05ee` (PR193), reconfirmed after validation. Local branch: `kanuj/ux-search-scan-qa`. No push, merge, deploy or hosted activation is authorized in this pass.

The isolated checkout preserves the clean prior `kanuj/ux-check-profile-preview@2da7e86` and its Expo process on8083. Current-source Development Mock preview runs on8084: `http://localhost:8084/check`; LAN Expo Go URL at verification is `exp://100.110.143.135:8084/--/check`. This address may change with the host network. Node22.23.0 runs the new Metro process in the isolated checkout. The first Node20 preview process was replaced; the preserved8083 process was not restarted.

## Completed bounded fixes

- Check owns search query/results across camera mounts. Owner changes reset them. Cancel, retry and resume preserve honest input; changing input, cancelling, selecting and disposal fence late successes and failures. Same-query requests and rapid duplicate selection are suppressed. Dismiss releases selection so the retained row can be checked again.
- No-match explains exact-name/variant, manual-name and package-photo recovery. Manual name entry now works in Development Mock with the fixed grey verdict, no invented identity/category/formula, and usable search/photo actions after expansion. Product names do not supply ingredients. Sourced sample listings still leave their unverified package formula unknown.
- An unmatched Development Mock barcode gets a transient unknown recovery sheet, bound to owner and scan rather than an invented truth snapshot. Dismiss clears old product/check state, abandons its operation and starts the existing fresh capture session. Old results/dismisses cannot publish into a later scan.
- The Check capture host accepts one handoff per mount, pauses barcode detection when background/inactive, and retains a completed handoff locally until foreground. It then delivers once without a second resolver call. This does not change Sami's camera controller or claim the native preview resumes correctly on hardware.
- Historical formula copy compares retained structured formula IDs. A variant mismatch alone is not called a changed formula. Copy distinguishes same recorded formula, different recorded formula and unknown comparison; no ingredient cause or tolerance is inferred. Evaluator actions and red/amber/green policy are unchanged.

## Acceptance evidence

| Check | Status and scope |
| --- | --- |
| Loading/cancel/resume/error/retry | Passed controller and actual component-handler fixtures; private transport errors are not exposed. No hosted lookup outage was induced. |
| Input edit, stale success/failure, duplicate request/selection | Passed focused automated fixtures and aggregate suite. |
| Search → result → dismiss → same row again | Passed rendered Development Mock browser check; query and exact list retained. |
| Search → camera → close → search | Passed browser recovery/retained-input check. Browser camera permission was not granted; this is not camera acceptance. |
| Known sample link → result → dismiss; unsupported link | Passed rendered Mock check and existing link controller/intake fixtures; inputs retained, unsupported links recover without invented truth. Live remote link resolution unrun. |
| Scan fixture → current sheet → dismiss → next scan | Passed lifecycle/binding fixtures, including rejection of old scan/owner/snapshot and stale dismiss. Barcode optics and post-dismiss native camera resume unrun. |
| Background handoff, duplicate callbacks | Passed actual host-handler fixture with AppState transitions, local pending evidence and one foreground delivery. Physical interruption behavior unrun. |
| Fixed four verdicts / findings / Source | Green, amber, red and grey rendered at390×844. Expanded main findings and material limits remain visible while scrolling; Source adds provenance only. Host renderer regressions pass. Native swipe/VoiceOver unrun. Browser semantic handle input was unreliable; visible coordinate activation worked. |
| Unknown category/unsupported goal | Existing conservative fixtures retain grey/evidence limits and do not infer routine role, efficacy or formula. Actual manual/no-match recovery offers exact search and package photography; canonical live next-step actions remain bound to the validated packet. No unsupported category policy added. |
| iOS simulator | Discovered booted iPhone17 Pro/iOS26.5; existing ExpoGo57.0.9 loaded current Check entry. Native screenshot inspected. Simulator touch was unavailable through supported tools; no full native journey claim. |
| USB iPhone | Connected iPhone17 Pro Max found. Available device tools have no touch control; no new phone navigation, permission, security or network changes performed. Physical camera gates remain unrun. |

Validation: `npm test` passes965/965 across111 test files, zero failures/skips/cancellations. `npx tsc --noEmit` and `npm run typecheck:tests` pass with zero errors. `EXPO_NO_TELEMETRY=1 npx expo export -p web` and applicable iOS export succeed. Final diff/whitespace and client/server boundary inspection pass. No database/Auth/RLS changes: migration reset, DB tests and local/hosted service smoke were not run. Exact-head CI is unrun because no push is authorized; it remains required before a substantial merge.

## Screenshot handoff

All items below were saved successfully to Library as image artifacts, version0; original files retain the returned Library identity. Parent must inspect these screenshots before claiming final readiness. Browser evidence is Development Mock; authored examples are fictional, unsaved semantic fixtures. The simulator image proves native entry rendering only.

| Screenshot | Confirmed Library ID |
| --- | --- |
| No match and next actions | `libfile_ba6d12e1d10c8191ba14f83040b0eb4b` |
| Manual compact grey verdict | `libfile_fe4374e422c08191a657061703c5aa67` |
| Manual expanded recovery | `libfile_b5f3be4265248191a1f59307a63da4cb` |
| Sourced sample, formula unknown | `libfile_9b7e59d47e3c819194d4ae44504b2fea` |
| Browser camera permission boundary | `libfile_704053f8a1708191bff0159b835ffab4` |
| Link dismissal with search/list retained | `libfile_3d09cd1cedb48191b911df0f2d5e02eb` |
| Native simulator Check entry | `libfile_f600df81f7bc8191b89c87c714d2a009` |
| Green findings, Source closed | `libfile_ca1d1f4c810481919ddf0038be15df5e` |
| Source open; main verdict unchanged | `libfile_b718f70cd55c8191a6012312f285ac14` |
| Lower findings and limits | `libfile_4a3f0b7bed6081919357ae6d87726d2b` |
| Amber tradeoffs | `libfile_02cc6a7256ec8191b1e540b6d9b664b3` |
| Red reported reaction | `libfile_28b94db0bf108191a273652de7aeae9b` |
| Grey unknown category | `libfile_c4ff6222439c8191abaaf6f0ae45781a` |

## Minimum physical sequence

1. Load the exact8084 Expo Go source. Enter Auto/Barcode and front/ingredients modes, return, and check torch with existing permission. Confirm the preview is live.
2. Scan a real packaged barcode under ordinary focus/glare; hold it in view and confirm one correctly identified or honestly unknown sheet. Expand findings/Source, dismiss, then scan a different product; confirm the camera resumes and the first product is absent.
3. Exercise a miss/wrong variant through search/manual/link recovery and back to camera; verify retained input, exact variant selection and unverified manual copy.
4. Take a package photo, review/retake/use it, then background/foreground during capture/check completion. Confirm one retained current result and repeat after dismissal.

Native denial/Settings permission recovery remains a separate unrun gate; no grant or OS setting was changed. Photo-only recognition is not implemented. These steps do not prove OCR or hosted guest activation.

## Remaining decisions and contracts

Same-family reaction verdict policy across reformulation is a founder decision outside this pass. Some tolerated historical `formula_changed` packets do not retain the historical formula ID as structured display data; the UI honestly renders unknown comparison. Sami owns any contract enrichment; Kanuj owns acceptance. No extra source text parsing or inferred ingredient cause is allowed. See [wiring handoff](../ux/CHECK_PROFILE_WIRING.md) and [camera result constraints](CAMERA_RESULT_SHEET.md).
