import assert from 'node:assert/strict';
import test from 'node:test';
import { createAppleVisionRecognizer } from '../src/services/partOneOcr.ts';
import type { LocalOcrInput, LocalOcrDiagnostic, OcrObservation } from '../src/services/partOneOcr.ts';
const input: LocalOcrInput = { uri: 'file:///synthetic-cache/label.img', evidenceId: '00000000-0000-4000-8000-000000000001',
  captureSessionId: '00000000-0000-4000-8000-000000000002', generation: 1, languages: ['en-US'], correctionEnabled: false };
const payload: OcrObservation = { evidenceId: input.evidenceId, captureSessionId: input.captureSessionId, generation: 1,
  recognizer: 'apple_vision', recognizerVersion: 'synthetic-native-payload-v1', languageConfig: ['en-US'], correctionEnabled: false,
  sourceWidth: 1000, sourceHeight: 2000, orientationTransform: [1, 0, 0, 0, 1, 0, 0, 0, 1], status: 'recognized',
  lines: [{ text: 'Synthetic only: 1,2-Hexanediol; PEG-240/HDI.', alternatives: [], region: [.1, .2, .8, .05], confidence: .9 }] };

test('A16/A19 JavaScript native boundary retains nonzero generation and strict chemical/source payload', async () => {
  const codes: LocalOcrDiagnostic[] = []; let delivered: LocalOcrInput | null = null;
  const recognizer = createAppleVisionRecognizer({ recognize: async actual => { delivered = actual; return JSON.parse(JSON.stringify(payload)); } }, code => codes.push(code));
  const result = await recognizer.recognize(input);
  assert.deepEqual(delivered, input); assert.equal(result.generation, 1); assert.deepEqual(result, payload);
  assert.deepEqual(codes, ['native_payload_valid']);
});

test('A19 bridge diagnostic identifies zeroed generation without logging recognized text or identifiers', async () => {
  const codes: LocalOcrDiagnostic[] = [];
  const recognizer = createAppleVisionRecognizer({ recognize: async () => ({ ...payload, generation: 0 }) }, code => codes.push(code));
  await assert.rejects(() => recognizer.recognize(input), /stale_ocr_binding/);
  assert.deepEqual(codes, ['native_binding_mismatch:generation']);
  assert(!JSON.stringify(codes).includes('Hexanediol')); assert(!JSON.stringify(codes).includes(input.evidenceId));
});

test('A17 native-call and malformed-payload failures are separate with no raw exception leakage', async () => {
  for (const failure of ['call', 'payload'] as const) {
    const codes: LocalOcrDiagnostic[] = [];
    const recognizer = createAppleVisionRecognizer({ recognize: async () => {
      if (failure === 'call') throw new Error(`Private URI ${input.uri}; ${payload.lines[0].text}`);
      return { ...payload, sourceWidth: undefined };
    } }, code => codes.push(code));
    await assert.rejects(() => recognizer.recognize(input), failure === 'call' ? /native_ocr_call_failed/ : /malformed_ocr_observation/);
    assert.deepEqual(codes, [failure === 'call' ? 'native_call_failed' : 'native_payload_invalid']);
  }
});
