import assert from 'node:assert/strict';
import { CORPUS, CORPUS_VERSION, corpusSha256 } from '../benchmarks/decision-intelligence/corpus.ts';
import { replayRecordedRuns } from '../benchmarks/decision-intelligence/replay.ts';
import { buildProviderRequest, decodeProviderResponse, runProviderEvaluation } from '../benchmarks/decision-intelligence/provider-evaluation.ts';

const first = CORPUS[0];
const pin = { corpusVersion: CORPUS_VERSION, corpusSha256: corpusSha256() };
const jev = buildProviderRequest('jev', 'jev-1.13.0', first);
assert.equal(jev.url, 'https://api.typesafe.ai/v1/systemone');
assert.equal(jev.body.model, 'jev-1.13.0');
assert.equal(typeof jev.body.state, 'object');
assert.equal(JSON.stringify(jev.body).includes('"expected"'), false);
for (const secretField of ['ownerId', 'packetId', 'snapshotId', 'productId', 'formulaVersionId']) {
  assert.equal(JSON.stringify(jev.body).includes(secretField), false, secretField);
}
assert.match(jev.promptSha256, /^[a-f0-9]{64}$/);
assert.match(jev.adapterSha256, /^[a-f0-9]{64}$/);

const gemini = buildProviderRequest('gemini_structured', 'gemini-2.5-flash', first);
assert.equal(gemini.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
assert.equal((gemini.body.generationConfig as { responseFormat: { text: { mimeType: string } } }).responseFormat.text.mimeType, 'APPLICATION_JSON');
assert.equal(JSON.stringify(gemini.body).includes('"expected"'), false);
assert.equal(JSON.stringify(gemini.body).includes('ownerId'), false);

const correct = { routineContribution: 'incremental', overlap: 'none', needsMoreContext: false, abstain: false };
const jevResponse = { model: 'jev-1.13.0', answers: {
  contribution: { type: 'choice', choice: 'incremental', probabilities: { incremental: 0.8, redundant: 0.1, replacement_candidate: 0.05, unclear: 0.05 } },
  overlap: { type: 'choice', choice: 'none', probabilities: { none: 0.8, partial: 0.1, strong: 0.05, unknown: 0.05 } },
  needs_context: { type: 'noul', noul: 0.1 },
}, usage: { input_tokens: 100, output_tokens: 20 } };
const jevDecoded = decodeProviderResponse('jev', 'jev-1.13.0', jevResponse);
assert.deepEqual(jevDecoded.output, correct);
assert.equal(jevDecoded.inputTokens, 100);
assert.deepEqual(jevDecoded.probabilities, jevResponse.answers.contribution.probabilities);
assert.equal(jevDecoded.costUsd, null);
assert.throws(() => decodeProviderResponse('jev', 'jev-1.13.0', { ...jevResponse, model: 'jev-latest' }), /MODEL_MISMATCH/);
assert.throws(() => decodeProviderResponse('jev', 'jev-1.13.0', { ...jevResponse, answers: {
  ...jevResponse.answers, contribution: { ...jevResponse.answers.contribution,
    probabilities: { incremental: 0.1, redundant: 0.8, replacement_candidate: 0.05, unclear: 0.05 } },
} }), /PROVIDER_RESPONSE_INVALID/);

const geminiResponse = { modelVersion: 'gemini-2.5-flash', candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(correct) }] } }],
  usageMetadata: { promptTokenCount: 110, candidatesTokenCount: 30, thoughtsTokenCount: 5 } };
const geminiDecoded = decodeProviderResponse('gemini_structured', 'gemini-2.5-flash', geminiResponse);
assert.deepEqual(geminiDecoded.output, correct);
assert.equal(geminiDecoded.inputTokens, 110);
assert.equal(geminiDecoded.outputTokens, 35);
assert.equal(geminiDecoded.probabilities, undefined);
assert.throws(() => decodeProviderResponse('gemini_structured', 'gemini-2.5-flash', { ...geminiResponse, candidates: [] }), /PROVIDER_RESPONSE_INVALID/);
assert.throws(() => decodeProviderResponse('gemini_structured', 'gemini-2.5-flash', { ...geminiResponse, candidates: [{ ...geminiResponse.candidates[0], content: { parts: [{ text: '{"action":"USE"}' }] } }] }), /SCHEMA_INVALID/);

let calls = 0;
await assert.rejects(() => runProviderEvaluation({ provider: 'jev', modelVersion: 'jev-1.13.0', runs: 2, pin: { ...pin, corpusSha256: '0'.repeat(64) },
  invoke: async () => { calls++; return jevResponse; } }), /RUN_CORPUS_MISMATCH/);
assert.equal(calls, 0);
const runs = await runProviderEvaluation({ provider: 'jev', modelVersion: 'jev-1.13.0', runs: 2, pin,
  invoke: async () => { calls++; return jevResponse; } });
assert.equal(calls, CORPUS.length * 2);
assert.equal(runs.length, 2);
assert.equal(runs[0].corpusSha256, pin.corpusSha256);
assert.equal(runs[0].attempts.length, CORPUS.length);
assert.equal(runs[0].attempts[0].costUsd, null);
const scored = replayRecordedRuns(runs)[0];
assert.equal(scored.runCount, 2);
assert.equal(scored.costUsdPerCase, null);
assert.equal(scored.inputTokens, CORPUS.length * 2 * 100);
assert(scored.caseAnalysis.some(row => row.caseId === 'known-role-redundancy' && row.outcome === 'disagreement'));
const overlapOnly = replayRecordedRuns([{ ...runs[0], attempts: CORPUS.map(c => ({
  caseId: c.id, output: c.id === first.id ? { ...c.expected, overlap: 'partial' } : c.expected,
  latencyMs: 1, costUsd: null, inputTokens: null, outputTokens: null,
})) }])[0];
assert.equal(overlapOnly.exactLabelAccuracy, 1, 'contribution accuracy remains narrow');
assert.deepEqual(overlapOnly.disagreementCaseIds, [first.id]);
assert.deepEqual(overlapOnly.caseAnalysis.find(row => row.caseId === first.id)?.mismatchedFields, ['overlap']);
assert.equal(overlapOnly.caseAnalysis.find(row => row.caseId === first.id)?.outcome, 'disagreement');

const failed = await runProviderEvaluation({ provider: 'gemini_structured', modelVersion: 'gemini-2.5-flash', runs: 1, pin,
  invoke: async () => { throw new Error('private upstream details'); } });
assert(failed[0].attempts.every(a => a.failure === 'provider_error' && a.output === undefined));
assert.equal(JSON.stringify(failed).includes('private upstream details'), false);
assert.equal(replayRecordedRuns(failed)[0].providerFailures, CORPUS.length);
const malformed = await runProviderEvaluation({ provider: 'gemini_structured', modelVersion: 'gemini-2.5-flash', runs: 1, pin,
  invoke: async () => ({ ...geminiResponse, candidates: [] }) });
assert(malformed[0].attempts.every(a => a.failure === 'schema_invalid'));
assert.equal(replayRecordedRuns(malformed)[0].schemaValidity, 0);
console.log('Decision intelligence provider adapter and offline runner passed');
