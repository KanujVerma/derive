import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanupP0dFixtures, type P0dCleanupClient } from '../scripts/acceptance/p0d/cleanup.ts';
const fixtures = { identifier: 'i', formula: 'f', variant: 'v', product: 'p' };
const targets = ['user:A', 'user:B', 'product_identifiers:i', 'product_formula_versions:f', 'product_variants:v', 'products:p'];
function transport(failures: Set<string> = new Set(), survivors: Set<string> = new Set()) {
 const calls: string[] = [], remaining = new Set(targets);
 const erase = async (target: string) => { calls.push(`delete:${target}`); if (failures.has(`delete:${target}`)) throw new Error('private transport detail'); if (!survivors.has(target)) remaining.delete(target); return { error: null }; };
 const read = async (target: string) => { calls.push(`verify:${target}`); if (failures.has(`verify:${target}`)) throw new Error('private verification detail'); return remaining.has(target); };
 const client: P0dCleanupClient = { auth: { admin: { deleteUser: id => erase(`user:${id}`), getUserById: async id => ({ error: await read(`user:${id}`) ? null : { status: 404 } }) } }, from: table => ({ delete: () => ({ eq: (_column, id) => erase(`${table}:${id}`) }), select: () => ({ eq: async (_column, id) => ({ error: null, data: await read(`${table}:${id}`) ? [{ id }] : [] }) }) }) };
 return { client, calls };
}
test('a first-user cleanup rejection still attempts every owned user/catalog row and every absence check before failing', async () => {
 const { client, calls } = transport(new Set(['delete:user:A']));
 await assert.rejects(cleanupP0dFixtures(client, ['A', 'B'], fixtures));
 assert.deepEqual(calls.filter(call => call.startsWith('delete:')), targets.map(target => `delete:${target}`));
 assert.deepEqual(calls.filter(call => call.startsWith('verify:')), targets.map(target => `verify:${target}`));
});
test('catalog and verification failures do not prevent remaining deletions/checks or expose raw errors', async () => {
 const { client, calls } = transport(new Set(['delete:product_identifiers:i', 'verify:user:A', 'verify:product_formula_versions:f']));
 await assert.rejects(cleanupP0dFixtures(client, ['A', 'B'], fixtures), error => { assert.doesNotMatch(String(error), /private transport|private verification/); return true; });
 assert.deepEqual(calls.filter(call => call.startsWith('delete:')), targets.map(target => `delete:${target}`));
 assert.deepEqual(calls.filter(call => call.startsWith('verify:')), targets.map(target => `verify:${target}`));
});
test('success requires checked absence for users and catalog; silently surviving rows fail', async () => {
 const successful = transport(); await cleanupP0dFixtures(successful.client, ['A', 'B'], fixtures);
 assert.deepEqual(successful.calls.filter(call => call.startsWith('verify:')), targets.map(target => `verify:${target}`));
 for (const target of ['user:A', 'products:p']) { const failed = transport(new Set(), new Set([target])); await assert.rejects(cleanupP0dFixtures(failed.client, ['A', 'B'], fixtures)); }
});
test('only recorded non-null ownership is cleaned, and a network error is not user absence', async () => {
 const { client, calls } = transport();
 client.auth.admin.getUserById = async () => ({ error: { status: 503 } });
 await assert.rejects(cleanupP0dFixtures(client, [null, 'A'], { identifier: null, formula: null, variant: null, product: null }));
 assert.deepEqual(calls, ['delete:user:A']);
});
