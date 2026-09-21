# External TestFlight submission packet

Operational notes for Build 8. This is not the roadmap. Credentials do not belong in this file.

## Beta App Description

Derive is a managed cosmetic skincare beta that helps members organize their skincare goals, current products, routine, and progress. The Founding Beta uses founder-assisted review while we validate the customer experience.

## What to Test

Sign in using the provided demo account and review Today, Plan, Shop, Progress, account settings, privacy and support links, and the overall managed-skincare experience.

The demo account is preconfigured with representative beta data and a published routine.

Account creation is also available. To test account deletion without removing the shared demo account, create a temporary account and use Delete Account from the Founding Beta Access screen.

## App Review Notes

TestFlight access is free. No payment is required to use or review this beta. No in-app purchase or external payment unlocks the pre-release TestFlight build.

The provided demo account already has beta access and representative synthetic data.

Ask and Scan are intentionally not part of this external beta build.

Privacy Policy URL: https://derive-beta-site.vercel.app/privacy
Support URL: https://derive-beta-site.vercel.app/support

The app compiles these public URLs directly. The existing mobile environment allowlist in `tests/derive.test.ts` rejects new `EXPO_PUBLIC_*` names, and that file is outside this milestone.

Username: ENTER IN APP STORE CONNECT ONLY
Password: ENTER IN APP STORE CONNECT ONLY

## URLs

- Home: https://derive-beta-site.vercel.app/
- Privacy Policy: https://derive-beta-site.vercel.app/privacy
- Support: https://derive-beta-site.vercel.app/support
- Privacy choices: https://derive-beta-site.vercel.app/privacy-choices

## Feedback email

kanuj.verma12@gmail.com

## Review contact checklist

- First name: Kanuj
- Last name: Verma
- Phone: a real reachable phone, entered only in App Store Connect
- Email: kanuj.verma12@gmail.com

## Export compliance

`ios.config.usesNonExemptEncryption` is false. The app uses platform HTTPS and the standard Supabase client. No custom non-exempt cryptography was found.

## Privacy manifest

Build 8 does not add a hand-written required-reason API declaration. Camera and photo-library usage strings are the permissions the app can explain. Location, microphone, contacts, tracking, and Bluetooth are not declared. Expo and its native modules ship their own privacy manifests in the generated iOS project; those were not copied into this repository.

## Analytics

`src/services/analytics.ts` logs allowlisted events only in development. It does not transmit events to PostHog or another service in this build. Session replay is off.

## Recommended App Privacy answers

These are recommendations, not a submitted questionnaire.

| Category | Collected | Linked to user | Tracking | Purpose | Evidence |
| --- | --- | --- | --- | --- | --- |
| Name | Yes | Yes | No | App functionality | Signup first and last name stored in the profile |
| Email address | Yes | Yes | No | App functionality | Account email |
| User ID | Yes | Yes | No | App functionality | Supabase account identifier |
| Photos or videos | Yes | Yes | No | App functionality | Optional private skin, shelf, and check-in photos |
| Health | Yes, as user-entered skincare context | Yes | No | App functionality | Goals, reactions, sensitivities, pregnancy or nursing disclosure, prescription context |
| Other user content | Yes | Yes | No | App functionality | Notes, check-ins, routine history |
| Purchases | No | No | No | None | TestFlight build does not collect a purchase |
| Usage data | No | No | No | None | Analytics client does not transmit |
| Diagnostics | No | No | No | None | No diagnostic SDK is configured |

## Build 8 gates still outside this file

Physical device checks and External Beta Review submission stay with Kanuj. Do not submit review from this packet alone.
