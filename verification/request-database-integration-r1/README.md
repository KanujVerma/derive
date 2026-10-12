# Reviewed request-evaluator/database integration package

Prepared for the public `KanujVerma/derive` review branch
`review/bundle-native-verification-20261012`, under
`verification/request-database-integration-r1/`. This folder has not been pushed
by its preparer. It does not merge, deploy, activate an endpoint or contact a
hosted database or model provider.

## What becomes public

This is real application backend TypeScript source plus local integration tests,
not only synthetic SQL. The unchanged 88-file closure contains 73 application
files and 77 TypeScript files total. The complete exact paths, sizes and SHA256
pins are in TRANSFER-MANIFEST.json. Included application paths cover
`derive-parent-authored/src/contracts`, `src/domain`, the context projection
service, and `supabase/functions/personalized-sheet`; other included paths are
context-reader authority, synthetic retained-domain fixtures and native-request
test/packaging files. Dependency binaries/node_modules are not included.

The owner explicitly approved publication of backend source/tests and the
embedded private provenance references. The unchanged ingredient release
`src/domain/part-four/approved423-runtime.ts` contains 3 distinct Library IDs
(425 references), 1 backing file ID, 1 approval message ID (526 references), the
filename `More Skincare Ingredients for Review.docx`, and original document,
approval/version and hash metadata. Those fields are runtime-significant for the
approved release digest and withdrawal dependencies, so they remain unchanged.
The private document's attachment bytes are not included.

Executable release-selection code in `src/domain/part-three/release.ts` also
contains the static project URL `https://snojlbqovlawewwqbviz.supabase.co`.
It is not a credential and was not contacted during preparation.

The package retains one reviewed synthetic offline TAP transcript, with test
names/timings and 147 PASS results. Its exact 11760-byte SHA256 is
`51142e32e8d458130e958739358703a570671a7ec3f1e269dd4aa5632fd695ea`.
No credential values, raw JWTs, real personal records/emails, private download
URLs, private attachment contents or native operational logs were found in the
88-file manual and known-pattern review. No unrelated files or new source bytes
were added. Static review has the usual limits; it is not a guarantee about every
possible sensitivity interpretation.

## Exact immutable identity

- Base64 transport: 508893 bytes, SHA256
  `4aad7934555878bd622f7c6e1d3d01956226a659d218dfcb66190c6bce59b4db`
- Decoded gzip: 381668 bytes, SHA256
  `7d813ccd4f8cf5eba457c39461f91df45e5faa78a01e3a2fcab843499cb1cc20`
- Canonical decompressed JSON: 2021193 bytes, SHA256
  `06ef7b0302f14c8c38ba3bf0d5f90192f640f4c00111ac32512fb81bdc328c41`
- All 88 original per-file pins were reverified. Original private manifest:
  47352 bytes, SHA256
  `734375f2ee2803b99953d379e0eddfdbac5f5a0ee1117eb9f07fe32465633439`

The transport is RFC4648 base64 of the original gzip followed by one LF. No
recompression, package regeneration, provenance redaction or source rewriting
was performed. TRANSFER-MANIFEST.json retains every original manifest field/pin
and adds only public transport/disclosure metadata.

## Verification and limits

The new request/database native integration is UNRUN. Earlier consumer download
failures prevented its execution. Root source review is complete; 147 offline
tests, strict TypeScript, emitted-JavaScript and exact-source checks passed in the
authoring/review workflow. These are separate from native SQL proof.

Its external frozen r5 SQL prerequisite separately passed 185 bounded checks on
PostgreSQL 15.19. Required unchanged gzip SHA256:
`11c980e04a46c27293c609c4bb7163f98aeebe403499c76d59e219aa5479561e`.
The r5 package is already on this review branch and is not duplicated here.

The new test exercises actual existing request evaluator/adapters and SQL guards
for one administrator-authored retained, questionless operation: captured
session RPC, retained recovery, pinned atomic publication and replay, expired or
mismatched sessions, and unchanged charged-call rows. It never invokes a provider
or admits/reserves/dispatches a new paid operation during evaluator execution.
Auth uses explicit synthetic preverified claims/platform scaffolding; source,
review and grant metadata are synthetic. No hosted JWT/login/logout, Auth or
PostgREST behavior, live permission/model quality, new-operation admission,
questions, deployment, app/device integration or feature readiness is proved.

## Reproduce safely after review

Use only existing verified Node 24.19.0, TypeScript 6.0.3 and Zod 4.6.5.
Authoring type declarations were @types/node 22.20.3 and undici-types 6.21.0.
No installation or source substitution is part of this package.

Decode and verify the transport, then verify every pin before writing to a new
empty directory. This small extraction recipe does not run application or SQL
code:

```python
from pathlib import Path, PurePosixPath
import base64, gzip, hashlib, json
sha = lambda b: hashlib.sha256(b).hexdigest()
encoded = Path('request-database-integration-r1.json.gz.b64').read_bytes()
assert len(encoded) == 508893
assert sha(encoded) == '4aad7934555878bd622f7c6e1d3d01956226a659d218dfcb66190c6bce59b4db'
compressed = base64.b64decode(encoded.rstrip(b'\n'), validate=True)
assert len(compressed) == 381668
assert sha(compressed) == '7d813ccd4f8cf5eba457c39461f91df45e5faa78a01e3a2fcab843499cb1cc20'
raw = gzip.decompress(compressed)
assert len(raw) == 2021193
assert sha(raw) == '06ef7b0302f14c8c38ba3bf0d5f90192f640f4c00111ac32512fb81bdc328c41'
data = json.loads(raw)
assert len(data['files']) == len(data['pins']) == 88
checked, seen = [], set()
for f, pin in zip(data['files'], data['pins']):
    name = f['path']; relative = PurePosixPath(name)
    assert not relative.is_absolute() and '..' not in relative.parts
    assert str(relative) == name and name not in seen and name == pin['path']
    seen.add(name); content = f['text'].encode('utf-8')
    assert len(content) == pin['bytes'] and sha(content) == pin['sha256']
    checked.append((relative, content))
out = Path('request-integration-extracted')
assert not out.exists(), 'Use a new empty extraction directory'
out.mkdir()
for relative, content in checked:
    target = out / relative; target.parent.mkdir(parents=True, exist_ok=True)
    with target.open('xb') as handle: handle.write(content)
print('88 original source pins verified; no native code executed')
```

The original runnable driver, fixture/transport tests and full compile/native
instructions are now at
`request-integration-extracted/derive-parent-authored/tests/native-request/README.md`.
Use its TypeScript-to-JavaScript route with existing verified dependencies and
exact assets; no tsx dependency is required. The native driver requires a fresh,
disposable, local socket/loopback PostgreSQL 15+ database named `bundle_native_*`,
the external frozen r5 gzip, and explicit `--disposable-local`. Review the driver
and authorize that bounded native run separately. Preserve its failed and passed
results; do not treat this transfer or earlier offline PASS as native completion.
