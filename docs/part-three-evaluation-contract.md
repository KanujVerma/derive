# Part 3 fair evaluation contract

This is a **frozen proposed local synthetic protocol**, version `part-three-evaluation-proposal-v1`, defined by [evaluation.ts](../src/domain/part-three/evaluation.ts). Its proposed manifest hash is `ef41abd4b741cb82d58b09d65e6bbc5e9910daa59fe8b0737980de0d8c8beb3a`; changing any pinned proposal/source configuration requires a new frozen hash and version before evaluation. It grants no live/provider/real-person/production permission. Authored corpus=0, adjudicated corpus=0, live runs=0, outbound model calls=0, measured utility/cost=null. All review assignments, artifact rights, processor/retention, exact payload and spend approval are pending. The specification's 80 development and 240 holdout proposal is a plan, not an executed benchmark or independently validated product result.

## Frozen jobs, fairness and pins

| Item | Proposed contract |
|---|---|
| Job `prioritize_tradeoff` | Select one supported eligible optional finding or abstain. Preserve headline, deciding reason, mandatory findings and authority. At most eight findings plus none. |
| Job `select_question` | Select one material eligible ordinary question or none before first exposure. At most four questions plus none; encounter/field suppression remains host-owned. |
| Excluded | Headline/source truth, clinical winner, arithmetic/exact matching, context writes/actions and preference proposal. Structured preference entry stands independently. |
| Candidates | Closed `eligible-menu/v1`, exact hash of canonical menu, compatible vector combinations, same admitted information for host baseline/provider. Mandatory content is outside menu. |
| Baseline | Useful rules with explicit priorities, ties, abstention and suppression. No intentionally weakened baseline, no model-only facts. Baseline choice/rank stays in local evaluation record. |
| Projection | `part-three-provider-projection/v1`, only independently externally permitted allowlisted fields/derivations. Display permission is insufficient. No raw notes/photos/health history/identifiers. |
| Prompt | `jev-choice-v1`, exact instructions frozen in manifest and asserted against injected request. Tradeoff: “Select one useful supported optional tradeoff, or none. Do not decide the judgment.” Question: “Select one useful eligible optional question, or none. Do not infer new facts.” |
| Provider adapter / contract | DecisionProvider interface, `jev-http-v1`, `part-three-selection/v1`; same production adapter under injected/replay transport. Provider-neutral scoring and semantic menu transforms do not require a Jev transport. |
| Model | Proposed pinned `jev-1.13.0`; exact provider/model must be separately verified and approved at execution. No floating alias or claimed current availability. A changed model requires new frozen manifest/approval before holdout. |
| Source | Exact runtime Part 3 release hash, dictionary version/hash and rule/evidence/question/template/policy versions imported into manifest. Unknown/withdrawn or changed basis cannot reuse selection. |
| Hard failure | Zero unauthorized disclosure, fact promotion, lost mandatory concern, stale publication or deleted-content resurrection; any occurrence blocks promotion regardless of utility. |

Fairness is an execution gate. The current narrow provider projection transmits encounter intent while menu descriptions convey supported optional relations. Before a meaningful benchmark, reviewers must verify the provider receives all relevant admitted context available to the baseline for those ranking jobs, at the same permitted resolution, or limit the job/corpus to a slice where parity holds. More context is not silently sent to improve a score. Unsupported scientific/source-rights questions remain abstentions; more intake cannot make them eligible.

## Corpus and independent gold

Create 80 development cases: 27 evidence/privacy boundaries, 27 practical comparison, 26 optional insight/question priority. Freeze 240 held-out scenarios: 80 in each group. Balance within each group for published/package/source-only/partial/conflict evidence, explicit/unsure/withheld/unanswered context, exact/family/manual recall, helpful/mixed/ineffective/adverse current reports, all intents, selected-pair scope, deletion/expiry/owner change, and material/nonmaterial/suppressed questions. Count eligible useful answers separately from parse/dictionary hits.

Independent authors and adjudicators are unassigned and must be appointed. They must not tune the implementation/prompt or use the model as sole gold. A qualified independent reviewer evaluates any scientific claim; copy preference is not that review. Gold consists of acceptable **semantic choice vectors** and required abstentions, with full expected packet, visible copy and dependency trace. More than one correct tradeoff/question is allowed. An acceptable tradeoff and an acceptable question do not imply their crossed vector is compatible.

Split by product/formula families and context patterns before tuning. Near-duplicate paraphrases do not create an independent holdout. Existing development collections/replay cases are regression seeds, not the held-out evaluation. Register actual corpus, label and split content hashes; these are currently null. Null hashes, incomplete independent adjudication or unresolved rights prevent holdout execution. Freeze candidate-set versions/hashes, source release, prompt, adapter, model, tie/threshold/scoring and gold hashes before unblinding. Any later consequential change creates a new version and new unseen holdout; do not quietly reuse tuned holdout scores.

## Scoring and proposed promotion thresholds

`paired-acceptable-vector/v1` scores each job 1 when the selected semantic ID is in at least one independently acceptable vector, else 0. Whole-vector score is 1 only when the exact compatible pair is acceptable. Null is explicit abstention, scored correct only when allowed by gold. `scoreEvaluationSelection` implements that distinction. Invalid, timeout, unavailable and disallowed attempts score zero in the attempted-case denominator; they are not quietly removed or counted as correct null responses. Valid abstention is retained and reported separately.

Compute baseline and candidate scores on identical scenarios. Report per-job/whole-vector correctness, counts/ties, false reassurance, unnecessary alarm, qualifier retention, useful coverage, abstention, question burden and correction effort. Report every attempted call and failure, not just accepted calls. A provider choice cannot make a forbidden judgment acceptable, and an acceptable optional vector cannot compensate for a hard violation.

Proposed activation threshold per job is **at least 5 percentage points absolute paired improvement** over the complete baseline, with the lower bound of a 95% paired stratified-bootstrap interval strictly above zero. Freeze 10,000 resamples, seed=3102026, stratification by the three predeclared groups. Define optional eligible subsets before holdout, minimum proposed subset size=30; no post-hoc subset/threshold search. Sample-size/power review is pending: 240 cases does not automatically supply adequate power. If only a predeclared slice benefits, activation is restricted to that slice after all approvals. If a job does not beat baseline, it remains off and the result is reported.

The proposed reliability target is 99.5% valid response, but the manifest explicitly prohibits claiming that from 240 cases or tiny replay tests. Rare-event safety, clinical benefit and production reliability need separately designed larger evidence. Performance targets are local recomputation p95 <25ms after input load; refinement p95 <1200ms within the 1500ms total deadline. Measure end-to-end and cold/warm latency, failed attempts, actual usage, total cost and cancellation. These values are targets, not measurements. Published prices/throughput are not Derive results. No monetary estimate or spend authorization is implied.

## Protocol and robustness freeze

`JEV_PROTOCOL` version=jev-choice-v1: sumEpsilon=0.000001, tieEpsilon=0.000001, confidenceEpsilon=0.000001; one attempt, no interactive retry, 1500ms total deadline, conservative input bound 2000 and response cap 32768 bytes. The adapter currently uses serialized request byte count <=2000 as a conservative bound when a tokenizer is unavailable; it does not claim an exact token count and never truncates evidence. Native usage must be bounded nonnegative integers. Retry-After cannot extend the deadline. Credentials stay server-side; request/response body logging is disabled.

Each Choice must contain exactly submitted options, finite probabilities in [0,1], sum within sumEpsilon, confidence in [0,1], selected probability within tieEpsilon of the maximum, and confidence consistent with the pinned adapter formula. Unexpected/missing/duplicate fields, questions/options, inconsistent independent combinations, model mismatch, oversize or invalid JSON fail to the complete baseline. These tolerances and confidence formula need vendor-protocol review before any live run; passing fabricated responses does not establish vendor precision. Host baseline exact ties use stable semantic ID; independently labeled gold may allow several tied correct choices. Protocol ties cannot manufacture eligible options.

Three repeated runs per scenario are proposed. Predeclare harmless job/option order changes, neutral semantic-ID renames, independently reviewed equivalent wording and eligible menu changes. Preserve semantic labels; give every transformed menu a new content hash and restore normalized choices through its explicit inverse. Log/review every consequential flip; no unexplained consequential flip is acceptable for promotion. Wording/menu-membership robustness needs independently authored variants and separate semantic adjudication, rather than automatic assertion that all text changes are harmless.

Local executed tests in [part-three-evaluation.test.ts](../tests/part-three-evaluation.test.ts) cover all eight combinations of job reversal, option reversal and neutral-ID renaming through the real Jev adapter with description-based injected responses. The unchanged semantic selected vector is restored and scored; original menu is unmodified. Incompatible independent choices still reject after transform; unknown inverse IDs reject; multiple good vectors, crossed incompatible vectors, allowed/disallowed abstention and failed-attempt denominators are distinguished. This is deterministic protocol robustness, **not model robustness or utility**. The existing [provider suite](../tests/part-three-provider.test.ts) covers malformed/distribution/confidence/model/usage/timeout/HTTP-injection failure behavior. No external call is required by these tests.

## Processing, artifacts and spend gates

| Gate | Required approval before live synthetic evaluation | Current state |
|---|---|---|
| Product/evidence/privacy/engineering | Assigned reviewers and decisions for task/release/copy/scientific applicability | Unassigned, pending |
| Independent corpus/gold | Authors/adjudicators, actual artifact and split hashes, blind holdout | Unassigned; authored/adjudicated=0; hashes=null |
| Payload rights | Exact source fields and derived descriptions/enums authorized for this processor/job | Pending; local display is not external permission |
| Processor | Exact provider/model, subprocessors, region, account-specific terms and telemetry | Pending |
| Retention/deletion | Provider retention/deletion and local artifact retention/backup/tombstone policy | Pending; no-training is not zero retention |
| Artifacts | Approved location/access, permitted request/response content, usage/error records, sanitized identifiers and deletion plan | Pending; no body logs/general analytics/session replay |
| Spend | Explicit capped currency/amount, per-encounter/server caps, circuit breaker and accountable owner | No approved spend; manifest minor units=0; no credentials allocated by this task |
| Real-person processing | Separate purpose/field/processor/consent/control review | Not allowed by this contract |
| Activation | Independent passing utility/reliability/authority evidence for each job/slice plus processing/release approval | False; both jobs default off |

Authorized local synthetic files and injected protocol tests may be retained in this workspace under the current engineering scope. A future live run must explicitly approve which synthetic payloads/normalized responses/distributions can be saved, retention duration, backups/access, review recipients and purge procedures; these decisions remain pending. Hashing health content is not anonymization. No promise of external erasure follows from local deletion.

A result record must include manifest/corpus/labels/split hashes, exact candidate/source pins, baseline and all attempted normalized outcomes, blinded gold/acceptable vectors, hard violations, transformations/flips, timing/usage/cost, exclusions with reasons, and reviewer decisions. No model activation or benchmark claim may be written while any required gate is unresolved. Protocol passes and the functional gated adapter are deliverables; empirical incremental value remains unmeasured.
