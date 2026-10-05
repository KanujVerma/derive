import assert from 'node:assert/strict';
import test from 'node:test';
import { partOneResultPollDelay } from '../src/presentation/part-one/resultController.ts';

const now = Date.parse('2026-10-03T10:00:00Z');
test('queued and running jobs become observable on a one-second cadence', () => {
  for (const work of ['queued', 'running'] as const) assert.equal(partOneResultPollDelay({ work, nextCheckAfter: null }, now), 1000);
});
test('active polling preserves future server deadlines and uses one second once already due', () => {
  for (const work of ['queued', 'running'] as const) {
    assert.equal(partOneResultPollDelay({ work, nextCheckAfter: new Date(now + 30000).toISOString() }, now), 30000);
    assert.equal(partOneResultPollDelay({ work, nextCheckAfter: new Date(now - 1000).toISOString() }, now), 1000);
    assert.equal(partOneResultPollDelay({ work, nextCheckAfter: new Date(now + 100).toISOString() }, now), 1000, 'never read before a near future deadline');
  }
});
test('retry and completed or deferred jobs retain their preceding observation cadence', () => {
  assert.equal(partOneResultPollDelay({ work: 'retry_wait', nextCheckAfter: null }, now), 4000);
  for (const work of ['complete', 'deferred_budget', 'failed_final', 'cancelled'] as const) assert.equal(partOneResultPollDelay({ work, nextCheckAfter: null }, now), 10000);
  assert.equal(partOneResultPollDelay({ work: 'retry_wait', nextCheckAfter: new Date(now + 57000).toISOString() }, now), 57000);
  assert.equal(partOneResultPollDelay({ work: 'retry_wait', nextCheckAfter: new Date(now - 1000).toISOString() }, now), 2000);
});
