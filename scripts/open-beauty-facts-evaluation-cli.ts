/// <reference types="node" />
import { mkdirSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readBoundedBenchmarkFile } from './perception-file-io.ts';
import { openBeautyFactsEvaluationReadiness, runOpenBeautyFactsEvaluation } from './open-beauty-facts-evaluation.ts';

// A single local process may perform evaluation reads. Shared-IP traffic from
// unrelated systems still needs an operator-level budget review before opt-in.
const lockPath = join(tmpdir(), 'derive-obf-catalog-evaluation.lock');
let ownLock = false;
try {
  const args = process.argv.slice(2);
  if (!args.length) console.log(JSON.stringify(openBeautyFactsEvaluationReadiness(), null, 2));
  else {
    if (args.length !== 7 || args[0] !== '--execute-reviewed') throw new Error();
    const [, path, digest, evaluationPermissionRef, termsReviewRef, userAgent, maxReads] = args;
    const json = readBoundedBenchmarkFile(path, 3_000_000).toString('utf8');
    // This refuses concurrent benchmark runs on this host. A crash leaves a
    // stale lock deliberately, so an operator must inspect before retrying.
    mkdirSync(lockPath); ownLock = true;
    const pending = await runOpenBeautyFactsEvaluation(json, digest,
      { allowNetwork: true, evaluationPermissionRef, termsReviewRef, userAgent, maxUniqueReads: Number(maxReads) });
    console.log(JSON.stringify(pending, null, 2));
    console.error('PENDING_INDEPENDENT_PACKAGE_ADJUDICATION; DO_NOT_USE_AS_COVERAGE_RESULT');
  }
} catch {
  // Never echo the raw provider response, barcode, source labels, paths or user agent.
  console.error('OBF_EVALUATION_NOT_AUTHORIZED_OR_FAILED');
  process.exitCode = 1;
} finally { if (ownLock) rmdirSync(lockPath); }
