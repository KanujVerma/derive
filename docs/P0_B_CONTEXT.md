# P0-B reported personal context

P0-B2 stores what a person reported and the exact revisions used in a decision. It does not infer a routine from a saved product, a product role from its name, or ingredient causation from a reaction. The new endpoint is additive; existing free-context, free-personal-fit, managed Shelf, and paid routine endpoints keep their contracts.

## Storage and writes

`src/contracts/PersonalContext.ts` is the storage boundary. `personal_context_heads` supplies the aggregate revision used for optimistic writes. `personal_context_revisions` is an immutable journal of profile snapshots, routine snapshots, and experience events. Each record has an owner, UUID revision ID, monotonically increasing aggregate revision, server timestamp, and self-report provenance. Account deletion cascades all context and assessment rows.

`personal-context` authenticates the Auth JWT through the existing runtime, derives the owner, validates a strict bounded DTO, and calls service-only SQL functions. Raw tables and functions have no anonymous/authenticated privileges; RLS is enabled. The functions are SECURITY INVOKER with an empty search path, not SECURITY DEFINER. Service-role credentials stay in the existing server runtime.

Every write includes `requestId` and `baseRevision`. An owner row lock serializes writes. Exact retries return their original immutable revision even if the head has advanced. Reusing a request ID for different content or base revision returns `IDEMPOTENCY_CONFLICT`. A new request against an old head returns `STALE_CONTEXT`. Profile/routine replacement snapshots append revisions rather than overwrite the past.

An experience has a stable `id`. Initial creation sets `supersedesRevisionId: null`; a correction retains the stable ID and names that experience's latest revision. Corrections append new records. Previous versions remain readable by their owner. Stale, foreign-owner, or competing correction links fail. The active-history reader chooses the latest effective record for each stable ID, retaining explicit correction provenance.

## Truthful unknowns

- Profile intent includes add, replace, check_current, unanswered, and withheld. Primary and secondary goals remain separate; no legacy array position becomes a primary goal.
- Pregnancy, trying to conceive, and nursing are independent yes/no/unsure/unanswered/withheld values. A withheld value remains distinct from no.
- Routine completeness is partial, complete, or unknown. Missing items from a partial routine cannot establish non-use.
- Routine item IDs stay stable across snapshots. State, timing, frequency, dates, and duration are explicitly reported. Qualitative few_times_week stays qualitative; exact frequency requires its own count and unit.
- No-reaction-reported is distinct from explicitly reported tolerance. Dates of use/outcome are nullable and never copied from a record creation timestamp.
- Manual references retain their reported name/brand and supply no catalog authority. Catalog references validate the supplied sourced product, verified variant, and exact reviewed verified/superseded formula chain. Missing variant/formula references stay null; the server never fills in the current formula for old experience.
- Derived roles and active classes are absent from the storage input/output. A later server evaluation adapter may derive them only from reviewed catalog facts and must bind that derivation to its source revision.

## Legacy context

Migration performs no backfill. `get_context` returns legacy observations separately with `source: legacy_free_context`. Legacy goals are `goalsUnordered`; reproductive context is `combinedReproductiveStatus`. Saved products retain their old state with unknown timing/frequency and null formula reference. Experience `recordedAt` is its recording time; the occurrence interval and exact formula remain unknown. The legacy object is not a canonical profile/routine/history revision, and consumers must not silently upgrade it.

## Bounded history

A context snapshot includes up to 50 current experience records and up to 50 records per legacy list, with explicit truncation flags. Consumers must not interpret a truncated list as proof that no older reaction exists.

`get_experiences` takes the snapshot's numeric `atRevision`, an optional catalog `productId`, a limit of 1–50, and an optional owner-bound cursor. The server first selects the latest effective correction at that revision, then filters by product, then pages by descending revision. This keeps an older relevant reaction available even if many unrelated newer events fill the main snapshot. Fixed revision pagination remains consistent if later corrections arrive. Manual identity stays unresolved and cannot be matched authoritatively by a catalog ID. Legacy history remains explicitly separate and truncated legacy history must block unsupported negative history assumptions.

`get_revision` retrieves an immutable owner-bound record for audit/reassessment. This endpoint does not send context into analytics or external models.

## Decision provenance composition seam

The additive migration also creates `personal_decision_assessments` and service-only `persist_personal_decision_assessment`. Composition supplies owner-derived `p_user_id`, caller UUID `p_request_id`, canonical `p_input`, server-authored validated `p_packet`, nullable exact profile/routine/history revision UUIDs, non-authoritative `p_truth_projection_ref`, and schema/engine/policy versions. Revision-link triggers require the same owner and correct section. Assessment rows are immutable and cascade on identity deletion.

Before persistence, composition must validate the packet against the shared PersonalDecision contract and verify its binding matches these columns. Canonical `p_input` must include nonnegative safe-integer `expectedContextRevision`, truth reference, context revisions, relevant request choices, and policy/engine/schema versions: changing any of these must conflict when reusing a request ID. The RPC locks the owner head and rejects a new assessment with `STALE_CONTEXT` if its expected aggregate revision has changed during evaluation. Reassessment requires a new request ID and an explicit current snapshot. An exact replay is checked before that guard and returns the originally stored packet; it never silently regenerates the old request against new context. This RPC is not a client endpoint and does not implement product truth or scientific policy.

Assessment storage allows at most 1 MiB of PostgreSQL JSONB text bytes for the packet and 512 KiB for evaluated input. The additive budget correction preserves object validation, service-only grants, immutable rows, owner links, replay and stale-revision checks. It addresses actual supported 50-item routines with distinct role/overlap/experience findings and the accepted Unicode formula projection; it does not permit unbounded packets or raw-history duplication. The renderer independently bounds finding/reference/impact counts and transport bytes. `supabase/tests/p0b_packet_budget.sql` exercises oversized valid packets, UTF8 byte limits, wrong types, immutability, client denial and deletion.

## Validation and release

Unit parser tests cover strict fields, qualitative/exact frequency preservation, sensitive answers, date intervals, duplicate stable IDs, forged derived fields, and bounded history queries. `supabase/tests/p0b_context.sql` covers raw privileges, owner isolation, immutable writes, idempotency, stale revisions, and deletion. `scripts/test-p0b-context-local.mjs` exercises disposable anonymous A/B identities through Auth and Edge, concurrent retries/new writes, correction provenance, exact historical formula references across an appended reformulation, legacy unknowns, more than 50 history events, assessment replay, and deletion. It refuses hosted Supabase and never resets the shared local stack.

Material migration/RLS/service-role changes require Sami's platform/truth review before merge. B2 registers only the personal-context function stanza; root composition owns decision-function configuration/CI registration, packet validation/integration, canonical roadmap/checkpoint updates, hosted release decisions, and physical/customer acceptance. Local module verification does not establish hosted or physical acceptance.
