/**
 * One synthetic real-provider call through the current server Gemini adapter.
 * This is not a hosted Edge Function, persisted routine, or model selection.
 * Never run in CI or with real customer data.
 */
import assert from 'node:assert/strict';
import { callGeminiProposalProvider, DEFAULT_GEMINI_MODEL } from '../supabase/functions/propose-routine/gemini-adapter.ts';
import { validateRoutineProposal } from '../supabase/functions/propose-routine/validator.ts';

assert.equal(process.env.H1A_REAL_PROVIDER_TEST, 'YES', 'Explicit real-provider opt-in required');
const key = process.env.GEMINI_API_KEY;
assert.ok(key && key.startsWith('AQ.'), 'Server-only Gemini auth key required');
const model = process.env.H1A_DIAGNOSTIC_MODEL || DEFAULT_GEMINI_MODEL;
assert.ok(['gemini-3.8-flash', 'gemini-3.6-flash'].includes(model), 'Only reviewed free-tier diagnostic models allowed');
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  const response = await nativeFetch(...args);
  if (!response.ok) {
    const body = await response.clone().json().catch(() => null);
    console.log(JSON.stringify({
      upstreamStatus: response.status,
      upstreamCode: body?.error?.status ?? null,
      upstreamMessage: typeof body?.error?.message === 'string'
        ? body.error.message.replaceAll(key, '[redacted]').slice(0, 180) : null,
    }));
  }
  return response;
};

const context = {
  userId: '00000000-0000-4000-8000-000000000001',
  primaryGoal: 'breakouts',
  secondaryGoals: ['texture'],
  routineComplexity: 'simple',
  costPreference: 'balanced',
  middayFeel: 'combination',
  postCleanseTightness: false,
  isPregnantOrNursing: false,
  pregnancyStatus: 'no',
  sensitivitiesStatus: 'none_known',
  knownSensitivities: [],
  activePrescriptions: [],
  confirmedProducts: [],
  productReactions: [],
  formulaSnapshots: [],
  pihTendencyAnswer: 'Sometimes',
};

try {
  const proposal = await callGeminiProposalProvider(context, key, model);
  const validation = validateRoutineProposal(proposal, context);
  console.log(JSON.stringify({
    model,
    realProviderReturnedStructuredObject: typeof proposal === 'object' && proposal !== null,
    validatorAccepted: validation.valid,
    validationErrorCount: validation.errors.length,
  }));
  if (!validation.valid) process.exitCode = 1;
} catch (error) {
  console.log(JSON.stringify({ adapterErrorCode: error?.code ?? 'UNKNOWN' }));
  process.exitCode = 1;
}
