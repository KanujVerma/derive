# Sami beta-critical portfolio — 2026-09-27 checkpoint

**SAMI MVP PORTFOLIO PARTIAL.** Source foundations and automated gates are not a
working photo recognizer, a hosted scanner-first beta, or physical acceptance.
This ledger complements canonical ownership and Kanuj's P0-D acceptance; it does
not replace them or assign his composition work to Sami.

## Recovered and preserved

Portfolio recovery began from main `22a210a7a720c9621d45e789b8690dcc73ab059a`.
The original dirty auth checkout was preserved. Existing camera work was reconciled,
not recreated: #95 readiness and #99 full-screen capture landed before Auto work.
Kanuj's subsequent P0-B/P0-D and ownership handoffs (#102, #107, #101) were retained.
No hosted activation, billing, EAS build, TestFlight submission or device installation
is authorized or claimed by this pass.

## Portfolio DAG and independent writers

```text
S1 camera controller / Auto + manual fallback ──────┐
                                                  ├─ S5 physical capture acceptance
S2 private corpus + extractor evaluation ──────────┤
                 └─ candidate extraction → S6 truth┘
S3 explicit contribution / reviewed catalog ───────── canonical coverage
S4 P0-C abuse / lifecycle / activation preparation ── hosted gate
Kanuj P0-B / P0-D consumer and release integration ── separate owner
```

Camera, perception tooling, contribution preparation and operational inventory
ran concurrently with disjoint write-sets. Root independently reviewed and serialized
landings. Remaining branches reconcile after every main advancement and rerun their
entire current suite, both TypeScript checks, web/iOS exports, scope/diff checks and
both exact-head CI jobs. Shared Auth, migration order, root navigation/Check and
runtime/device resources remain single-writer boundaries.

## Actual implemented outcomes

### S1 — camera: useful Auto increment, not automatic label recognition

The full-screen camera starts in Auto with continuous supported retail-barcode
observation and a visible shutter. Technical roles sit behind a manual fallback.
Unknown still photos ask for clarification before submission; no fake classifier,
OCR or inferred formula is present. Torch, permission/busy guards, retained evidence
and synchronous state gates remain in the camera controller. Independent review
fixed same-tick callback/render races.

Installed Expo iOS source showed UPC-A data normalized to 12 digits while retaining
the `ean13` type; #110 fixes this without relaxing checksums or accepting compressed
UPC-E as EAN-8. See [SMART_CAMERA_AUTO.md](SMART_CAMERA_AUTO.md).

Only the earlier #99 shutter-visible/bottom-tabs-hidden behavior has founder physical
confirmation. Auto, torch, fresh UPC-A/EAN-13 callbacks, recovery, small-screen and
large-text behavior still need a fresh real-device run. Simulator/export/CI are not
that evidence. The existing phone bundle is not assumed to contain these new landings.

### S2 — perception: frozen-input tooling; no provider winner or app OCR

#109 adds private frozen-manifest validation and offline replay of supplied provider
outputs against independently reviewed gold. #113 caps actual image-file reads and
rejects swapped files, including files that change after metadata inspection. Missing
runs remain NOT_RUN; no fabricated zero cost/latency or automatic winner. Model output
remains candidate evidence and cannot replace S6's immutable ProductTruthSnapshot.

The founder supplied 12 screenshots covering six nominal front/back pairs, then clarified
they are third-party Amazon-review images. Rights/source records and independent literal
gold are not established: **eligible frozen corpus 0; cloud provider runs 0; winner none**.
Images and raw results remain local/private and are not Git assets or catalog records.
Potential old/new-package and unbound front/back pairs are not assumed to share a formula.

A separate preliminary Mac-only Apple Vision OCR/barcode diagnostic ran locally on the
hash-checked originals without provider/network calls. It produced useful front-label
candidates but also garbled rear-label words/percentages at high engine confidence,
and Data Matrix codes that must not be treated as retail GTINs. This is not a frozen
provider benchmark, iPhone integration, exact transcription or formula verification.
Personally captured same-bottle photos, reviewed literal annotations and provider/privacy
gates remain needed. See [PERCEPTION_BENCHMARK.md](PERCEPTION_BENCHMARK.md).

### S3 — catalog: inactive contribution foundation, not the complete flywheel

#111 adds explicit-intent proposal validation and conservative, bounded candidate-demand
aggregation. Retries are owner/request bound; variants, market and package dimensions
remain separate; conflicting GTIN labels require review. Auth identities are not verified
distinct humans. This Sami leaf creates no customer UI, service, storage, enrichment,
canonical promotion or extra catalog product. Kanuj subsequently landed #117, an
uncomposed customer contribution draft/recovery module: it remains unavailable by
default until the owner-bound service and consent boundary exist.

Existing manual owner-bound `save_product` remains the provisional continuation path.
Founder policy is explicit opt-in, private photos and independently reviewed structured
facts only—no public image reuse or automatic formula approval. Concrete consent records,
reviewer access, retention/withdrawal, additive persistence/RLS and consumer composition
remain gates. See [CATALOG_CONTRIBUTION.md](CATALOG_CONTRIBUTION.md).

### S4 — P0-C: activation inventory, not hosted protections

The merged #112 readiness foundation reads fixed repository sources only; no .env,
secret or hosted service. It distinguishes local markers from runtime proof, reports
all twelve hosted gates UNKNOWN and activation BLOCKED, and intentionally exits 2.
Existing account policy is keep the existing account without automatic guest-data merge.
No automatic guest cleanup during beta is a recommendation awaiting founder decision,
not adopted indefinite retention. Storage-first customer deletion must remain intact.

Guest linking/conflict recovery, signup abuse, semantic completed-Check quota, concurrent
cleanup/upgrade/delete fencing, retention, operational alerts/rollback and exact hosted
readback remain unimplemented or unverified gates. Six photo-upload grants per rolling
24 hours are not the target three completed Checks/day. No subscription billing is active.
See [P0_C_ACTIVATION_READINESS.md](P0_C_ACTIVATION_READINESS.md) once that leaf lands.

## Landing evidence

These counts are per exact branch checkpoint, not additive portfolio totals. Full test
files include assertion-style scripts; registered TAP cases are reported separately.
Both TypeScript checks, web/iOS exports and diff checks passed for each listed head.

| Increment | Reconciled head | Unit evidence | Exact-head CI | Merge |
| --- | --- | --- | --- | --- |
| [#108 Auto camera](https://github.com/KanujVerma/derive/pull/108) | c071bd7 | 74 files / 619 TAP cases | [both green](https://github.com/KanujVerma/derive/actions/runs/36339380562) | c7e1d53 |
| [#110 iPhone UPC-A normalization](https://github.com/KanujVerma/derive/pull/110) | 252a104 | 74 files / 620 TAP cases | [both green](https://github.com/KanujVerma/derive/actions/runs/36349902229) | 24529ae |
| [#109 offline perception benchmark](https://github.com/KanujVerma/derive/pull/109) | 70baca3 | 75 files / 628 TAP cases | [both green](https://github.com/KanujVerma/derive/actions/runs/36350697097) | fc6f923 |
| [#111 contribution foundation](https://github.com/KanujVerma/derive/pull/111) | ae953f7 | 76 files / 646 TAP cases | [both green](https://github.com/KanujVerma/derive/actions/runs/36351171323) | 4b71bdd |
| [#112 operational inventory](https://github.com/KanujVerma/derive/pull/112) | 50cbca0 | 77 files / 653 TAP cases | [both green](https://github.com/KanujVerma/derive/actions/runs/36351669618) | 39c0fed |
| [#113 bounded image reads](https://github.com/KanujVerma/derive/pull/113) | 1b3db3e | 81 files / 669 TAP cases | [both green](https://github.com/KanujVerma/derive/actions/runs/36358334883) | 4d7e751 |

#109's earlier database job failed at local container startup because port 54324 was
already in use, before its database tests. That failure was not reported as a pass;
the reconciled exact-head run above passed startup, fresh reset and database/integration
checks without weakening tests. Kanuj's #116 release-copy source, #117 inactive
contribution module, #118 Check-entry composition, and #119 docs handoff were
subsequently merged on main `83c9db64e5ec1c2bc7a75cce7f95dde1cc66ec4d`;
#113 then merged as `4d7e75188c426bf6d8e47ad0f2bb1927964ccd25`.
#118 rendered the current-source Check entry in Simulator; tap-driven navigation and
physical camera use were not proven. #116 did not deploy the public site. No Sami leaf
overwrote those source or acceptance boundaries.

## Next integration and founder gates

- Use the merged bounded-image-read follow-up as an offline tooling safety fix,
  not recognition. The merged P0-C inventory does not complete hosted operations.
- Decide on-device label-text prototype versus deferring native code. A native text
  module requires a Derive development build, not Expo Go; no change is implemented yet.
- Obtain suitable same-bottle photo/source permissions and independent gold, then compare
  actual providers. No cloud video streaming or API keys in the client.
- Resolve retention/reviewer/withdrawal decisions before destructive cleanup or contribution
  storage. No deletion, public image reuse or hosted activation is implied by these docs.
- Coordinate stable capture/extraction/truth interfaces with Kanuj; do not implement his
  active Check/P0-B/P0-D composition in parallel. Kanuj's inactive contribution UI
  needs a reviewed service handoff before activation. Reuse [P0-D acceptance](P0_D_ACCEPTANCE.md)
  and issue #86 for separate physical/customer/release evidence.

No unexpected app/** changes or counterpart-work conflicts occurred in these focused
leaves. Parent issues #103–#106 and physical acceptance remain open because the complete
customer outcomes and release gates have not been proven.
