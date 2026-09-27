import assert from 'node:assert/strict';
import test from 'node:test';
import { decisionDependencies } from '../supabase/functions/personal-decision/runtime.ts';
import { evaluateDecisionRequest } from '../supabase/functions/personal-decision/handler.ts';
import { fixtureSnapshot } from '../supabase/functions/personal-decision/fixtures.ts';
import type { PersonalContextSnapshot } from '../src/contracts/PersonalContext.ts';

const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const product = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const variant = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const formulaId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const now = '2026-09-26T00:00:00Z';
function setup() {
  const formula = { id: formulaId, variant_id: variant, verification_status: 'verified', ingredients: ['Retinol'],
    observed_at: now, source_reference: 'https://fixture.invalid/label', provenance_type: 'package_label' };
  const tables: Record<string, unknown> = {
    products: { id: product, category: 'moisturizer', is_catalog_standard: true, catalog_verified_at: now, catalog_source_reference: null },
    product_variants: { id: variant, product_id: product, catalog_verification_status: 'verified', lifecycle_status: 'active' },
    product_formula_versions: formula,
    product_identifiers: [{ variant_id: variant, formula_version_id: formulaId, source_authority: 'founder', verified_at: now }],
  };
  const admin = { rpc: async () => ({ data: null, error: null }), from: (table: string) => {
    const result = { data: tables[table], error: null };
    const query: any = { select: () => query, eq: () => query, not: () => query,
      maybeSingle: async () => result, then: (resolve: any) => Promise.resolve(result).then(resolve) };
    return query;
  } };
  const context: PersonalContextSnapshot = { version: 'personal-context-v1', ownerId: owner, revision: 2, profile: null,
    routine: { id: '88888888-8888-4888-8888-888888888888', ownerId: owner, revision: 2, recordedAt: now,
      provenance: 'self_report', supersedesRevisionId: null, data: { completeness: 'complete', items: [{
        id: '77777777-7777-4777-8777-777777777777', reference: { kind: 'catalog', productId: product, variantId: variant, formulaVersionId: formulaId },
        state: 'current', timing: 'pm', frequency: { kind: 'qualitative', value: 'daily' }, startedOn: null, stoppedOn: null, duration: null,
      }] } }, experiences: [], historyRevision: null, historyTruncated: false,
    legacy: { source: 'legacy_free_context', profile: null, products: [], experiences: [], truncated: false } };
  return { formula, tables, context, deps: decisionDependencies(admin, { localFixture: false }) };
}

test('B6 independently verified routine formula survives missing category provenance', async () => {
  const { deps, context } = setup();
  const facts = await deps.readRoutineFacts(context);
  assert.equal(facts.length, 1);
  assert.equal(facts[0].category.state, 'unknown');
  assert.equal(facts[0].ingredients.state, 'known');
  assert.deepEqual(facts[0].sources, [{ id: `routine:formula:${formulaId}`, revision: now }]);
  assert.equal(facts[0].provenance?.[0].source_reference, 'https://fixture.invalid/label');
});

test('B6 retained overlap freezes independent formula provenance without promoting category', async () => {
  const { deps, context, formula } = setup();
  const snapshot = fixtureSnapshot(); snapshot.formula!.ingredients = ['Retinol'];
  deps.verifyCaseOwner = async () => true; deps.readAssessment = async () => null;
  deps.readSnapshot = async () => ({ snapshot, runtime: 'authoritative' }); deps.readContext = async () => context;
  deps.readHistory = async (_owner, revision) => ({ atRevision: revision, items: [], nextCursor: null });
  let saved: any;
  deps.persist = async (_owner, _id, input, packet) => { saved = JSON.parse(JSON.stringify(input)); return { assessmentId: product, packet, replayed: false }; };
  const response = await evaluateDecisionRequest(owner, { operation: 'evaluate', requestId: product, caseId: snapshot.resolutionCaseId, snapshotId: snapshot.snapshotId }, deps);
  assert.ok(response.packet.findings.some(finding => finding.kind === 'active_overlap'));
  assert.ok(!response.packet.findings.some(finding => finding.kind === 'role_redundancy'));
  assert.equal(saved.evaluatedFacts.routine[0].category.state, 'unknown');
  assert.deepEqual(saved.evaluatedFacts.routine[0].formulaEvidence, { state: 'known', sourceIds: [`routine:formula:${formulaId}`] });
  formula.source_reference = 'https://fixture.invalid/changed';
  assert.equal(saved.evaluatedFacts.routine[0].provenance[0].source_reference, 'https://fixture.invalid/label');
});

test('B6 missing category does not bypass routine formula verification', async () => {
  const { deps, context, formula } = setup();
  formula.verification_status = 'provisional';
  const facts = await deps.readRoutineFacts(context);
  assert.equal(facts[0].category.state, 'unknown');
  assert.equal(facts[0].ingredients.state, 'unknown');
  assert.deepEqual(facts[0].sources, []);
});
