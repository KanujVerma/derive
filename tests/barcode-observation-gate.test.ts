import assert from 'node:assert/strict';
import test from 'node:test';
import { createBarcodeObservationGate } from '../src/presentation/capture/barcodeObservationGate.ts';
function fixture() { let time = 0; const gate = createBarcodeObservationGate(() => time); return { gate, tick: (ms: number) => { time += ms; } }; }
test('one observation per result; paused callbacks never trigger or haptic another handoff', () => {
  const { gate, tick } = fixture();
  assert.equal(gate.observe('barcode-a', false), true);
  tick(500); assert.equal(gate.observe('barcode-a', false), false);
  tick(500); assert.equal(gate.observe('barcode-b', true), false);
  tick(500); assert.equal(gate.observe('barcode-a', true), false);
});
test('dismiss while the same barcode remains visible does not immediately reopen, including a long result', () => {
  const { gate, tick } = fixture(); gate.observe('barcode-a', false);
  tick(10000); gate.resume();
  assert.equal(gate.observe('barcode-a', false), false);
  for (let i = 0; i < 10; i++) { tick(500); assert.equal(gate.observe('barcode-a', false), false); }
});
test('a different barcode, a quiet interval, and deliberate retry allow scanning again', () => {
  const { gate, tick } = fixture(); gate.observe('barcode-a', false); gate.resume();
  assert.equal(gate.observe('barcode-b', false), true);
  gate.resume(); tick(1500); assert.equal(gate.observe('barcode-b', false), true);
  gate.resume(); assert.equal(gate.observe('barcode-b', false), false);
  gate.retry(); assert.equal(gate.observe('barcode-b', false), true);
});
