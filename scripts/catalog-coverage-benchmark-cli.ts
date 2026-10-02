/// <reference types="node" />
import { evaluateCoverage, unpreparedCoverageReport } from './catalog-coverage-benchmark.ts';
import { readBoundedBenchmarkFile } from './perception-file-io.ts';

// No network requests, external API SDK, credential loading or database writes.
try {
  const args = process.argv.slice(2);
  if (args.length === 0) console.log(JSON.stringify(unpreparedCoverageReport(), null, 2));
  else {
    if (args.length !== 3) throw new Error();
    const [corpusPath, corpusSha256, runsPath] = args;
    const corpus = readBoundedBenchmarkFile(corpusPath, 3_000_000).toString('utf8');
    const runs: unknown = JSON.parse(readBoundedBenchmarkFile(runsPath, 16_000_000).toString('utf8'));
    console.log(JSON.stringify(evaluateCoverage(corpus, corpusSha256, runs), null, 2));
  }
} catch {
  // Never print a barcode, rights evidence, source record, path or provider response.
  console.error('INVALID_CATALOG_COVERAGE_INPUT');
  process.exitCode = 1;
}
