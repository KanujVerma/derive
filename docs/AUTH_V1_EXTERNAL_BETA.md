# AUTH-V1: Founding Beta email/password and Build 6

Narrow Friday-V1 handoff. Canonical roadmap docs stay with Sami's active S6 branch; this file records only AUTH-V1 decisions until the post-S6 reconciliation pass.

## Customer path

Friday V1 auth is email/password:

- Create account: first name, last name, email, password
- Returning member: email, password
- Supabase Auth is the only password authority
- Hosted email confirmation is disabled for this 10-person Founding Beta so `signUp` can return an authenticated session immediately
- No transactional email, SMTP, OTP, magic-link, social login, MFA, or password-reset mail for this cohort
- Password reset is deferred. A fake "Forgot password?" CTA is worse than none while Derive has no mail infrastructure. Founders can recreate a personally recruited account if needed.

Existing OTP adapter code remains in the repository for a later verified-email/OTP migration. Friday customer UI does not route through `verify-otp`.

## Names and profiles

Signup writes Auth metadata `full_name`, `first_name`, and `last_name`. The existing Auth trigger still projects `raw_user_meta_data.full_name` into `public.profiles.full_name`. AUTH-V1 adds no profile columns and no migration.

## Membership

Signup authenticates a session. It does not activate membership.

Canonical bootstrap for a new user is `membershipStatus = none`, which is the membership screen. Founding Beta payment remains founder-operated off-app. The client cannot set `membershipStatus = active`.

`remote-staging` inactive members see concierge copy and **Refresh Access**, which only re-reads canonical membership. Stripe Checkout/Portal remain implemented for later/non-staging use and are not deleted.

No Zelle, Venmo, Cash App, or external payment link is shown.

## Apple review

Build 6 supports a later founder-provisioned reviewer account (email, password, active membership, onboarding incomplete). Credentials are not committed, hardcoded, or logged. A pre-activated reviewer should sign in and reach onboarding without OTP, inbox access, Stripe, or in-review founder intervention.

## Build 6

Remote staging profile, marketing version `1.0.0`, EAS auto-incremented native build. Upload to App Store Connect/TestFlight is allowed. External Beta App Review and public links are not part of AUTH-V1.

## Build 7 reviewer cleanup

Remote staging no longer exposes Stripe membership management. The Billing Portal action stays available only for a future non-concierge Remote build.

Profile includes **Delete Account**. After an explicit confirmation, the client calls the existing authenticated `delete-customer-account` function with `{ confirmation: "DELETE_MY_DERIVE_ACCOUNT" }` and clears the local session only after `{ deleted: true }`. The server function is unchanged in this hotfix.

External Beta Review is still not submitted. Kanuj must physically verify Build 7 before any Apple submission.
