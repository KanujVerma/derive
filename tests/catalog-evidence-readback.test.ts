import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INVENTORY_SQL, PROJECT_REF, catalogEvidenceReceipt, parseArgs,
} from '../scripts/readback-catalog-evidence.mjs';

const revision = 'a'.repeat(40);
const observedAt = '2026-09-28T12:00:00.000Z';
const counts = {
  total_products: 4,
  sourced_products: 1,
  not_sourced_products: 3,
  sourced_aliases: 1,
  active_sourced_variants: 0,
  verified_sourced_variants: 0,
  verified_authoritative_gtins: 0,
  verified_formula_versions: 0,
  uniquely_linked_formula_variants: 0,
  conflicting_formula_variants: 0,
};

test('catalog evidence readback reports scoped counts without claiming release readiness', () => {
  const receipt = catalogEvidenceReceipt({ row: counts, target: PROJECT_REF, sourceRevision: revision, observedAt });
  assert.deepEqual(receipt.counts, counts);
  assert.equal(receipt.activation.ready, false);
  assert.match(receipt.scope, /NOT_DEMAND_OR_RELEASE_PROOF/);
  assert.equal(receipt.target, PROJECT_REF);
});

test('catalog evidence readback fails closed on truncated, inconsistent or coerced counts', () => {
  const input = { target: 'local', sourceRevision: revision, observedAt };
  assert.throws(() => catalogEvidenceReceipt({ ...input, row: { ...counts, sourced_aliases: undefined } }));
  assert.throws(() => catalogEvidenceReceipt({ ...input, row: { ...counts, sourced_products: '1' } }));
  assert.throws(() => catalogEvidenceReceipt({ ...input, row: { ...counts, sourced_products: 2 } }));
  assert.throws(() => catalogEvidenceReceipt({ ...input, row: { ...counts, uniquely_linked_formula_variants: 2, active_sourced_variants: 1 } }));
  assert.throws(() => catalogEvidenceReceipt({ ...input, row: counts, sourceRevision: 'working-tree' }));
});

test('catalog evidence readback pins exact target and uses a static read-only query', () => {
  assert.deepEqual(parseArgs(['--local']), { target: 'local' });
  assert.deepEqual(parseArgs(['--project-ref', PROJECT_REF]), { target: PROJECT_REF });
  assert.throws(() => parseArgs(['--project-ref', 'wrong']));
  assert.throws(() => parseArgs(['--local', '--project-ref', PROJECT_REF]));
  assert.match(INVENTORY_SQL, /is_catalog_standard is true and catalog_verified_at is not null/);
  assert.doesNotMatch(INVENTORY_SQL, /\b(insert|update|delete|alter|drop|create|truncate|grant|revoke)\b/i);
  assert.doesNotMatch(INVENTORY_SQL, /auth\.users|customer_skin_photos|ingredients\s+as/i);
});
