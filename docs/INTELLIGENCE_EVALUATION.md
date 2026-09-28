# Decision intelligence evaluation

**Status: EVALUATION.** This is Kanuj's offline soft-judgment benchmark. It is separate from Sami's [image perception benchmark](PERCEPTION_BENCHMARK.md). The deterministic P0-B decision policy and accepted product truth remain authoritative. No model is selected or connected to customer Check.

## v0 corpus and provenance

`benchmarks/decision-intelligence/corpus.ts` holds seven synthetic cases using the existing reviewed `tests/fixtures/p0b/policy.ts` input factory. Each case names the corresponding `tests/p0b-policy.test.ts` assertion and explains the narrow label translation. Inputs carry a product snapshot projection, exact binding revisions, profile, routine, history and formula facts. They contain no customer data. The four-field output is `routineContribution`, `overlap`, `needsMoreContext`, and `abstain`. It cannot express a final action, product fact, diagnosis, safety claim, or universal score. Schema parsing rejects extra own keys, accessors, nonplain objects and inconsistent abstention, then returns a fresh copy of validated primitives.

These labels are **reviewed P0-B policy expectations**, not independent founder-reviewed gold. The reviewed tests establish facts such as sourced role redundancy and missing-formula blocking; they do not validate a model's skincare judgment. The seven cases cover a supported role gap, sourced role redundancy, explicit replacement intent, incomplete routine with and without a known match, conflicting formula, and reported reaction with missing context. They do not establish partial redundancy, meaningfully different function, concentration reasoning, preference tradeoffs, repeated class overlap or no meaningful difference. Those require separate founder review and explicit rationale before adding scored labels. A reviewed case can be added only after its source, input binding, and label rationale are recorded. Avoid recycling model predictions as gold.

Run offline with Node 22 or newer:

```sh
node --experimental-strip-types benchmarks/decision-intelligence/run.ts
node --experimental-strip-types tests/decision-intelligence-benchmark.test.ts
```

The report includes a corpus version and SHA-256 over case IDs, scenarios, provenance, expected outputs and exact synthetic inputs. It records P0-B engine and policy versions. The baseline adapter executes `evaluatePersonalDecision` on every case and maps its findings and routine impacts to a **non-authoritative** contribution signal. A role match without a critical gap maps to incremental; sourced duplication or explicit replacement maps to its narrower relation; absent support abstains. Strong overlap comes only from a supported impact. A critical evidence need sets `needsMoreContext`. The mapping is intentionally conservative and cannot change the packet's deterministic action.

`replayRecordedRuns` is an offline comparison seam for later Jev/Gemini records. Every run must pin this exact corpus version and SHA-256, a model version, adapter and prompt hashes, one attempt per case, actual cost/latency/token measurements, and a valid output or explicit failure. Corpus mismatch fails before scoring, even when case IDs still match. It computes label accuracy, macro F1, abstention agreement, schema validity, critical positive signals, repeated-run stability, Brier score when comparable probabilities exist, p50/p95 latency, cost and provider failures. The replay cannot prove the supplied records came from the named provider or that their measurements are honest; retain invocation evidence with any future reviewed run. The unit test uses artificial records solely to check replay arithmetic and does not publish them as provider results.

## Current result

At corpus `decision-intelligence-v0/1`, SHA-256 `45da401dc63e8311bc1c0b4107a456a208f236695869cf7667328fd3e879b52e`, P0-B `p0b-findings/5` and `p0b-policy/3`, one offline baseline run produced:

| Candidate | Status | Cases | Exact contribution label | Macro F1 | Abstention agreement | Schema validity | Critical positive signals | Provider failures |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| P0-B deterministic | RUN | 7 | 7/7 | 1.0 | 7/7 | 7/7 | 0 | 0 |
| Jev | NOT_RUN | 0 | null | null | null | null | null | 0 |
| Gemini structured | NOT_RUN | 0 | null | null | null | null | null | 0 |

The 7/7 result is **self-alignment against assertions from the same P0-B policy**, not independent accuracy. It cannot establish superiority or a winner. No independent disagreement analysis is possible yet; baseline disagreements on this narrow set are zero. Run count is one, so repeated-run stability is null. No calls occurred, so measured p50/p95 latency, cost per case, token use and Brier score are null. Published provider prices are not measured costs. The baseline's numeric metrics must not be used to approve a provider.

## Provider research and execution gate

Primary sources checked on 2026-09-28:

- [Google image understanding](https://ai.google.dev/gemini-api/docs/image-understanding) documents multimodal inputs; [structured output](https://ai.google.dev/gemini-api/docs/structured-output) supports a subset of JSON Schema. Gemini is eligible for a **separate** candidate image-evidence task and for this text/structured soft-judgment challenger, never as product truth or final action. [Pricing](https://ai.google.dev/gemini-api/docs/pricing) varies by model, tier and modality, so no fixed case cost is assumed. Google's [data-retention guidance](https://ai.google.dev/gemini-api/docs/zdr) says paid prompts and responses are not used to improve products but paid-service abuse logging can retain them for a limited period; guaranteed zero retention points to Vertex AI. Exact deployment terms and allowed fields need review.
- [TypeSafe's Jev model page](https://docs.typesafe.ai/models) documents text/structured input, `jev-1.13.0`, published $0.042 per million input tokens and free output tokens. [The API reference](https://docs.typesafe.ai/api) documents typed Choice, Score and Noul questions and versioned responses. That supports a bounded **text-only** soft-judgment candidate; it is not an image extractor. [TypeSafe's privacy policy](https://typesafe.ai/legal/privacy-policy) says input is not used to train or fine tune models, but describes retention as long as reasonably necessary; [legal docs](https://docs.typesafe.ai/legal) offer enterprise zero-data-retention terms. An exact standard-account prompt retention period and Derive-specific processing approval are **UNKNOWN**. No primary measured latency for Derive cases was found, so latency is **UNKNOWN**. [Jev 1.13 limitations](https://docs.typesafe.ai/model-jaggedness/jev-1.13) include sensitivity to irrelevant state and adversarial text; a future test must keep state small and include hostile inputs.

Before either external run: obtain a separately reviewed independent labeled corpus; approve a pinned model/version, prompt and adapter; approve the specific synthetic fields and provider account terms, retention, training use, region, access and spend; then permit provider calls explicitly. Keep keys server-side and use the **same frozen corpus** for both challengers. Record exact model response version, prompt/adapter hashes, attempts, failures, measured latency, billed cost and token usage. Validate every raw response against the strict schema before comparison. Use repeated runs for stability and probabilities for calibration/Brier only when the provider actually supplies comparable probabilities. Review every unsupported positive contribution and every provider disagreement, including safety-adjacent cases, individually. No customer data or photo upload is authorized by this document.

**Production criterion:** a challenger must show measured incremental customer value over P0-B on independently reviewed cases for a bounded job, with acceptable abstention, failures, privacy and cost. Provider outage or invalid output must leave the deterministic P0-B path available. A provider signal cannot establish identity, formula, concentration, safety, prescription change or final customer action.
