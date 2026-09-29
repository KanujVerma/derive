import assert from 'node:assert/strict';
import test from 'node:test';
import { nativeGlassAllowed, materialSurface, readReduceTransparency } from '../src/presentation/ui/materialPolicy.ts';
import { choiceAccessibility } from '../src/presentation/ui/selection.ts';

const available = { platform: 'ios', moduleAvailable: true, apiAvailable: true, liquidGlassAvailable: true, reduceTransparency: false };
test('native glass requires every actual runtime capability', () => {
  assert.equal(nativeGlassAllowed(available), true);
  for (const field of ['moduleAvailable', 'apiAvailable', 'liquidGlassAvailable'] as const) {
    assert.equal(nativeGlassAllowed({ ...available, [field]: false }), false);
  }
  assert.equal(nativeGlassAllowed({ ...available, platform: 'android' }), false);
  assert.equal(nativeGlassAllowed({ ...available, reduceTransparency: true }), false);
  assert.equal(nativeGlassAllowed({ ...available, reduceTransparency: null }), false);
});
test('content and reduced-transparency fallbacks are opaque and readable', () => {
  assert.equal(materialSurface('content', 'light'), '#FFFEFB');
  assert.equal(materialSurface('chrome', 'light'), '#FFFEFB');
  assert.equal(materialSurface('chrome', 'dark'), '#171A18');
});
test('single and multiple choices announce their actual selection semantics', () => {
  assert.deepEqual(choiceAccessibility('single', true, false), { role: 'radio', state: { checked: true, disabled: false } });
  assert.deepEqual(choiceAccessibility('multiple', false, true), { role: 'checkbox', state: { checked: false, disabled: true } });
});
test('web and missing accessibility APIs keep the solid surface without calling an iOS method', async () => {
  let calls = 0;
  assert.equal(await readReduceTransparency('web', async () => { calls++; return false; }), true);
  assert.equal(calls, 0);
  assert.equal(await readReduceTransparency('ios', undefined), true);
  assert.equal(await readReduceTransparency('ios', () => { throw new Error('not supported'); }), true);
  assert.equal(await readReduceTransparency('ios', async () => false), false);
});
