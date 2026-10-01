import test from 'node:test';
import assert from 'node:assert/strict';
import { CASES, corpusSha256, projectCase } from '../benchmarks/ingredient-guidance/corpus.ts';
import { runLocalBaseline, runSyntheticGemini, summarizeAttempts } from '../benchmarks/ingredient-guidance/run.ts';
test('synthetic corpus is finite, fingerprinted, and model input excludes expected labels and owner', () => {
  assert.equal(CASES.length, 12); assert.equal(new Set(CASES.map(c => c.id)).size, 12);
  assert.match(corpusSha256(), /^[a-f0-9]{64}$/);
  for (const c of CASES) {
    assert.deepEqual(Object.keys(projectCase(c)).sort(), ['category', 'context', 'ingredientsText', 'productName']);
    if (c.input.category === 'other_personal_care') assert.equal(projectCase(c).context.skinBehavior, 'unanswered');
  }
});
test('baseline exposes actual prose and timing without claiming measured model utility', () => {
  const rows = runLocalBaseline(); assert.equal(rows.length, 12);
  assert.equal(summarizeAttempts(rows).usableAnswers, 12);
  assert.equal(summarizeAttempts(rows).usefulnessMeasured, false);
  assert.match(rows.find(r => r.caseId === 'dry-humectant')!.sentences.join(' '), /reported dryness/);
  assert.doesNotMatch(rows.find(r => r.caseId === 'dry-facial-context-deodorant')!.sentences.join(' '), /reported dryness/);
  for (const c of CASES) {
    const sentences = rows.find(row => row.caseId === c.id)!.sentences;
    // Match the current template's actual selected notes, not an LLM evaluator.
    // These expectations test narrow policy concordance, NOT clinical accuracy.
    assert.deepEqual({
      moisture: sentences.some(s => s.includes('commonly used in moisturizing formulas')),
      fragranceCaution: sentences.some(s => s.includes('reason to be cautious')),
      dryingAlcoholCaution: sentences.some(s => s.includes('alcohol denat. is worth noting')),
    }, c.expected, c.id);
  }
});
test('live runner is injected, sends only synthetic inputs, and stops two consecutive failures without retries', async () => {
  let requests = 0;
  const mock: typeof fetch = async (_url, init) => {
    requests++;
    const body = JSON.parse(String(init?.body));
    const input = JSON.parse(body.contents[0].parts[0].text);
    assert.equal(input.productName, 'Synthetic cosmetic test product');
    assert.equal('expected' in input, false); assert.equal('ownerId' in input, false);
    assert.equal('tools' in body, false);
    return new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } });
  };
  const rows = await runSyntheticGemini('synthetic-test-key', 'gemini-3.8-flash', mock);
  assert.equal(requests, 2); assert.equal(rows.length, 2);
  assert.equal(summarizeAttempts(rows).failures, 2);
});
test('successful usage includes thought tokens while oversized responses remain bounded', async () => {
  const success: typeof fetch = async () => new Response(JSON.stringify({
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({
      sentences: ['The ingredient list alone cannot predict individual tolerance.'],
    }) }] } }],
    usageMetadata: { promptTokenCount: 11, candidatesTokenCount: 7, thoughtsTokenCount: 3 },
  }), { headers: { 'Content-Type': 'application/json' } });
  const rows = await runSyntheticGemini('synthetic-key', 'gemini-3.8-flash', success);
  assert.equal(rows.length, 12);
  assert.ok(rows.every(row => row.status === 'answer' && row.inputTokens === 11 && row.outputTokens === 10));
  let calls = 0;
  const oversized: typeof fetch = async () => {
    calls++;
    return new Response('x'.repeat(65_537), { headers: { 'Content-Type': 'application/json' } });
  };
  const failed = await runSyntheticGemini('synthetic-key', 'gemini-3.8-flash', oversized);
  assert.equal(calls, 2); assert.ok(failed.every(row => row.status === 'unavailable'));
  assert.ok(failed.every(row => row.inputTokens === null && row.outputTokens === null));
});
