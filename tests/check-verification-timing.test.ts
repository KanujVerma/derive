import assert from 'node:assert/strict';
import test from 'node:test';
import { beginCheckVerificationTiming, markCheckVerificationTiming, endCheckVerificationTiming } from '../src/services/checkVerificationTiming.ts';

test('local timings ignore stale bindings and duplicates, and disclose no identifiers or text', () => {
  const dev = Object.getOwnPropertyDescriptor(globalThis, '__DEV__');
  const flag = process.env.EXPO_PUBLIC_CHECK_TIMING_EVALUATION, info = console.info;
  const messages: string[] = [];
  console.info = (...args: unknown[]) => { messages.push(String(args[1])); };
  try {
    Object.defineProperty(globalThis, '__DEV__', { value: false, configurable: true });
    process.env.EXPO_PUBLIC_CHECK_TIMING_EVALUATION = 'true';
    beginCheckVerificationTiming('name');
    assert.equal(messages.length, 0, 'production runtime cannot enable measurement');
    Object.defineProperty(globalThis, '__DEV__', { value: true, configurable: true });
    process.env.EXPO_PUBLIC_CHECK_TIMING_EVALUATION = '';
    beginCheckVerificationTiming('name');
    assert.equal(messages.length, 0, 'ordinary development does not log timings');
    process.env.EXPO_PUBLIC_CHECK_TIMING_EVALUATION = 'true';
    const stale = beginCheckVerificationTiming('name'), active = beginCheckVerificationTiming('name');
    markCheckVerificationTiming('name', 'candidates', stale);
    markCheckVerificationTiming('name', 'candidates', active);
    markCheckVerificationTiming('name', 'candidates', active);
    beginCheckVerificationTiming('barcode', 'private-binding-must-not-be-logged');
    markCheckVerificationTiming('barcode', 'identity', 'stale-binding');
    markCheckVerificationTiming('barcode', 'identity', 'private-binding-must-not-be-logged');
    const cancelled = beginCheckVerificationTiming('name');
    const beforeCancelled = messages.length;
    endCheckVerificationTiming('name');
    markCheckVerificationTiming('name', 'candidates', cancelled);
    endCheckVerificationTiming();
    markCheckVerificationTiming('barcode', 'image', 'private-binding-must-not-be-logged');
    assert.equal(messages.length, beforeCancelled, 'cancel, close and owner retirement ignore late completions');
    const rows = messages.map(value => JSON.parse(value));
    assert.equal(rows.filter(row => row.stage === 'candidates').length, 1);
    assert.equal(rows.filter(row => row.stage === 'identity').length, 1);
    for (const row of rows) {
      assert.deepEqual(Object.keys(row).sort(), ['elapsedMs', 'kind', 'sequence', 'stage']);
      assert(Number.isFinite(row.elapsedMs) && row.elapsedMs >= 0);
    }
    assert(!messages.join('').includes('binding'));
  } finally {
    endCheckVerificationTiming();
    console.info = info;
    if (dev) Object.defineProperty(globalThis, '__DEV__', dev); else Reflect.deleteProperty(globalThis, '__DEV__');
    if (flag === undefined) delete process.env.EXPO_PUBLIC_CHECK_TIMING_EVALUATION; else process.env.EXPO_PUBLIC_CHECK_TIMING_EVALUATION = flag;
  }
});
