## Summary
<!-- Concise 1-2 sentence overview of what this PR accomplishes. -->

### Owner
- [ ] Kanuj (Customer Experience + Mobile)
- [ ] Sami (Platform + Intelligence + Operations)
- [ ] Shared

### Area
- [ ] Mobile UI / Navigation (`app/**`, `src/components/**`)
- [ ] Design System & Tokens (`src/constants/theme.ts`)
- [ ] Backend / Supabase (`supabase/**`)
- [ ] Intelligence & AI Workflows (`src/services/ai-workflows/**`)
- [ ] Founder Operations (`admin/**`)
- [ ] Shared Contracts (`src/contracts/**`, `src/domain/**`)
- [ ] Documentation / CI

---

## What Changed
<!-- Bulleted list of architectural or functional additions/modifications. -->
- 

## How Verified
<!-- Details of automated tests, typechecks, and visual simulator checks performed. -->
- [ ] `npm test` (passing)
- [ ] `npx tsc --noEmit` (0 errors)
- [ ] `EXPO_NO_TELEMETRY=1 npx expo export -p web` (clean export)
- [ ] Simulator / browser manual validation

## Visual Proof (Screenshots / Screen Recording)
<!-- Attach screenshots for mobile UI or design changes. -->

---

## Impact & Risk Assessment
- **Contract Changes**: [Yes / No] (If yes, confirm prior alignment with other founder)
- **Database Schema Changes**: [Yes / No] (If yes, confirm migration script is tested)
- **Safety / Privacy Impact**: [Yes / No] (Confirm zero private health data or raw audio in logs/telemetry)

## Known Issues / Follow-Ups
<!-- Any edge cases, temporary mocks, or subsequent tasks. -->
- None

---

## Pre-Merge Checklist
- [ ] All unit tests pass locally (`npm test`)
- [ ] Strict TypeScript compiler passes (`npx tsc --noEmit`)
- [ ] Zero secrets or private credentials in code
- [ ] Founder ownership boundaries were respected
- [ ] Shared contract changes documented and approved by both founders
