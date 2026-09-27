/// <reference types="node" />
import { readFileSync, realpathSync, lstatSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { evaluatePerceptionBenchmark, parseFrozenPerceptionManifest, sha256, unpreparedPerceptionReport } from './perception-benchmark.ts';

// No network, provider SDK, upload, credential or catalog import is permitted here.
try {
  const args = process.argv.slice(2);
  if (!args.length) console.log(JSON.stringify(unpreparedPerceptionReport(), null, 2));
  else {
    if (args.length < 3 || args.length > 4) throw new Error();
    const [manifestPath, imageDirectory, digest, outputsPath] = args;
    if (lstatSync(manifestPath).size > 2_000_000 || (outputsPath && lstatSync(outputsPath).size > 16_000_000)) throw new Error();
    const json = readFileSync(manifestPath, 'utf8');
    const manifest = parseFrozenPerceptionManifest(json, digest);
    const imageRoot = realpathSync(imageDirectory);
    const imageDigests = new Map<string, string>();
    for (const row of manifest.cases) {
      const imagePath = resolve(imageRoot, row.imageFile);
      const stat = lstatSync(imagePath);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 12 || stat.size > 10 * 1024 * 1024 || dirname(realpathSync(imagePath)) !== imageRoot) throw new Error();
      const bytes = readFileSync(imagePath);
      const extension = extname(imagePath);
      const matchesType = extension === '.jpg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : extension === '.png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
      if (!matchesType) throw new Error();
      imageDigests.set(row.imageFile, sha256(bytes));
    }
    const outputs: unknown = outputsPath ? JSON.parse(readFileSync(outputsPath, 'utf8')) : [];
    const report = evaluatePerceptionBenchmark(json, digest, imageDigests, outputs);
    console.log(JSON.stringify(report, null, 2));
    if (report.providers.some(provider => provider.failed)) process.exitCode = 1;
  }
} catch {
  // Never print raw gold/output, source references, paths or provider error text.
  console.error('INVALID_PERCEPTION_BENCHMARK_INPUT');
  process.exitCode = 1;
}
