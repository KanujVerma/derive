# UX consistency implementation plan

> For agentic workers: use superpowers:subagent-driven-development or superpowers:executing-plans. Keep one writer per shared surface.

**Goal:** Make existing Derive results and useful context coherent, optional and actionable.
**Architecture:** Shared primitives first; disjoint profile, My Stuff and result leaves; one root composition pass. Existing canonical storage, deterministic policy and capture ownership remain authoritative.
**Tech stack:** Expo 57, React Native, Expo Router, existing UI primitives and typed owner-bound APIs. No new dependencies.
**Spec:** [Decision record](../../ux/UX_CONSISTENCY_2026_09_29.md).

## Constraints

- Preserve dirty worktrees and unmerged Sami contracts. No camera/controller, backend, migration, production, billing, medical-rule or root-tab changes.
- Context/identity provenance, unknown states, canonical acknowledgment and owner isolation are required.
- Main starts at d96cf55; fetch/reconcile remaining PRs after every main advance. Exact-head CI and independent review precede normal merge.

## Task 1: shared design contract, root

Files: theme.ts, UI QuestionGroup/SectionHeader/GroupedSection/ChoiceChip/GlassContainer, catalog search, DESIGN, decision record and focused tests.

- [ ] Add failing behavioral tests for material policy availability/reduced transparency, shape, single/multiple selection semantics, and search preservation/stale submission.
- [ ] Implement only frozen interfaces in the decision record; preserve defaults for existing consumers.
- [ ] Correct DESIGN current/historical split and spacing/typography/material rules.
- [ ] Run focused/full tests, both TS, web/iOS exports, scope/diff/secret checks; independent review, PR, exact CI, merge.

## Task 2: profile presentation, isolated owner

Files: existing ContextFlow/PersonalizationFlow, their draft/presentation helpers and focused tests. No shared schema or scientific rule edits.

- [ ] Add failing state/choice tests for explicit main priority, secondary cap/disclosure, unsure versus unanswered and acknowledged preview limitation.
- [ ] Reuse canonical ContextFlow presentation, shared question gaps and single-select semantics. Keep targeted safety context and relevant-section edit paths.
- [ ] Retain all supported statuses; record unsupported withheld primary-goal and global-intent contract gaps. No fabricated mapping.
- [ ] Complete full gates, independent review and focused PR.

## Task 3: My Stuff presentation and product-entry leaf, isolated owner

Files: my-stuff components/presentation/store/fixtures and tests. Root wires app routes later.

- [ ] Test explicit product state, manual/unverified record, idempotent retry, draft/ack/failure and stale owner responses.
- [ ] Add persistent section actions and bounded product-entry leaf using existing saveFreeProduct; no routine promotion or silent dedupe.
- [ ] Unify visible experience section with source-appropriate actions; new experience enters existing canonical editor with no selected outcome.
- [ ] Complete full gates, independent review and focused PR.

## Task 4: shared result content/lifecycle leaf, isolated owner

Files: check/result-sheet components/presentation, embedded PersonalDecisionPanel/PersonalFitSection, focused tests. No Check root/camera edit.

- [ ] Test critical content visible collapsed, distinct limitations, binding and close invalidation lifecycle.
- [ ] Reuse existing decision presenters and sheet; essential answer first, formula/source details disclosed, neutral unknown state.
- [ ] Keep original immutable historical detail blocked on an actual sealed detail API.
- [ ] Complete full gates, independent review and focused PR.

## Task 5: single-writer composition, root

Files: CheckProductScreen, My Stuff/personalize routes and affected composition tests, canonical CONTEXT_SYNC. Coordinate capture handoff separately with Sami.

- [ ] Wire completed leaves; preserve name/link query, list/scroll/focus and originating product/case on edit.
- [ ] Reject dismissed/old-owner responses; retain current tab state and only refresh after acknowledged canonical changes.
- [ ] Provide honest metadata-only history until sealed detail exists. No current reassessment presented as history.
- [ ] Build isolated native-tabs compatibility prototype without changing shipping navigation; record constraints.
- [ ] Run full integration gates and independent review. Record actual Simulator/visual evidence; request a short physical pass when source is ready.
- [ ] Merge only with both exact-head CI jobs green; leave unobserved physical/clinical/customer gates explicit.
