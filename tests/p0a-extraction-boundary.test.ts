import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EXTRACTION_LIMITS, ProductEvidenceExtractionError, parseProductEvidenceExtraction, projectProductEvidenceExtraction,
} from '../supabase/functions/_shared/product-evidence-extraction.ts';
import type { ProductEvidenceExtractionCandidate } from '../src/contracts/ProductEvidenceExtraction.ts';
import { evaluateExtraction, parseExtractionCandidate } from '../src/fixtures/product-truth-evaluation/evaluator.ts';
import { extractionCorpus, syntheticCatalog } from '../src/fixtures/product-truth-evaluation/corpus.ts';
import { resolveProductIdentity } from '../supabase/functions/_shared/product-identity.ts';

const binding = { evidenceId: 'opaque-test', role: 'ingredients' as const };
const candidate = (): ProductEvidenceExtractionCandidate => ({ schemaVersion: 1, ...binding, outcome: 'candidate',
  labelText: 'Synthetic label\nObserved literally', orderedIngredients: ['Water', ' Glycerin ', 'Water'],
  numbers: [{ text: '0.10', unitText: '% w/w', contextText: 'Synthetic active' }] });
const reject = (value: unknown) => assert.throws(() => parseProductEvidenceExtraction(value, binding), ProductEvidenceExtractionError);

test('copies literal ordered occurrences and numbers without normalization or aliasing', () => {
  const input = candidate();
  const parsed = parseProductEvidenceExtraction(input, binding);
  assert.deepEqual(parsed, input);
  assert.notEqual(parsed, input);
  assert.notEqual(parsed.orderedIngredients, input.orderedIngredients);
  assert.notEqual(parsed.numbers![0], input.numbers![0]);
  input.orderedIngredients![0] = 'Changed';
  input.numbers![0].text = '99';
  assert.deepEqual(parsed.orderedIngredients, ['Water', ' Glycerin ', 'Water']);
  assert.equal(parsed.numbers![0].text, '0.10');
});

test('requires exact external ID and role; never coerces identity or enum values', () => {
  reject({ ...candidate(), evidenceId: 'another' });
  reject({ ...candidate(), role: 'front_label' });
  reject({ ...candidate(), role: { toString: () => 'ingredients' } });
  reject({ ...candidate(), schemaVersion: '1' });
  assert.throws(() => parseProductEvidenceExtraction(candidate(), { ...binding, evidenceId: 'private/path' }));
  assert.throws(() => projectProductEvidenceExtraction(candidate(), { ...binding, role: 'packaging' }));
});

test('rejects extra authority, provider errors, paths and hidden/symbol properties', () => {
  for (const extra of [{ verified: true }, { confidence: 1 }, { formulaVersionId: 'guessed' },
    { storagePath: 'private/object' }, { signedUrl: 'https://private.example/token' },
    { error: { message: 'private provider error' } }]) reject({ ...candidate(), ...extra });
  reject(new Error('private provider error'));
  reject(Object.defineProperty(candidate(), 'hidden', { value: 'private' }));
  reject({ ...candidate(), [Symbol('private')]: true });
  for (const labelText of ['file:///private/photo.jpg', 'ph://private', 'https://private.example/?token=x',
    '/Users/private/photo.jpg', '12345678-1234-1234-1234-123456789012/free_scan/ingredients/private.jpg']) reject({ ...candidate(), labelText });
});

test('rejects inherited payloads and accessors without evaluating getters', () => {
  reject(Object.create(candidate()));
  let read = false;
  const accessor = Object.defineProperty(candidate(), 'labelText', { enumerable: true, get() { read = true; return 'private'; } });
  reject(accessor);
  assert.equal(read, false);
  reject({ ...candidate(), numbers: [Object.create({ text: '1', unitText: '%', contextText: 'active' })] });
  assert.deepEqual(parseProductEvidenceExtraction(Object.assign(Object.create(null), candidate()), binding), candidate());
});

test('rejects empty, sparse, extended or malformed arrays and numeric number guesses', () => {
  const extended = Object.assign(['Water'], { authority: true });
  for (const orderedIngredients of [[], new Array(2), extended, [null], ['   ']]) reject({ ...candidate(), orderedIngredients });
  for (const numbers of [[], [{ text: 1, unitText: '%', contextText: 'active' }],
    [{ text: '1', unitText: '%' }], [{ text: '1', unitText: '%', contextText: 'active', inferred: true }]]) reject({ ...candidate(), numbers });
});

test('bounds fields, occurrences, literal numbers and total text independently', () => {
  reject({ ...candidate(), labelText: 'x'.repeat(EXTRACTION_LIMITS.fieldText + 1) });
  reject({ ...candidate(), orderedIngredients: ['x'.repeat(EXTRACTION_LIMITS.ingredientText + 1)] });
  reject({ ...candidate(), orderedIngredients: Array(EXTRACTION_LIMITS.ingredients + 1).fill('Water') });
  reject({ ...candidate(), numbers: Array(EXTRACTION_LIMITS.numbers + 1).fill({ text: '1', unitText: '%', contextText: 'active' }) });
  reject({ ...candidate(), numbers: [{ text: 'x'.repeat(EXTRACTION_LIMITS.numberText + 1), unitText: '%', contextText: 'active' }] });
  reject({ ...candidate(), orderedIngredients: Array(60).fill('x'.repeat(300)) });
  const atLimit = { schemaVersion: 1, ...binding, outcome: 'candidate', labelText: 'x'.repeat(EXTRACTION_LIMITS.fieldText) };
  assert.equal(parseProductEvidenceExtraction(atLimit, binding).labelText?.length, EXTRACTION_LIMITS.fieldText);
});

test('explicit abstention contains a known reason and no observations or guesses', () => {
  for (const abstentionReason of ['unreadable', 'unsupported', 'conflicting_evidence', 'no_product_evidence']) {
    const input = { schemaVersion: 1, ...binding, outcome: 'abstained', abstentionReason };
    assert.deepEqual(projectProductEvidenceExtraction(input, binding), {});
    reject({ ...input, labelText: 'guess' });
    reject({ ...input, numbers: undefined });
  }
  reject({ schemaVersion: 1, ...binding, outcome: 'abstained', abstentionReason: 'provider private error' });
  reject({ schemaVersion: 1, ...binding, outcome: 'candidate' });
});

test('errors remain stable even when a hostile proxy throws private provider context', () => {
  const malicious = new Proxy({}, { ownKeys() { throw new Error('private://provider-secret'); } });
  assert.throws(() => parseProductEvidenceExtraction(malicious, binding), (error: unknown) => {
    assert.ok(error instanceof ProductEvidenceExtractionError);
    assert.equal(error.code, 'INVALID_EXTRACTION_OUTPUT');
    assert.equal(error.message, 'Product evidence extraction could not be confirmed');
    assert.doesNotMatch(String(error), /secret|private:/);
    return true;
  });
});

test('revalidated projection cannot promote extracted barcode/identity/numbers or mutate inputs', () => {
  const input = { ...candidate(), barcodeText: '000000000024', brandText: 'Synthetic Aster', productNameText: 'Clear Serum' };
  const before = structuredClone(input);
  const projected = projectProductEvidenceExtraction(input, binding);
  assert.deepEqual(Object.keys(projected).sort(), ['ingredientList', 'labelText']);
  assert.notEqual(resolveProductIdentity(projected, syntheticCatalog).state, 'verified_product_formula');
  projected.ingredientList![0] = 'mutated';
  assert.deepEqual(input, before);
  assert.throws(() => projectProductEvidenceExtraction({ ...input, verified: true }, binding));
});

test('evaluator reuses shared binding and preserves two-argument corpus wrapper API', () => {
  const outputs = Object.fromEntries(extractionCorpus.map(fixture => [fixture.id, fixture.gold]));
  assert.equal(evaluateExtraction(outputs).passed, 15);
  for (const fixture of extractionCorpus) assert.deepEqual(parseExtractionCandidate(fixture.gold, fixture.id), fixture.gold);
  outputs['ingredients-old'] = { ...outputs['ingredients-old'], role: 'front_label' };
  const report = evaluateExtraction(outputs);
  assert.equal(report.failed, 1);
  assert.equal(report.rows.find(row => row.id === 'ingredients-old')?.errors[0], 'Product evidence extraction could not be confirmed');
  const hostile = Object.defineProperty({}, 'front-label', { get() { throw new Error('private provider token'); } });
  assert.doesNotMatch(JSON.stringify(evaluateExtraction(hostile)), /private provider token/);
});
