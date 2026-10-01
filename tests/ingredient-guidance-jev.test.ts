import test from 'node:test';
import assert from 'node:assert/strict';
import { CASES, projectCase } from '../benchmarks/ingredient-guidance/corpus.ts';
import { decodeJevGuidance, runSyntheticJev, JEV_MODEL, JEV_THRESHOLD, jevPromptSha256 } from '../benchmarks/ingredient-guidance/jev.ts';

const fields = ['moisture', 'fragranceCaution', 'dryingAlcoholCaution'] as const;
const rawFor = (values = CASES[0].expected) => ({ model: JEV_MODEL,
  answers: Object.fromEntries(fields.map(field => [field, { type: 'noul', noul: values[field] ? .98 : .03 }])),
  usage: { input_tokens: 875, output_tokens: 66 } });
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

test('strict finite three-noul decoder retains successful raw evidence and predeclared threshold', () => {
  const raw = rawFor();
  const decoded = decodeJevGuidance(raw);
  assert.deepEqual(decoded.raw, raw); assert.deepEqual(decoded.chosenFindings, CASES[0].expected);
  assert.equal(JEV_THRESHOLD, .5); assert.match(jevPromptSha256(), /^[a-f0-9]{64}$/);
  const edge = rawFor(); edge.answers.moisture.noul = .5;
  assert.equal(decodeJevGuidance(edge).chosenFindings.moisture, true);
  for (const value of [NaN, Infinity, -.1, 1.1, '0.8', undefined]) {
    const invalid = rawFor(); invalid.answers.moisture.noul = value as number;
    assert.throws(() => decodeJevGuidance(invalid), /INVALID_JEV_GUIDANCE/);
  }
  for (const invalid of [{ ...raw, model: 'jev-latest' }, { ...raw, answers: {} },
    { ...raw, answers: { ...raw.answers, arbitrary: { type: 'noul', noul: .5 } } },
    { ...raw, answers: { ...raw.answers, moisture: { type: 'score', score: 80 } } },
    { ...raw, usage: { input_tokens: -1, output_tokens: 0 } },
    { ...raw, usage: { input_tokens: 1.5, output_tokens: 0 } }]) assert.throws(() => decodeJevGuidance(invalid));
  assert.equal('providerError' in decodeJevGuidance({ ...raw, providerError: 'must not survive' }).raw, false);
});

test('same twelve synthetic cases are projected without labels, owner, history, or identifier leakage', async () => {
  let calls = 0;
  const transport: typeof fetch = async (url, init) => {
    const current = CASES[calls++];
    assert.equal(url, 'https://api.typesafe.ai/v1/systemone'); assert.equal(init?.method, 'POST');
    assert.equal(init?.redirect, 'error'); assert.equal(init?.credentials, 'omit'); assert.ok(init?.signal);
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(Object.keys(body).sort(), ['model', 'questions', 'state']); assert.equal(body.model, JEV_MODEL);
    assert.deepEqual(body.state, projectCase(current));
    assert.equal('id' in body.state, false); assert.equal('expected' in body.state, false);
    assert.equal('ownerId' in body.state, false); assert.equal('history' in body.state, false);
    assert.deepEqual(Object.keys(body.questions).sort(), [...fields].sort());
    assert.equal(Object.values(body.questions).every((q: unknown) => (q as { type: string }).type === 'noul'), true);
    return json(rawFor(current.expected));
  };
  const report = await runSyntheticJev('synthetic-private-key', transport);
  assert.equal(calls, 12); assert.equal(report.attempts.length, 12); assert.equal(report.summary.usableDecisions, 12);
  assert.equal(report.summary.policyConcordantCases, 12); assert.equal(report.summary.inputTokens, 10500);
  assert.equal(report.summary.outputTokens, 792); assert.equal(report.summary.actualBilledUsd, null);
  assert.equal(report.summary.clinicalAccuracyMeasured, false); assert.equal(report.summary.stabilityMeasured, false);
  assert.ok(report.conservativeEstimatedSpendUsd < .50); assert.match(report.warning, /not clinical accuracy/);
  assert.equal(JSON.stringify(report).includes('synthetic-private-key'), false);
});

test('schema-invalid successful responses are sanitized and do not become guidance', async () => {
  const report = await runSyntheticJev('synthetic-key', async () => json({ ...rawFor(), answers: { broken: 'sensitive error' } }));
  assert.equal(report.attempts.length, 12); assert.equal(report.summary.usableDecisions, 0);
  assert.equal(report.summary.inputTokens, null);
  assert.ok(report.attempts.every(row => row.status === 'schema_invalid' && row.raw === null && row.chosenFindings === null));
  assert.equal(JSON.stringify(report).includes('sensitive error'), false);
});

test('two consecutive operational failures stop without retries or retaining raw provider errors', async () => {
  for (const http of [401, 429, 503, 529]) {
    let calls = 0;
    const report = await runSyntheticJev('synthetic-key', async () => { calls++; return json({ error: 'sensitive provider payload' }, http); });
    assert.equal(calls, 2); assert.equal(report.attempts.length, 2);
    assert.ok(report.attempts.every(row => row.raw === null && row.chosenFindings === null && row.httpStatus === http));
    assert.equal(JSON.stringify(report).includes('sensitive provider payload'), false);
  }
});

test('a successful or schema-invalid attempt resets consecutive operational failures', async () => {
  let calls = 0;
  const report = await runSyntheticJev('synthetic-key', async () => {
    calls++; return calls % 2 ? json({}, 503) : json({});
  });
  assert.equal(calls, 12); assert.equal(report.attempts.length, 12);
});

test('oversized and invalid content is bounded while invalid keys never reach transport', async () => {
  const never: typeof fetch = async () => { throw Error('must not call'); };
  for (const key of ['', 'secret\n', 'a'.repeat(513)]) await assert.rejects(runSyntheticJev(key, never), /JEV_API_KEY/);
  for (const transport of [
    async () => new Response('x'.repeat(65_537), { headers: { 'Content-Type': 'application/json' } }),
    async () => new Response('{}', { headers: { 'Content-Type': 'application/json', 'Content-Length': '65537' } }),
    async () => new Response('{}', { headers: { 'Content-Type': 'text/html' } }),
    async () => { throw Error('secret-in-error'); },
  ]) {
    const report = await runSyntheticJev('synthetic-key', transport);
    assert.equal(report.attempts.length, 2); assert.ok(report.attempts.every(row => row.status === 'unavailable' && row.raw === null));
    assert.equal(JSON.stringify(report).includes('secret-in-error'), false);
  }
});

test('timeout bounds an uncooperative transport and stops after two aborted calls', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const signals: AbortSignal[] = [];
  const pending = runSyntheticJev('synthetic-key', async (_url, init) => {
    signals.push(init!.signal!); return await new Promise<Response>(() => {});
  });
  assert.equal(signals.length, 1);
  t.mock.timers.tick(12000);
  // Drain the completed race and sequential loop before advancing the next deadline.
  for (let step = 0; step < 12; step++) await Promise.resolve();
  assert.equal(signals.length, 2); assert.equal(signals[0].aborted, true);
  t.mock.timers.tick(12000);
  const report = await pending;
  assert.equal(signals[1].aborted, true); assert.equal(report.attempts.length, 2);
  assert.ok(report.attempts.every(row => row.status === 'unavailable' && row.raw === null));
});
