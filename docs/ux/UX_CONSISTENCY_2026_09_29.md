# UX consistency and useful context, 2026-09-29

Audit source: clean `d96cf55777bf0fa1fbfb50eb42fcd5b9da60a85b`, main CI `36610789141` success. Kanuj owns this bounded customer pass. Sami owns active capture/resolution. This record is source evidence and implementation direction, not hosted, physical, clinical, billing or release acceptance.

## Decisions before implementation

| Decision | Evidence / reason | Owner and write-set | Acceptance |
| --- | --- | --- | --- |
| Keep four tabs, Check entry, accepted Plan and Account | Current root shell has the shared mark; differing action prominence is meaningful hierarchy. | Root; no root-tab or offer change. | Check/name/link stay distinct; no invented settings, price or entitlement. |
| Change shared design rules | DESIGN still mixes old five-tab/serif/blur guidance with current tokens. Required footer text uses insufficiently subtle text; grouped headings and question margins vary. | Root: theme, UI primitives, DESIGN. | System sans, readable semantic text, one owner per gap, 44pt controls, consistent external section header/actions. |
| Change profile presentation, keep canonical authority | Existing P0-B ContextFlow already has explicit main goal, states and acknowledged revision saves. Legacy preview cannot represent all these states. | Profile leaf; later root route composition. | Optional primary goal, disclosed secondary goals, separate skin feel/reactivity, no new questions or fake preview save. |
| Change My Stuff creation and organization | Creation is obscured; saved shelf is distinct from canonical routine. | My Stuff leaf; later root route composition. | Persistent Add product/Add experience; explicit saved-product state; no automatic routine activation. |
| Change shared result content and search lifecycle | Formula precedes Personal Fit; camera sheet is factual-only; search selection clears query and replaces home. | Result leaf, then sole Check composition writer. | Essential guidance/cautions at every detent, retained query/list/scroll, stale response rejected on Close. |
| Keep mineral-white content and selective native glass | Glass module exists but current wrapper checks module presence only. | Root material primitive; camera adapter stays Sami. | Runtime availability and Reduce Transparency fallback; no material claim from screenshots. |
| Defer navigation migration | Native tabs differ in inset, tab and state behavior; shared shell has legacy/target routing. | Root isolated compatibility prototype only. | No shipping navigation change; document compatibility and remaining device checks. |
| Defer per-Check intent schema change | PersonalProfileInput.intent persists and contextAdapter reuses it for every product. A copy change cannot fix authority. | Kanuj contract follow-up. | No UI claim that stored intent applies only to one Check. |
| Defer immutable history full result | FreeCheckEntry has no case/snapshot/assessment reference or detail operation. | Sami sealed owner-bound detail handoff, then Kanuj. | Saved metadata is honest; a new reassessment is never labeled the historical result. |
| Defer capture notice/rearm/continuation edits | Active camera dispatches local unknown notice before resolver reply and remount rearm can repeat the same barcode. PR #174 is unmerged backend continuation. | Sami existing capture/resolution workstream. | One result/recovery surface; deliberate rearm; exact same owner/case/evidence for continuation. |

Green denotes brand action/selection, never positive skincare truth by itself. Personal Fit is the answer area; Formula Details is supporting evidence. Equal typography roles follow equal rules; primary and secondary actions intentionally differ. Stop once remaining differences are preference-level.

## Question to decision matrix

All canonical rows pass through ContextFlow/draft -> storageAdapter -> personal-context acknowledged revision -> load/edit -> contextAdapter -> deterministic evaluator -> bounded result. Collected, persisted, consumed, functionally tested and scientifically supported are separate claims.

| Wording / scope / trigger | Canonical field and consumer | Supported effect / unknown | Privacy and tests | Decision |
| --- | --- | --- | --- | --- |
| What would you most like to improve? Optional persistent main; up to two additional goals disclosed. | primaryGoal/secondaryGoals; evaluate.ts goal-role path. | Dryness + dry/tight + supported nonactive moisturizer has a role finding. Other main goals do not acquire a rule from more answers. | Preference data; goal counterfactual/cap tests. | Clear explicit main priority; retain maintenance/simplification. Defer new goal rules. |
| How does your skin usually feel? Persistent optional self-report. | skinBehavior; dryness role. | Dry/tight is consumed; oily/combination/balanced persist without their own rule. Unanswered/unsure/withheld remain categorical. | Personal context; adapter/enum tests. | Plain labels; no measured-skin-type claim. |
| Do skincare products tend to irritate your skin? Separate persistent report. | reactivity; reactive supported-active caution. | Unknown can cause a critical gap even for nonactives under current policy. | Sensitive report; policy cases. | Keep separate; no invented middle category or policy weakening. |
| Known sensitivities: names only when known; targeted setup/edit. | sensitivities.status/values; exact-name match and alias-review limitation. | Report is not proven allergy/causation. None/unsure/unanswered/withheld distinct. | Sensitive names; round trips, name-match tests. | Keep; product experience is available without naming a causal ingredient. Clinician provenance is unsupported. |
| Relevant treatments: targeted gap/edit, not a long baseline interview. | treatments; retinoid/BP/acid overlap and unknown-treatment gap. | Other prescription remains unresolved. Current routine does not replace unanswered treatment status. | Prescription context; policy tests. | Keep supported labels and states; defer treatment-name classification. |
| Checking use/add/replace: intended per-Check context. | Currently persisted profile.intent; affects overlap, replacement and KEEP_CURRENT. | Stored intent is reused globally. | Low privacy, high decision effect; intent counterfactuals. | Contract follow-up; no per-Check claim from relabeling. |
| Products used, timing/frequency, completeness: product-use records. | routine.items/completeness; sourced categories/formulas support relation/overlap. | Partial/unentered cannot prove absence. Dates/duration stored but unused; some frequency projections conservatively unknown. | Use history; completeness/formula tests. | Progressive editor; explicit new-item use state. Saved shelf is not routine. |
| Your experience: product-specific observation, reusable. | experiences; reaction/formula change and some ineffective reports. | Liked/finished/no-report differ in storage even where current evaluator projects no_report. Manual identity is not matched as canonical truth. | Sensitive observations/notes; corrections, formula and mapping tests. | Minimum product + observation; dates/details optional; no causal or clinical promise. |
| Separate pregnancy/trying/nursing: materially relevant or edit existing answer. | separate fields; reviewed retinoid caution/gap. | Trying=yes has a reviewed-claim limitation, not an invented caution; more questions cannot repair missing science. | High sensitivity; JIT/state/policy tests. | Targeted, separate; no new medical intake. |

Primary-goal privacy gap: ContextFlow offers withheld but nullable primaryGoal storage reloads it as unanswered. Preserve this as a contract defect; do not claim faithful round-trip support. Legacy preview additionally collapses treatment/sensitivity unsure and combined reproductive context; it must not be promoted into canonical authority through copy alone.

## Frozen shared presentation interfaces

- `QuestionGroup({label, support?, children, style?})`: one 8pt label/content gap, optional necessary support, no enclosing card.
- `SectionHeader({title, action?: {label, accessibilityLabel, onPress, disabled?}})`: muted sentence-case section title; action target at least 44pt.
- `GroupedSection` keeps existing props and adds `headerAction` and `embedded`; embedded removes outer content card only, not state semantics.
- `ChoiceChip` adds `selectionType?: 'single' | 'multiple'`; default multiple preserves callers; both sizes retain 44pt touch target.
- `CatalogProductSearch` adds `embedded?: boolean`, `preserveSelection?: boolean`, `focusKey?: string | number`; defaults preserve old consumers. Submission and async result publication share one request version; preservation retains input/list and focusKey restores focus after contextual Close.
- `GlassContainer` keeps existing defaults and adds a semantic material choice; checks API/runtime support and accessibility, with opaque Mineral fallback. Shape follows actual caller radius.

Root owns these shared files until publication. Feature writers own disjoint profile, My Stuff, result content/model/test files. Root alone wires routes, Check composition and canonical docs after feature review.

## Evidence anchors

[Apple materials](https://developer.apple.com/design/human-interface-guidelines/materials), [Expo glass runtime/accessibility availability](https://docs.expo.dev/versions/latest/sdk/glass-effect/), and [native tabs behavior](https://docs.expo.dev/router/advanced/native-tabs/) support implementation checks. [AAD routine guidance](https://www.aad.org/public/everyday-care/skin-care-secrets/routine/healthier-looking-skin), [Cleveland Clinic skin feel/sensitivity](https://health.clevelandclinic.org/understanding-skin-types), and [AAD patch testing](https://www.aad.org/public/diseases/eczema/types/contact-dermatitis/patch-testing-rash) support general distinctions; they do not validate Derive's questionnaire or clinical accuracy.

## Acceptance gates

### 2026-10-01 local result copy follow-up

The combined `kanuj/ux-check-profile-preview` now uses direct fictional label/preference facts in its category examples: “Rich cream · Your preferred texture” and “In your routine / Evening, after cleanser.” Live results remain projections of retained validated fields; missing texture preferences cannot be filled from fixture copy. Only a supported goal finding whose text exactly repeats the verdict is removed from the finding list, with its evidence and limits accessible from the verdict. Distinct goal findings, material cautions and unknowns remain visible.

Findings are immediately visible on swipe-up. Each finding's title/body and chevron form a minimum-44pt button that expands its own evidence underneath, with an accessible label and expanded state. The verdict has its own disclosure; no global accordion or repeated “Evidence & limits” links. Source provenance and meaningful limits remain accessible. Repeated category-separation explanations and generic routine disclaimers are removed from the fictional examples; sunscreen reapplication and water-resistance limits remain. This is local presentation work, not a new decision policy, schema, score, source capability or hosted activation.

Every implementation PR: focused/full unit, app/test TypeScript, web/iOS exports, scope/secret/diff audit, independent review and both CI jobs at its exact head. No backend behavior changes are planned. Visual review covers small/large screens, long names, larger text, keyboard, scroll/drag, focus, errors and reduced transparency/motion. Physical camera/gesture/material and unassisted customer acceptance remain separate and pending until observed.
