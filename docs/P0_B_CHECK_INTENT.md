# Per-Check intent authority

Owner: Kanuj. Scope: P0-B request, binding, evaluator adapter, customer controller and backend regression coverage.

Each Check declares its own purpose. `PersonalDecisionRequest.checkIntent` accepts `add`, `replace`, `check_current`, `unanswered` or `withheld`. Omission becomes `unanswered`. The server never reads persisted `PersonalProfileInput.intent` when evaluating a new Check. Existing profile records and their intent values remain intact for provenance and round trips.

`DecisionBinding.checkIntent` is required on newly accepted packets and independent expected bindings. The evaluator input must match it. The server freezes the normalized request and binding in the existing assessment `input` JSON. Whole-input database idempotency already rejects changed inputs, so no migration is needed. A repeated request ID with changed intent returns `IDEMPOTENCY_CONFLICT`; a new intent requires a new request ID.

`CustomerController.assess(snapshot, checkIntent?)` accepts an explicit per-Check value. An omitted argument retains the value for the same resolution case across context reloads/edits; a new case or owner starts unanswered. A host continuing into a different resolver case must explicitly carry the same customer attempt's intent when justified. `CustomerState.checkIntent` exposes the current value. The retry key includes it, and the client compares the server binding against its own value before accepting a result. The synchronous visible-result gate also checks intent.

Historical assessments without `binding.checkIntent` remain stored unchanged. They cannot pass current packet parsing/integrity or be returned as a current server receipt; the service returns `ASSESSMENT_UNAVAILABLE` for a legacy retry with otherwise matching references. A changed declared intent conflicts with the previous request before replay. This is a fail-closed additive transport change, with no backfill or silent reinterpretation of old records.

The existing deterministic findings and action policy are unchanged. Unknown and withheld intent continue to use the existing critical `profile_context` evidence need, retaining its unknown or withheld state. This change does not add clinical rules, product truth, provider/model calls, a UI or hosted activation.

Validation: focused omission/profile-invariance, explicit-input, parser, retry/replay, immutable legacy, independent binding and controller lifecycle regressions; existing affected fixture scenarios now declare their original intent explicitly. Archived gzip fixtures retain their original bytes/hash and declare their historical `add` precondition only after decoding. Backend smoke also checks missing/withheld inputs, intent-specific routine impact, persisted receipt bindings and unchanged profile records.
