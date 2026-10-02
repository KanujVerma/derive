import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ReactionResearchStore, REACTION_RESEARCH_TTL, type ReactionResearchStorage } from '../src/presentation/personal-decision/reactionResearchStore.ts';
import type { WebProductIngredientLookup } from '../src/contracts/WebProductIngredients.ts';
import { buildSourceLimitedAnalysis } from '../src/presentation/personal-decision/sourceLimitedAnalysis.ts';
import type { PersonalContextSnapshot } from '../src/contracts/PersonalContext.ts';
import { componentHarness, control, press, textContent } from './ux-profile-render.ts';
const product = { key: 'aveeno stress relief body lotion lavender scent', name: 'Aveeno Stress Relief Body Lotion Lavender Scent', brand: 'Aveeno' };
const evidence = { productName: product.name, ingredientsText: 'Water, Glycerin, Fragrance, Propylene Glycol', sourceUrl: 'https://www.aveeno.com/products/stress-relief-body-lotion-lavender-scent',
  sourceName: 'Aveeno', retrievedAt: '2026-10-01T00:00:00.000Z', basis: 'published_web' as const, formulaVerified: false as const };
const found: WebProductIngredientLookup = { status: 'found', evidence };
const owner = 'owner-a';
const noPause = async () => {};
function storage() {
  const values = new Map<string, string>();
  const api: ReactionResearchStorage = { getItem: async key => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); }, removeItem: async key => { values.delete(key); } };
  return { values, api };
}
test('named saved report research is attributed and reusable across device restart', async () => {
  const memory = storage(); let calls = 0;
  const store = new ReactionResearchStore(memory.api, async name => { calls++; assert.deepEqual(name, product); return found; }, noPause);
  store.setOwner(owner);
  assert.equal((await store.research(owner, product))?.status, 'found');
  assert.equal((await store.research(owner, product))?.status, 'found');
  assert.equal(calls, 1);
  assert.equal(memory.values.size, 1);
  assert.doesNotMatch([...memory.values.values()][0], /symptoms|personalScore|sensitivities|reactivity/);
  const restarted = new ReactionResearchStore(memory.api, async () => { throw Error('cache should avoid I/O'); }, noPause);
  restarted.setOwner(owner);
  assert.equal((await restarted.research(owner, product))?.evidence?.sourceUrl, evidence.sourceUrl);
});
test('concurrent report and scan comparison requests deduplicate', async () => {
  const memory = storage(); let calls = 0;
  const store = new ReactionResearchStore(memory.api, async () => { calls++; return found; }, noPause);
  store.setOwner(owner);
  const results = await Promise.all([store.research(owner, product), store.research(owner, product)]);
  assert.equal(calls, 1); assert.deepEqual(results[0], results[1]);
});
test('different product variants never share cached ingredient facts', async () => {
  const memory = storage(); let calls = 0;
  const store = new ReactionResearchStore(memory.api, async () => { calls++; return found; }, noPause);
  store.setOwner(owner); await store.research(owner, product);
  await store.research(owner, { ...product, key: product.key + ' unscented', name: product.name + ' Unscented' });
  assert.equal(calls, 2);
});
test('stale ingredient facts are researched again without persisting personal verdicts', async () => {
  const memory = storage(); let time = Date.parse(evidence.retrievedAt), calls = 0;
  const store = new ReactionResearchStore(memory.api, async () => { calls++; return found; }, noPause, () => time);
  store.setOwner(owner); await store.research(owner, product); time += REACTION_RESEARCH_TTL;
  assert.equal(store.record(owner, product), null);
  await store.research(owner, product); assert.equal(calls, 2);
});
test('unresolved name and provider failures stay distinct, retryable and not persisted', async () => {
  const memory = storage(); let calls = 0;
  const store = new ReactionResearchStore(memory.api, async () => { calls++; return { status: 'rate_limited' }; }, noPause);
  store.setOwner(owner);
  assert.equal((await store.research(owner, { key: 'old spice', name: 'Old Spice', brand: 'Old Spice' }))?.status, 'ambiguous');
  assert.equal(calls, 0);
  assert.equal((await store.research(owner, product))?.status, 'rate_limited');
  await store.research(owner, product); assert.equal(calls, 1);
  await store.research(owner, product, true); assert.equal(calls, 2);
  assert.equal(memory.values.size, 0);
});
test('sign-out and owner changes fence old replies and remove associated cache', async () => {
  const memory = storage(); let finish!: (value: WebProductIngredientLookup) => void;
  const store = new ReactionResearchStore(memory.api, () => new Promise(resolve => { finish = resolve; }), noPause);
  store.setOwner(owner); const work = store.research(owner, product);
  await new Promise(resolve => setImmediate(resolve));
  store.setOwner('owner-b'); finish(found);
  assert.equal(await work, null); assert.equal(store.record(owner, product), null);
  assert.equal(store.record('owner-b', product), null); assert.equal(memory.values.size, 0);
});

test('a partial name is researched automatically and a real product choice survives restart under the original report', async () => {
  const memory = storage(), remembered = { key: 'old spice aqua reef', name: 'Old Spice Aqua Reef', brand: 'Old Spice' };
  const candidate = { name: 'Old Spice Aqua Reef Deodorant', brand: 'Old Spice' };
  const other = { name: 'Old Spice Aqua Reef Body Wash', brand: 'Old Spice' };
  const names: string[] = [];
  const store = new ReactionResearchStore(memory.api, async p => {
    names.push(p.name);
    return p.name === remembered.name ? { status: 'ambiguous', candidates: [candidate, other] }
      : { status: 'found', evidence: { ...evidence, productName: candidate.name } };
  }, noPause);
  store.setOwner(owner);
  assert.equal((await store.research(owner, remembered))?.candidates?.length, 2);
  assert.equal(await store.choose(owner, remembered, { name: 'Unrelated Deodorant', brand: 'Other' }), null);
  const selected = await store.choose(owner, remembered, candidate);
  assert.equal(selected?.product.name, remembered.name);
  assert.equal(selected?.evidence?.productName, candidate.name);
  assert.deepEqual(names, [remembered.name, candidate.name]);
  const restarted = new ReactionResearchStore(memory.api, async () => { throw Error('Cached selection should not search again'); }, noPause);
  restarted.setOwner(owner);
  assert.equal((await restarted.research(owner, remembered))?.evidence?.productName, candidate.name);
  assert.equal(restarted.record('another-owner', remembered), null);
});

test('the existing reaction panel resolves a real choice inline without rewriting the report or leaking another owner', async () => {
  const remembered = { key: 'old spice aqua reef', name: 'Old Spice Aqua Reef', brand: 'Old Spice' };
  const candidate = { name: 'Old Spice Aqua Reef Deodorant', brand: 'Old Spice' };
  let activeOwner = owner;
  const store = new ReactionResearchStore(storage().api, async p => p.name === remembered.name
    ? { status: 'ambiguous', candidates: [candidate, { name: 'Old Spice Aqua Reef Body Wash', brand: 'Old Spice' }] }
    : { status: 'found', evidence: { ...evidence, productName: candidate.name } }, noPause);
  store.setOwner(owner); await store.research(owner, remembered);
  const panel = componentHarness('src/components/p0b-personalization/ReactionProductResearch.tsx', 'ReactionProductResearch',
    { ownerId: owner, name: remembered.name }, { modules: {
      '@/src/services/reactionIngredientResearch': { reactionResearch: store },
      '@/src/presentation/personal-decision/customerGateway': { currentCustomerOwner: () => activeOwner },
    } });
  assert.match(textContent(panel.render()), /Which product did you use/);
  assert.doesNotMatch(textContent(panel.render()), /Include the brand, product type/);
  press(control(panel.render(), candidate.name));
  await new Promise(resolve => setImmediate(resolve));
  assert.match(textContent(panel.render()), /Published list for.*Aqua Reef Deodorant/);
  press(control(panel.render(), 'Show ingredient list'));
  assert.match(textContent(panel.render()), /Water, Glycerin, Fragrance, Propylene Glycol/);
  assert.equal(store.record(owner, remembered)?.product.name, remembered.name);
  activeOwner = 'other-owner'; assert.equal(panel.render().length, 0);
});
test('a product choice cannot resume after signing out and back into the same owner', async () => {
  const remembered = { key: 'old spice aqua reef', name: 'Old Spice Aqua Reef', brand: 'Old Spice' };
  const candidate = { name: 'Old Spice Aqua Reef Deodorant', brand: 'Old Spice' };
  let calls = 0;
  const store = new ReactionResearchStore(storage().api, async () => {
    calls++; return { status: 'ambiguous', candidates: [candidate] };
  }, noPause);
  store.setOwner(owner); await store.research(owner, remembered);
  const choice = store.choose(owner, remembered, candidate);
  store.setOwner(null); store.setOwner(owner);
  assert.equal(await choice, null);
  assert.equal(calls, 1);
  assert.equal(store.record(owner, remembered), null);
});
test('in-flight disk writes cannot resurrect a cache after account deletion or sign-out', async () => {
  const memory = storage(); let written!: () => void;
  const delayed: ReactionResearchStorage = { ...memory.api, setItem: async (key, value) => {
    await new Promise<void>(resolve => { written = resolve; }); await memory.api.setItem(key, value);
  } };
  const store = new ReactionResearchStore(delayed, async () => found, noPause);
  store.setOwner(owner); const work = store.research(owner, product);
  await new Promise(resolve => setImmediate(resolve));
  store.setOwner(null); written(); await work;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(memory.values.size, 0);
});
test('invalid local cache evidence and future timestamps are rejected', async () => {
  const memory = storage(); let calls = 0;
  memory.values.set('derive:private-reaction-research:v1:' + owner, JSON.stringify({ version: 'reaction-research-v1', owner,
    entries: [{ record: { product, status: 'found', evidence: { ...evidence, formulaVerified: true } }, checkedAt: Date.now() },
      { record: { product, status: 'found', evidence }, checkedAt: Date.now() + 999999 }] }));
  const store = new ReactionResearchStore(memory.api, async () => { calls++; return found; }, noPause);
  store.setOwner(owner); await store.research(owner, product); assert.equal(calls, 1);
});
test('storage failure does not prevent live evidence or saving the original report', async () => {
  const broken: ReactionResearchStorage = { getItem: async () => { throw Error('storage'); }, setItem: async () => { throw Error('storage'); }, removeItem: async () => { throw Error('storage'); } };
  const store = new ReactionResearchStore(broken, async () => found, noPause);
  store.setOwner(owner); assert.equal((await store.research(owner, product))?.status, 'found');
});
test('researched preservative overlap changes the existing verdict without diagnosing an allergy', () => {
  const context: PersonalContextSnapshot = { version: 'personal-context-v1', ownerId: owner, revision: 1, profile: null, routine: null,
    experiences: [], historyTruncated: false, historyRevision: null,
    legacy: { source: 'legacy_free_context', profile: null, products: [], truncated: false,
      experiences: [{ kind: 'reacted', product_name: product.name }] } };
  const current = { barcode: '0381370015314', name: 'Aveeno Daily Moisturizing Body Lotion', brand: 'Aveeno', size: null };
  const oldProduct = { ...product };
  const result = buildSourceLimitedAnalysis({ ownerId: owner, context, query: current,
    lists: [{ ingredientsText: 'Water, Methylisothiazolinone' }], reactionIngredients: [{ product: oldProduct, status: 'found', evidence: { ...evidence, ingredientsText: 'Water, Methylisothiazolinone' } }] })!;
  assert.equal(result.verdict.state, 'tradeoffs'); assert.match(result.verdict.reason, /Methylisothiazolinone/);
  assert.match(result.verdict.reason, /consider an option/i);
  assert.match(result.verdict.reason, /does not identify what caused/);
  assert.equal(result.formulaVerified, false);
  assert.ok(result.verdict.findings.some(f => f.evidence.some(e => e.detail.includes('fda.gov'))));
});
test('report research is integrated in setup, history and existing Check with no new analytics pipeline', () => {
  const file = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  assert.match(file('app/_layout.tsx'), /bindReactionResearchLifecycle/);
  assert.match(file('src/services/reactionIngredientResearch.ts'), /state\.status !== 'ready'/);
  assert.match(file('src/components/p0b-personalization/ContextFlow.tsx'), /ReactionProductResearch ownerId={ownerId}/);
  assert.match(file('app/personalize/index.tsx'), /item\.data\.kind === 'reacted'/);
  assert.match(file('src/components/check/useReactionIngredientComparison.ts'), /reactionResearch\.record/);
  const runtime = file('src/services/reactionIngredientResearch.ts');
  assert.doesNotMatch(runtime, /\.symptoms|\.note|analytics|posthog|GEMINI_API_KEY|SERPAPI_API_KEY/);
});
