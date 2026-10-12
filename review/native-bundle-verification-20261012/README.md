# Derive disposable bundle SQL test package

Status: **UNVERIFIED local candidate. Native PostgreSQL has not been run.**

This package is for a separate test-only branch and a fresh disposable local
PostgreSQL 15+ cluster. It is not a migration release, deployment instruction,
or evidence of production readiness. Do not apply it to a hosted or existing
database. It never calls a model provider.

`manifest.json` lists exact SHA-256 and byte pins for the unmodified gzip, every
SQL source, and each test asset. The gzip contains 33 SQL files and four assets,
including the complete local runner. It does not need the application repository
to be present in the native test environment.

## Important evidence boundaries

- Twenty-four baseline SQL files are exact recovered source. The original Part One
  bootstrap was not recovered; its independently verified fourteen-slice
  reconstruction is explicit. A separately recovered session-binding source is
  also included unchanged.
- Auth/Storage platform substitutes are clearly marked test scaffolds. The
  minimal auth.sessions table and GUC claim readers do not verify JWT signatures,
  issue sessions, or establish hosted logout API behavior.
- Product, owner, context, processing grants, and retained settlement metadata are
  administrator-authored synthetic local fixtures. Health-shaped context fields
  are fixture inputs, not observations about a real person.
- The candidate preserves existing SQL ledgers and charged-call rows. New
  operation admission/provider dispatch and question selection remain closed.
- Authenticated pin expiry authenticity relies on a verified end-user JWT RPC
  and trusted request-scoped server; no compromised service-key defense is claimed.
- Local workspace path strings are retained only as source/reconstruction
  provenance. They are not endpoints or credentials.

## Native verification

The public branch transports the exact gzip as a UTF-8 base64 file. Decode it
first; this is a transport transformation only, not a package/source change:

```sh
python - <<'PY'
import base64
from pathlib import Path
encoded = Path('bundle-native-test-package.json.gz.b64').read_bytes()
Path('bundle-native-test-package.json.gz').write_bytes(base64.b64decode(encoded))
PY
```

Verify both the base64 transport and decoded gzip SHA-256 against `manifest.json`.
Then materialize the runner:

```sh
python - <<'PY'
import gzip, json
from pathlib import Path
p = json.loads(gzip.decompress(Path('bundle-native-test-package.json.gz').read_bytes()))
a = next(a for a in p['assets'] if a['path'] == 'run-native.py')
Path('run-native.py').write_text(a['text'])
PY
```

Use a fresh local cluster in which anon/authenticated/service_role and the test
schemas do not yet exist. Create a disposable database named bundle_native_review.
Then run:

```sh
python run-native.py --package bundle-native-test-package.json.gz \
  --host /tmp/disposable-pg-socket --port 5432 --user postgres \
  --database bundle_native_review --disposable-local --output native-results.json
```

Only local sockets or loopback are accepted. The test writes its named results
and exact SQL/exit/stdout/stderr evidence locally. Tests include actual row-lock
serialization, retained execution/session deadline rollback, and duplicate
publication/replay; a complete run takes several minutes. Until a native run
finishes successfully, compile and SQL concurrency behavior remain unverified.
