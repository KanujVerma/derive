# Derive disposable bundle SQL test package, r5

Passed **185 checks on separate disposable PostgreSQL 15.19**: 34 SQL compiles,
23 scalar/actual-TypeScript parity, 120 native, 6 ACL and 2 environment checks.
There were 305 SQL results, including 66 expected rejections. Exact decoded gzip
SHA256: `11c980e04a46c27293c609c4bb7163f98aeebe403499c76d59e219aa5479561e`.

Actual two-connection publication produced one new packet and one exact replay.
Readback, removed-session rejection, erasure/accounting preservation, two
execution-expiry rollback cases and three session-row lock/deadline cases passed.

## Evidence boundaries

- Local undeployed candidate, not a migration release or feature-readiness claim.
  Never apply this stack to an existing or hosted database.
- Original Part One bootstrap was not recovered; fourteen explicitly pinned
  reconstructed slices are included. All other recovered authority is byte-pinned.
- Auth/Storage/session tables and JWT GUC readers are test scaffolds. They do not
  prove hosted JWT signatures, session issuance or logout API behavior.
- Owners, products, health-shaped context, grants and settlements are synthetic
  administrator-authored fixtures. No provider/model call occurs.
- New-operation admission/dispatch, questions, request-evaluator/client database
  integration, hosted activation and deployment remain separate gates.
- Real application SQL and local source/reconstruction provenance paths are
  disclosed. No secrets, private URLs, genuine personal data, command logs or
  private evidence attachments were detected/included in this bounded package.
- Original 33 SQL inputs remain unchanged. The 34th file only gives an obsolete
  provisional fixture scaffold its existing result_expiry. The complete domain
  payload is admitted later under unchanged guards. Runner-only corrections make
  output explicit JSON and match one source-backed rejection; guards, predicates,
  strict JSON parsing and publication expectations are unchanged.

## Reproduce locally

Only the base64 transport, this README and manifest belong in the public test
branch. The manifest pins every SQL/asset and both transport/decoded gzip bytes.
Decode, verify those SHA-256 values, then materialize the bundled runner:

```sh
python - <<'PY'
import base64, gzip, json
from pathlib import Path
raw = base64.b64decode(Path('bundle-native-test-package.json.gz.b64').read_bytes())
Path('bundle-native-test-package.json.gz').write_bytes(raw)
p = json.loads(gzip.decompress(raw))
Path('run-native.py').write_text(next(a['text'] for a in p['assets'] if a['path']=='run-native.py'))
PY
```

Use a fresh local PostgreSQL 15+ cluster with no preexisting test schemas or
anon/authenticated/service_role roles. Create bundle_native_review, then:

```sh
python run-native.py --package bundle-native-test-package.json.gz \
  --host /tmp/disposable-pg-socket --port 5432 --user postgres \
  --database bundle_native_review --disposable-local --output native-results.json
```

Only local sockets/loopback are accepted. The suite takes several minutes and
writes its exact results/SQL/error evidence locally. Earlier frozen revisions
and failed evidence remain preserved. No merge or deployment is part of this
test-package transfer.
