# Scandit barcode evaluation — development only

The current Check flow keeps Expo Camera. This branch adds a separate native development lab for Scandit Barcode Capture 8.6.0. The lab only reports the decoded barcode and symbology. It does not look up a product, create a Check case, upload an image, or assert formula truth. No production or TestFlight profile enables Scandit.

## Why this is gated

- A Scandit trial is non-billable, expires after 30 days, and is limited to 100 device activations. Scandit says trial scanning requires an internet connection. No public per-scan ceiling was found in its trial terms; confirm the exact license in the dashboard.
- Scandit's Community Edition for Education is free with unlimited scans/devices **for non-commercial use only**. Derive's planned commercial app needs a separately agreed commercial production license. Do not assume a student signup grants commercial use.
- Expo Go cannot run the native Scandit SDK. A custom native development build is required. The trial key belongs in the app-side development configuration, not Supabase Edge Functions. It is embedded in the development app bundle, so keep it out of Git and never reuse it as a server secret.
- Even when this lab route is hidden, a normal native build from a branch containing the Scandit dependencies links their native frameworks. Keep this PR unmerged/draft while license and binary-distribution terms are unresolved; a hidden route alone is not a release isolation mechanism.
- Scandit decodes UPC/EAN symbols; Derive still needs a verified barcode-to-product/variant/formula record or must show unknown. Better decoding alone does not improve catalog coverage.

## Local setup

1. In Scandit Dashboard → Projects & License Keys, inspect the license type, expiry, activated devices and Barcode Capture feature. If it asks for an app identifier, use the current iOS bundle ID `com.derive.skincare`. Do not paste the license into a chat or GitHub.
2. In this isolated worktree's ignored `.env.local`, set `EXPO_PUBLIC_SCANDIT_LICENSE_KEY` to the trial license. Leave EAS preview and production unset. No Supabase secret is needed.
3. Build a **development client** for a physical iPhone; Expo Go will show an explanation instead of starting Scandit. Follow Scandit's React Native installation instructions for the native iOS build, including its CocoaPods specs repository if the build needs it. A JavaScript reload alone cannot add native modules to an existing binary.
4. With the development build running, open `derive://scandit-lab` while the ordinary Check camera is closed. Allow camera access and tap “Start Scandit scanner.” The displayed digits are raw barcode evidence only.

## Decision test before any customer integration

Use the same rights-cleared set of real skincare bottles on the same iPhone with Expo Camera and Scandit. Record successful decodes, false/wrong decodes, time to first valid decode, camera failures, offline behavior, battery/heat observations, and—separately—whether the decoded code resolves to a useful verified product in Derive. Include small, curved, glossy, and damaged labels. Do not score an unknown catalog result as a camera failure. Keep the current Expo scanner unless Scandit produces a material useful-result gain and commercial terms are acceptable.

Sources: [Scandit React Native installation](https://docs.scandit.com/sdks/react-native/add-sdk/), [Barcode Capture setup](https://docs.scandit.com/sdks/react-native/barcode-capture/get-started/), [license types and trial limit](https://support.scandit.com/hc/en-us/articles/208350609-How-to-Use-a-Scandit-License-Key), [trial terms](https://www.scandit.com/trial/), [education limits](https://www.scandit.com/community-edition/), [Expo compatibility](https://support.scandit.com/hc/en-us/articles/18081355411996-React-Native-Does-the-Scandit-SDK-Support-Expo).
