import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseBarcodeSource } from '../supabase/functions/_shared/barcode-provenance.ts';

test('barcode provenance: legacy and explicit device origins preserve retry serialization', () => {
  const legacy = parseBarcodeSource(undefined, true);
  const explicit = parseBarcodeSource('device_barcode', true);
  assert.deepEqual(legacy, { ok: true });
  assert.equal(JSON.stringify(legacy), JSON.stringify(explicit));
});

test('barcode provenance: pasted and link-derived codes remain member evidence', () => {
  assert.deepEqual(parseBarcodeSource('member_input', true), { ok: true, source: 'member_input' });
  assert.notEqual(JSON.stringify(parseBarcodeSource('member_input', true)),
    JSON.stringify(parseBarcodeSource(undefined, true)));
});

test('barcode provenance: an origin without a barcode fails closed', () => {
  assert.deepEqual(parseBarcodeSource(undefined, false), { ok: true });
  for (const origin of ['device_barcode', 'member_input']) {
    assert.deepEqual(parseBarcodeSource(origin, false), { ok: false });
  }
});

test('barcode provenance: clients cannot label input as trusted OCR or founder review', () => {
  for (const origin of [null, '', 'trusted_ocr', 'founder_review', {}, [], 1]) {
    assert.deepEqual(parseBarcodeSource(origin, true), { ok: false });
  }
});
