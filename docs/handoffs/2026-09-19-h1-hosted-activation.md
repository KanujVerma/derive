# H1 hosted Remote activation handoff

**Date:** 2026-09-19, America/Chicago

**Project:** `/Users/kanuj/Documents/projects/derive`

**Original checkout:** clean `main@953c9295573b7fe8c8bd88a0758c4a00819175c4`, equal to `origin/main`, 0/0

**Isolated worktree:** `/Users/kanuj/.codex/.chatgpt-projects/g-p-6aa97a53d2048191a32fe501d4540756/derive-h1` on `kanuj/h1-hosted-remote-activation`

**Latest verified documentation commit before this handoff:** `a25232c7a144af7b8e8b05c3f262928c76b04b73`
**Draft PR:** [#21](https://github.com/KanujVerma/derive/pull/21), with exact-head CI run `35479188485` successful before this handoff file was added. Check its new head and CI on resume.

## GOAL

Complete the real test-mode Remote customer and founder lifecycle in the
existing Sami-owned Derive Supabase project. Do not open C1.5 or turn on the
committed production Remote default.

## DONE

- `git status -sb`, `git log -5 --oneline`, `git fetch --all --prune`:
  original main clean and synchronized at the E1 merge SHA.
- `npx --yes supabase projects list --output-format json` and `orgs list`:
  existing `Derive` project `snojlbqovlawewwqbviz`, organization `Derive`,
  `us-east-2`, healthy PostgreSQL 17.6.1.166. Different organization from
  `Kanuj's Org`.
- `npx --yes supabase db reset` and `test db`: local migration replay and
  303/303 pgTAP assertions passed. Application-schema lint had no errors.
- `supabase migration list` and `db push --dry-run`: the first 14 hosted
  migration versions matched, with only E1 pending. Hosted table and policy
  readback and the migration's preflight were reviewed. `db push --yes` applied
  E1 without resetting data; the hosted ledger now lists 15 migrations.
- `supabase functions deploy` and hosted function readback: seven E1-updated
  functions at version 2 and three new S5 billing functions at version 1;
  all 13 active. Only the Stripe webhook has platform JWT verification off.
- Hosted SQL and advisors: RLS/grants, private photo bucket, and E1 active
  policies inspected. `curl` negative probes returned 401 for unauthenticated
  onboarding and 400 for an unsigned webhook. No Auth users or app data exist.
- `npm test` under Node 22: 236/236; app and test TypeScript checks pass;
  explicit staging Remote web export with hosted public URL/key succeeds.
  PR #21 CI passed both build and local integration jobs at `a25232c`.

## IN PROGRESS

- Draft PR #21 remains open and should stay draft until hosted smoke gates
  pass. Its source changes are documentation and a reusable checklist only.
- `docs/HOSTED_REMOTE_SMOKE.md` is the canonical dated hosted readback and
  manual/automatic test checklist. `docs/ROADMAP.md` marks H1 partial.
- The H1 worktree CLI is linked to `snojlbqovlawewwqbviz`; verify the ref
  before any future hosted command. A disposable shadow under `/tmp` was used
  for comparison and is not source truth.

## AT RISK

- No uncommitted task work at the last Git check. A direct-host shadow schema
  diff failed because the project database hostname did not resolve in its
  container; migration ledger, actual schema/policies, and post-push readback
  supplied the narrower deployment evidence. No complete drift proof exists.
- Supabase hosted Auth uses a default link-only template, custom SMTP is off,
  and the free-tier template editor is disabled. The installed CLI account can
  deploy migrations/functions, but current browser Auth/SMTP setting controls
  are disabled. Treat administrator rights as unverified, not assumed.
- Only Supabase-provided default secrets exist. The available Stripe browser
  login was unrelated to Derive. No real OTP, provider, Stripe, customer, or
  founder lifecycle has passed. No test user was created.

## DECISIONS

- The H1 brief requires the existing project, Stripe test mode, webhook-owned
  entitlement, real provider calls, production Remote off, and C1.5 unopened.
- A founder decision is required for email delivery: configure an approved
  custom SMTP provider on the existing free project or upgrade its plan. Do
  not bypass the vendor restriction or replace OTP with a magic link.

## STANDING INSTRUCTIONS

- Never reset the linked hosted database or create another Derive project.
- Do not paste secrets, OTPs, or payment details into chat or commit them.
- Source branch and docs are Kanuj-owned integration work; backend ownership
  is Sami's. Document cross-boundary changes in `docs/CONTEXT_SYNC.md`.
- Keep PR draft and H1 partial until the real hosted lifecycle succeeds.

## NEXT STEP

After the founders choose the email delivery path and provide authorized
access to the correct Derive Stripe test account, verify the hosted six-digit
OTP with a dedicated inbox, then continue the checklist from real Checkout.

## OPEN QUESTIONS

1. Which approved SMTP provider or Supabase paid plan will support the hosted
   six-digit OTP, and who will configure it with administrator access?
2. Who can invite the H1 operator to the correct Derive Stripe test account?
3. Which dedicated staging inbox and trusted Gemini credential will be used?
