# Bounded hosted scanner drill

This tool is preparation, not deployment authorization or release acceptance.
Default `--dry-run` makes no network request or credential read. Local harnesses
continue to refuse hosted URLs; none of their safety guards is removed.

After separate founder approval, backup/restore review, exact-head green CI and
reviewed scanner migration/function deployment, the root operator may run:

```sh
node scripts/test-scanner-hosted.mjs --dry-run
node --test scripts/test-scanner-hosted.test.mjs
node scripts/test-scanner-hosted.mjs --run-approved --source EXACT_CLEAN_SHA --backup-reference sha256:BACKUP_RECEIPT_DIGEST --output PRIVATE_NEW_RECEIPT_PATH
```

The backup reference is an operator-supplied receipt digest, not automated proof
that a backup restores. Verify the recoverable backup separately. The CLI flag
records explicit operational approval; it cannot grant authority by itself.

The target is fixed to `snojlbqovlawewwqbviz`. The drill checks existing signup
configuration before writing anything and refuses confirmation-required signup
rather than modifying it. It creates two synthetic permanent password accounts
under a unique reserved `.invalid` email tag. It exercises free access without
Managed membership, synthetic optional context/revision replay, unknown-product
abstention, authoritative insufficient-decision/replay and manual Auth denial,
explicit Check save/replay, cross-owner context/case/decision/history denial,
retailer link recovery, and customer-requested account deletion.

No catalog row, image, model request, external lookup, membership, billing or
Auth/SMTP configuration is created/changed. Keys stay in process memory; API
bodies, credentials, passwords, tokens and profile payloads are not logged.
The new private receipt (0600, never overwrite on reservation) records checks,
source, run tag and any remaining synthetic owner IDs for bounded recovery.
Only exactly matching generated owner IDs/email tags may be cleaned up. Because
this drill never uploads files, failed customer deletion may fall back to exact
synthetic Auth-user cleanup; that fallback is a failure, not deletion proof.

An interrupted signup can leave a synthetic owner before its ID is recorded.
Do not bulk-delete accounts: use the receipt's unique run tag to inspect the
exact fixture manually and verify its generated email before removal.

This proves only the bounded hosted API journey if actually executed. It does
not prove positive skincare coverage, real email ownership/recovery delivery,
Storage failure/race handling, Managed regression, mounted React, camera,
native binary, physical iPhone or App Store acceptance. Separate acceptance
must cover those boundaries; a successful empty-catalog check is not a useful
scan hit. No live run has been performed by adding this tool.
