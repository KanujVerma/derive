import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPrivateIngredientContext, type PrivateIngredientContextAdmin }
  from '../supabase/functions/_shared/private-ingredient-context.ts';

const owner = 'e7000000-0000-4000-8000-000000000001';
const timestamp = '2026-09-30T12:00:00.000Z';
const payload = { primaryGoal: 'dryness', secondaryGoals: ['maintain'], skinBehavior: 'dry_tight',
  reactivity: 'reacts_easily', reproductive: { pregnancy: 'yes' },
  sensitivities: { values: ['private allergy'] }, treatments: { values: ['other_prescription'] },
  note: 'private free text', ownerId: owner, photo: 'private photo' };

function fixture(results: { data: unknown; error: unknown }[], thrown?: Error) {
  const calls: unknown[][] = [];
  const query = {
    eq: (column: string, value: string) => { calls.push(['eq', column, value]); return query; },
    order: (column: string, options: { ascending: boolean }) => { calls.push(['order', column, options]); return query; },
    limit: (count: number) => { calls.push(['limit', count]); return query; },
    maybeSingle: async () => { calls.push(['maybeSingle']); if (thrown) throw thrown; return results.shift()!; },
  };
  const admin: PrivateIngredientContextAdmin = {
    from: table => { calls.push(['from', table]); return {
      select: columns => { calls.push(['select', columns]); return query; },
    }; },
  };
  return { admin, calls };
}

test('private ingredient context selects latest exact-owner modern profile and returns only cosmetic projection', async () => {
  const f = fixture([{ data: { revision: 7, payload }, error: null }]);
  const result = await loadPrivateIngredientContext(f.admin, owner);
  assert.deepEqual(f.calls, [
    ['from', 'personal_context_revisions'], ['select', 'revision,payload'],
    ['eq', 'user_id', owner], ['eq', 'section', 'profile'],
    ['order', 'revision', { ascending: false }], ['limit', 1], ['maybeSingle'],
  ]);
  assert.deepEqual(result?.context, { goals: ['dryness', 'maintain'], skinBehavior: 'dry_tight', reactivity: 'reacts_easily' });
  assert.match(result!.version, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(result), /private|pregnancy|prescription|photo|ownerId|e7000000/);
  assert.deepEqual(Object.keys(result!).sort(), ['context', 'version']);
});

test('modern unknown/withheld profile never revives legacy answers', async () => {
  const f = fixture([{ data: { revision: '8', payload: { primaryGoal: null, secondaryGoals: [],
    skinBehavior: 'withheld', reactivity: 'unanswered' } }, error: null }]);
  assert.deepEqual((await loadPrivateIngredientContext(f.admin, owner))?.context,
    { goals: [], skinBehavior: 'withheld', reactivity: 'unanswered' });
  assert.equal(f.calls.some(call => call[1] === 'free_skin_profiles'), false);
});

test('legacy fallback is owner-filtered and selects no sensitive disclosure columns', async () => {
  const f = fixture([{ data: null, error: null }, { data: { goals: ['dryness'], skin_behavior: 'dry_tight',
    reactivity: 'generally_tolerates', updated_at: timestamp, pregnancy_status: 'yes', known_sensitivities: ['private'] }, error: null }]);
  const result = await loadPrivateIngredientContext(f.admin, owner);
  assert.deepEqual(f.calls.slice(7), [ ['from', 'free_skin_profiles'], ['select', 'goals,skin_behavior,reactivity,updated_at'],
    ['eq', 'user_id', owner], ['maybeSingle'] ]);
  assert.deepEqual(result?.context, { goals: ['dryness'], skinBehavior: 'dry_tight', reactivity: 'generally_tolerates' });
  assert.doesNotMatch(JSON.stringify(result), /pregnancy|private|updated_at|user_id/);
});

test('version is stable for identical projections and changes with revision, minimal fields or legacy update', async () => {
  const modern = async (row: unknown) => loadPrivateIngredientContext(fixture([{ data: row, error: null }]).admin, owner);
  const initial = await modern({ revision: 1, payload });
  assert.equal((await modern({ revision: 1, payload: { ...payload, note: 'another private note' } }))?.version, initial?.version);
  assert.notEqual((await modern({ revision: 2, payload }))?.version, initial?.version);
  assert.notEqual((await modern({ revision: 1, payload: { ...payload, reactivity: 'generally_tolerates' } }))?.version, initial?.version);
  const legacy = async (updated_at: string) => loadPrivateIngredientContext(fixture([
    { data: null, error: null }, { data: { goals: [], skin_behavior: 'unsure', reactivity: 'unsure', updated_at }, error: null },
  ]).admin, owner);
  assert.notEqual((await legacy(timestamp))?.version, (await legacy('2026-09-30T13:00:00.000Z'))?.version);
});

test('no saved owner profile yields null, without inventing context', async () => {
  assert.equal(await loadPrivateIngredientContext(fixture([{ data: null, error: null }, { data: null, error: null }]).admin, owner), null);
});

test('DB failures and malformed rows are sanitized; never silently fall back from modern errors', async () => {
  for (const modern of [ { data: null, error: { message: 'private database detail' } },
    { data: { revision: 1, payload: null }, error: null },
    { data: { revision: -1, payload }, error: null }, { data: { revision: 1.5, payload }, error: null },
    { data: { revision: Number.MAX_SAFE_INTEGER + 1, payload }, error: null },
    { data: [], error: null } ]) {
    const f = fixture([modern]);
    await assert.rejects(loadPrivateIngredientContext(f.admin, owner), { message: 'INGREDIENT_CONTEXT_UNAVAILABLE' });
    assert.equal(f.calls.some(call => call[1] === 'free_skin_profiles'), false);
  }
  await assert.rejects(loadPrivateIngredientContext(fixture([], Error('private thrown detail')).admin, owner),
    { message: 'INGREDIENT_CONTEXT_UNAVAILABLE' });
  for (const legacy of [{ data: null, error: { message: 'private error' } },
    { data: { updated_at: 'invalid' }, error: null }]) {
    await assert.rejects(loadPrivateIngredientContext(fixture([{ data: null, error: null }, legacy]).admin, owner),
      { message: 'INGREDIENT_CONTEXT_UNAVAILABLE' });
  }
});

test('empty/malformed owner is rejected before any table read', async () => {
  for (const value of ['', ' ', ' padded ']) {
    const f = fixture([]);
    await assert.rejects(loadPrivateIngredientContext(f.admin, value), { message: 'INGREDIENT_CONTEXT_UNAVAILABLE' });
    assert.deepEqual(f.calls, []);
  }
});
