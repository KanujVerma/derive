import { readFileSync } from 'node:fs';
import { evaluationReport } from '../src/fixtures/product-truth-evaluation/evaluator.ts';

// Local fixture output file only; this command makes no provider or network calls.
const outputPath = process.argv[2];
const outputs: unknown = outputPath ? JSON.parse(readFileSync(outputPath, 'utf8')) : {};
if (!outputs || typeof outputs !== 'object' || Array.isArray(outputs)) throw new Error('Expected a task-id keyed output object');
const report = evaluationReport(outputs as Record<string, unknown>);
console.log(JSON.stringify(report, null, 2));
if (report.resolver.failed || report.extraction.failed) process.exitCode = 1;
