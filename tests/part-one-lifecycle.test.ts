import assert from 'node:assert/strict';
import test from 'node:test';
import { createPartOneResultController, type PartOneTransport } from '../src/presentation/part-one/resultController.ts';
import type { ScanResult, ScanRequest } from '../src/contracts/PartOne.ts';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function result(revision = 1): ScanResult {
  return { schemaVersion: 1, requestId: id(1), scanId: id(2), generation: 0, resultRevision: revision,
    identity: 'exact', itemId: id(3), candidateIds: [], snapshotId: id(4), declarationId: null, declarationState: 'none', scope: 'public',
    packageConfirmation: 'unconfirmed', work: 'running', jobId: id(5), subscriptionId: id(6), nextCheckAfter: null,
    display: { resultRevision: revision, selectedIdentity: { id: id(3), name: 'Fixture Cleanser', brand: 'Synthetic', variantText: '100 ml, single package', image: null }, candidates: [], sections: [], sources: [], limitations: ['Ingredients not verified'] },
    reasonCodes: ['no_declaration'], conflictIds: [], evidenceIds: [], allowedActions: ['save_partial', 'retry', 'rescan'], freshness: { observedAt: null, expiresAt: null, state: 'unknown' } };
}
const request: ScanRequest = { schemaVersion: 1, requestId: id(1), idempotencyKey: 'one', clientScanId: id(2), generation: 0,
  code: { raw: '305210416383', symbology: 'upc_a', namespace: 'gtin', retailerId: null }, requestedMarket: 'US', categoryHint: null };
function fixture() {
  let current = result(); const calls: string[] = []; let hold: ((r: ScanResult) => void) | null = null;
  const transport: PartOneTransport = {
    async scan() { calls.push('scan'); return current; }, async read() { calls.push('read'); return current; },
    async subscribe() { calls.push('subscribe'); return current; }, async unsubscribe() { calls.push('unsubscribe'); },
    async select() { return current; }, async save() { calls.push('save'); return { saveId: id(8) }; },
    async capture() { return { schemaVersion: 1, captureSessionId: id(9), packageObservationId: id(10), scanId: id(2), generation: 0, captureRevision: 0, deletionEpoch: 0, itemId: id(3), candidateId: null }; },
  };
  const controller = createPartOneResultController(transport, () => {});
  return { controller, transport, calls, update: (r: ScanResult) => current = r,
    holdScan: () => { transport.scan = () => new Promise(resolve => { hold = resolve; }); }, resolve: (r: ScanResult) => hold?.(r) };
}
test('A21 pending reopen reads and rejoins the durable job without another lookup', async () => {
  const f = fixture(); await f.controller.begin(id(20), request); f.controller.setScroll(230);
  f.update(result(2)); await f.controller.reopen(id(20), id(2));
  assert.deepEqual(f.calls, ['scan', 'read', 'subscribe']); assert.equal(f.controller.getView().result?.jobId, id(5));
  assert.equal(f.controller.getView().scrollOffset, 230);
});
test('A19 late A results cannot mutate B after owner switch or close', async () => {
  const f = fixture(); f.holdScan(); const pending = f.controller.begin(id(20), request);
  f.controller.setOwner(id(21)); f.resolve(result(7)); assert.equal(await pending, false); assert.equal(f.controller.getView().result, null);
});
test('A23 credible conflict retracts readiness while older worker publication is ignored', async () => {
  const f = fixture(); await f.controller.begin(id(20), request);
  const accepted = { ...result(2), declarationId: id(30), declarationState: 'accepted' as const, freshness: { observedAt: '2026-10-02T00:00:00Z', expiresAt: '2026-10-09T00:00:00Z', state: 'fresh' as const } };
  assert.equal(f.controller.publish(accepted, id(20)), true);
  assert.equal(f.controller.publish({ ...result(3), declarationState: 'conflict', conflictIds: [id(31)] }, id(20)), true);
  assert.equal(f.controller.publish(accepted, id(20)), false); assert.equal(f.controller.getView().result?.declarationId, null);
});
test('A24 owner switch while saving never marks another owner saved', async () => {
  const f = fixture(); await f.controller.begin(id(20), request);
  let finish: ((r: { saveId: string }) => void) | null = null;
  f.transport.save = () => new Promise(resolve => { finish = resolve; });
  const pending = f.controller.save(id(20), 'save-one'); f.controller.setOwner(id(21));
  (finish as unknown as (r: { saveId: string }) => void)({ saveId: id(8) }); assert.equal(await pending, false); assert.equal(f.controller.getView().saved, false);
});
test('A28 identity-only save sends exact snapshot/generation/revision and no transcript', async () => {
  const f = fixture(); await f.controller.begin(id(20), request);
  let payload: unknown; f.transport.save = async input => { payload = input; return { saveId: id(8) }; };
  assert.equal(await f.controller.save(id(20), 'save-one'), true);
  assert.deepEqual(payload, { idempotencyKey: 'save-one', scanId: id(2), expectedGeneration: 0, expectedResultRevision: 1, selectedSnapshotId: id(4), selectedDeclarationId: null });
});
test('A18 closing unsubscribes interest once and clears the local result', async () => {
  const f = fixture(); await f.controller.begin(id(20), request); f.controller.close(); f.controller.close();
  assert.equal(f.calls.filter(call => call === 'unsubscribe').length, 1); assert.equal(f.controller.getView().result, null);
});
test('save conflict refreshes the current result and never claims success', async () => {
  const f = fixture(); await f.controller.begin(id(20), request); f.transport.save = async () => { throw new Error('409'); }; f.update(result(2));
  assert.equal(await f.controller.save(id(20), 'save-one'), false); assert.equal(f.controller.getView().result?.resultRevision, 2); assert.equal(f.controller.getView().saved, false);
});
test('A23/A28 a newly published revision can be saved after an older incomplete save', async () => {
  const f = fixture(); await f.controller.begin(id(20), request);
  assert.equal(await f.controller.save(id(20), 'incomplete'), true);
  assert.equal(f.controller.getView().saved, true);
  assert.equal(f.controller.publish(result(2), id(20)), true);
  assert.equal(f.controller.getView().saved, false);
  assert.equal(await f.controller.save(id(20), 'new-revision'), true);
});
