/** Read-only P0-D candidate metadata and pinned evidence preflight. Does not read dotenv/keys or contact services. */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { inspectCustomerRelease, REQUIRED_CHECKS } from './acceptance/p0d/releaseEvidence.ts';
import { sourceMetadata, buildMetadata } from './acceptance/p0d/sourceMetadata.mjs';
const args = process.argv.slice(2);
if (args.includes('--help')) {
 console.log('Usage: node --experimental-strip-types scripts/preflight-customer-release.mjs [--manifest PATH]\nWithout a manifest: safe source/config metadata only. With a manifest: verify artifact hashes, exact source/environment/binary and all P0-D observations. Missing gates exit 2; invalid evidence exits 1; complete records still require independent review. No release action occurs.');
 process.exit(0);
}
try {
 if (args.length && (args.length !== 2 || args[0] !== '--manifest')) throw new Error('Expected --manifest PATH or no arguments');
 const source = sourceMetadata(), configuration = buildMetadata();
 if (!args.length) {
  console.log(JSON.stringify({ status: 'METADATA_ONLY', source, configuration, gates: Object.keys(REQUIRED_CHECKS).map(kind => ({ kind, status: 'missing' })), limitations: ['No binary inspected.', 'No runtime or customer gate executed.', 'Existing hosted build flavors route through legacy presentation; scanner-first hosted guest activation remains separate.'] }, null, 2));
 } else {
  const path = resolve(args[1]), manifest = JSON.parse(readFileSync(path, 'utf8'));
  // Artifact paths are relative to the manifest, not an arbitrary caller working directory.
  const report = inspectCustomerRelease(manifest, source, artifact => readFileSync(resolve(dirname(path), artifact)));
  console.log(JSON.stringify({ ...report, source, configuration }, null, 2));
  if (report.status === 'INCOMPLETE') process.exitCode = 2;
 }
} catch (error) { console.error(error.message); process.exitCode = 1; }
