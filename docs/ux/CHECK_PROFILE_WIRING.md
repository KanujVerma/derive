# Check and profile wiring handoff — 2026-10-01

Owner: Kanuj for customer composition and physical acceptance; Sami for downstream platform/truth contracts. Source predecessor: `2da7e8660cb0edb2166fcb807732d4f12f72bdd0`. Main reconciliation predecessor: `575566b798dad5dd98a3cba31f992a71bdeb279a`.

The combined UI has four fixed verdicts (Good fit, Some tradeoffs, Not a good fit, Not enough information). The compact sheet contains identity and the complete verdict; swiping up reveals substantive findings. Only Source controls disclose provenance. The development setup has five steps: goals, skin behavior/reactivity, current products, past outcomes, and an optional note.

Optional current-product feedback supports mixed outcomes, including Works well plus Too heavy. Moisturizer category supports Still feels dry; unknown/manual and unsupported categories retain general meanings. One product's texture dislike never becomes a general texture preference. Historical reports remain separate from edited current feedback.

## Existing live contracts and preview boundary

Main already implements [per-Check intent authority](../P0_B_CHECK_INTENT.md): explicit request intent, persisted assessment input, expected binding and owner/case-scoped controller state. Omitted intent is unanswered; saved global profile intent does not supply it. Live verdict rendering consumes only the validated bound intent. The new Add/Replace/target/texture question UI is still guarded, development-only, and unsaved; normal Check does not activate it. Setup products/outcomes/notes are also unsaved where contracts are absent.

Reconciliation preserves Sami's hosted scanner routing, indexed ingredient resolver, and existing owner/input-fenced product-link controller. Only a validated link resolution reaches the immutable product-truth gate; published labels, retailer IDs and unsupported links remain recovery. Existing live context/routine/history and saved-product APIs retain their boundaries. No backend, database, Auth/RLS, analytics, billing or hosted activation change is part of this UI publication.

## Remaining wiring and founder decisions

The bounded search/scan return pass based on main `7efb9ce446c6b7b54b3803fa85522b47da2a05ee` now preserves Check's search query/list across camera entry, exposes cancel/retry/resume, fences stale requests and duplicate selection, and supplies honest manual/no-match recovery. Dismiss re-arms the existing capture session; an unknown barcode has a transient scan-bound sheet. Background completed evidence is held locally and delivered once on foreground. [Dated acceptance](../acceptance/SEARCH_SCAN_RETURN_2026_10_01.md) separates automated, rendered, simulator and unrun physical evidence, records Library identities and the exact8084 preview. It is local-only, with parent screenshot review and physical camera acceptance pending.

Historical copy now compares retained structured formula IDs instead of treating variant mismatch as a formula change. Missing historical IDs remain unknown comparison; same/different recorded IDs do not prove package tolerance. Some tolerated historical packets lack that structured prior ID, so Sami's contract enrichment remains a handoff. No evaluator action or reformulation verdict policy changes in this pass.

- Per-Check intent transport exists, but the live question/host composition still needs an approved bounded integration. A continuation into another case must explicitly carry the same attempt's intent when justified.
- An explicit per-Check replacement target and its immutable owner/revision binding are absent.
- Provenance-backed texture facts and general preference storage/binding are absent.
- Category-specific multi-outcome current feedback needs correction/revision/persistence and reassessment contracts. It must not overwrite historical reports or promote product-family references into exact formula experience.
- Live Add/KEEP_CURRENT policy remains unchanged. Preview same-role neutrality does not authorize changing it.
- Same-family reaction caution across changed/unknown formulas remains an open founder policy/copy decision. Preview mismatch examples do not replace the live conservative rule.
- Routine placement is not verified ingredient-layering compatibility.

See [P0-B context](../P0_B_CONTEXT.md) for unknown/none distinctions, mixed feedback and storage boundaries.

## Demo and acceptance

Development Mock route: `/check-preview`; setup is available from My Stuff. Guards exclude these new questions and authored examples from live/remote/production Check.

Required publication checks: `npm test`, `npx tsc --noEmit`, `npm run typecheck:tests`, `EXPO_NO_TELEMETRY=1 npx expo export -p web`, applicable iOS JavaScript export, final diff/secret/import-boundary review and `git diff --check`. The PR records exact final counts and required CI links. Physical iPhone swipes, Source toggles, VoiceOver, camera/search/link return and end-to-end real product/profile acceptance remain open. Prior fictional phone screenshots and responsive browser evidence do not establish those gates.
