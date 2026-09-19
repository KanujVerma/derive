/**
 * Server-Side Initial Routine Intelligence & Deterministic Validation
 * 
 * Part of DERIVE I1-B2.1: Real Model Intelligence, Trust Semantics & Error-Boundary Closure.
 * 
 * Single source of truth for routine intelligence types, validation, and Gemini integration.
 * In production: Orchestrated via Supabase Edge Function with Gemini structured output.
 * In tests: Deterministic fixture factories provide verified test proposals.
 * 
 * Rules:
 * - Production proposal is formulated via real Gemini structured outputs.
 * - Zero client secrets or Gemini API keys in the mobile bundle.
 * - Deterministic validation enforces AM/PM invariants, pregnancy contraindications, and action enums.
 */

export * from '../../../supabase/functions/propose-routine/types.ts';
export * from '../../../supabase/functions/propose-routine/validator.ts';
export {
  assembleCanonicalContext,
} from '../../../supabase/functions/propose-routine/context.ts';
export {
  DEFAULT_GEMINI_MODEL,
  GEMINI_PROPOSAL_RESPONSE_SCHEMA,
  GEMINI_SYSTEM_INSTRUCTION,
  buildGeminiPrompt,
  callGeminiProposalProvider,
  createDeterministicTestProposal,
} from '../../../supabase/functions/propose-routine/gemini-provider.ts';

import {
  assembleCanonicalContext,
} from '../../../supabase/functions/propose-routine/context.ts';
import {
  createDeterministicTestProposal,
} from '../../../supabase/functions/propose-routine/gemini-provider.ts';
import type { AssembledRoutineContext } from '../../../supabase/functions/propose-routine/types.ts';

/**
 * Backward-compatible context assembler for test suites.
 */
export function assembleRoutineContext(
  skinProfile: any,
  payloadSnapshot: any,
  photos?: any[]
): AssembledRoutineContext {
  const res = assembleCanonicalContext(skinProfile, payloadSnapshot, photos);
  if (!res.valid || !res.context) {
    throw new Error(`Failed to assemble routine context: ${res.error}`);
  }
  return res.context;
}

/**
 * Deterministic test proposal factory for test suites.
 * Exclusively for unit tests, local E2E simulation, and CI.
 */
export const generateContextGroundedProposal = createDeterministicTestProposal;
