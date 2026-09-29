# Authenticated scanner candidate and guest-first opt-in

This change integrates the existing password account, optional skincare context
and Check routes. It is not hosted acceptance, a signed binary or catalog coverage.
The six-hour scanner-only sprint parks Plus checkout and Scandit adoption.

## Explicit candidate, unchanged defaults

The new `scanner-release` EAS profile selects production Remote mode and
`EXPO_PUBLIC_SCANNER_RELEASE_ENABLED=true`. It requires the exact reviewed hosted
project `snojlbqovlawewwqbviz` and a public publishable key; legacy production and
ordinary development profiles remain unchanged. It grants no server entitlement.
An EAS environment must supply the matching public URL/key before exporting this
candidate. No secret, existing local environment or hosted setting is modified.

## Journey and ownership

1. By default, a signed-out user sees the existing login/create-account flow.
   With the separately reviewed `EXPO_PUBLIC_SCANNER_GUEST_ENABLED=true` opt-in,
   startup first restores the persisted session or creates one anonymous Auth
   owner. It shows loading/error/retry, not login or a fake local profile. The
   EAS profile keeps that flag **false** until hosted signup protection is ready.
2. Authenticated access-state must belong to the current session. The app loads
   the same owner's canonical personal-context before choosing a route.
3. An existing profile goes to Check. A new owner sees the existing optional
   skincare editor; saving waits for the server, and skipping records only a
   session-local route choice, never invented answers or a database profile.
4. Check, My Stuff and account settings use the free authenticated service seam.
   A change of owner hides prior-owner context and clears the skipped-intro choice.
   Signing out/deleting returns through the root gate, not a protected Check page.

The hosted candidate does not expose legacy managed routes, fixture Plan states,
or a purchase flow. The local development integration keeps its existing guest
and Managed behavior. Root routing, Auth success redirects and shell consumer
changes are release composition only; Kanuj owns shared customer design components.
Check's own integration helper is composed in a separate bounded integration slice.

## Acceptance gates, not claims

Default App Store source preflight still inspects the unchanged legacy production
profile and remains blocked. The new profile must be explicitly tested and included
in a reconciled native candidate; changing the public flag is not acceptance.
Fresh migration/function readback, hosted email-signup readiness, private account
deletion, real product coverage and signed iPhone checks remain necessary. Email
confirmation/custom SMTP are not weakened to bypass a failed signup. The candidate
does not fetch arbitrary pasted URLs, promote provider candidates to formula truth,
or replace Expo Camera with the unlicensed Scandit evaluation branch.

## Guest-first preparation

The founder approved no visible signup for the beta on 2026-09-29. Existing
profile/context/history ownership already uses the verified Auth UUID; no new
data migration or weaker RLS is needed. Guest startup reuses permanent sessions,
deduplicates concurrent bootstrap calls, and rejects ambiguous session reads
instead of manufacturing a replacement owner. The SDK persists credentials via
the existing AsyncStorage adapter; actual phone persistence is a separate gate.
The optional intro and settings explain cloud storage, phone-bound access and
the inability to restore on another phone before account linking exists.

Anonymous signup is not enabled by this source change. Cloudflare Turnstile
requires a public site key, private Supabase Auth CAPTCHA secret, an approved
HTTPS challenge hostname and a working app challenge/token acquisition path.
That path is **not implemented here**. CAPTCHA configuration affects existing
signup/login too; do not toggle it until those flows are tested. Keep hosted
anonymous access and the guest flag off pending abuse/retry/expiry acceptance,
then run a bounded hosted guest persistence/ownership/deletion drill and actual
iPhone restart checks. Free app operation still requires a valid session.

Same-UUID account linking is deferred. Ordinary signup/signin remains blocked
while a guest session is active; existing-account signin must not auto-merge
guest records. No automatic guest cleanup, billing, new provider, catalog growth
or public release is included in this pass.
