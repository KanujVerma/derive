import {canonicalJson, sha256} from '../part-two/hash.ts';
import type {InsightInput} from './insightPacket.ts';

export type ProcessingPhase = 'decision' | 'generation' | 'copy_review';
export type ProcessingPurpose =
  | 'personalized_product_action'
  | 'personalized_product_decision'
  | 'verify_personalized_product_decision';

export type JsonValue = null | boolean | number | string | JsonValue[] |
  {[key: string]: JsonValue};

/** The SQL ledger stores these hashes, not an additional copy of private input.
 * They identify work; they never grant permission to send it to a provider. */
export interface ProcessingIdentity {
  version: 'personalized-processing/v1';
  operationHash: string;
  phase: ProcessingPhase;
  purpose: ProcessingPurpose;
  requestHash: string;
  proposalHash: string | null;
}

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;
const INPUT_KEYS = [
  'dataMode', 'productContext', 'basis', 'evidence', 'personalFacts',
  'allowedActions', 'mandatoryCautionIds', 'allowedQuestions', 'now', 'validUntil',
].sort();

/** Reject values whose JSON conversion silently drops or changes information.
 * In particular undefined/NaN, sparse arrays and accessors must not collide with
 * a different request. No getter or toJSON method is executed. */
export function assertProcessingJson(value: unknown): void {
  const ancestors = new Set<object>();
  const visit = (node: unknown, depth: number): void => {
    if (depth > 64) throw new Error('processing_json_depth');
    if (node === null || typeof node === 'string' || typeof node === 'boolean') return;
    if (typeof node === 'number') {
      if (!Number.isFinite(node) || Object.is(node, -0)) throw new Error('processing_json_number');
      return;
    }
    if (typeof node !== 'object') throw new Error('processing_json_value');
    if (ancestors.has(node)) throw new Error('processing_json_cycle');
    const prototype = Object.getPrototypeOf(node);
    if (Array.isArray(node) ? prototype !== Array.prototype :
      prototype !== Object.prototype && prototype !== null) throw new Error('processing_json_prototype');
    const keys = Reflect.ownKeys(node);
    if (keys.some(key => typeof key !== 'string')) throw new Error('processing_json_symbol');
    if (Array.isArray(node)) {
      if (keys.length !== node.length + 1) throw new Error('processing_json_array');
      for (let i = 0; i < node.length; i++) {
        if (!Object.hasOwn(node, i)) throw new Error('processing_json_array');
      }
    }
    ancestors.add(node);
    for (const key of keys) {
      if (Array.isArray(node) && key === 'length') continue;
      const descriptor = Object.getOwnPropertyDescriptor(node, key)!;
      if (!descriptor.enumerable || !('value' in descriptor)) throw new Error('processing_json_property');
      visit(descriptor.value, depth + 1);
    }
    ancestors.delete(node);
  };
  visit(value, 0);
}

/** Coalesce identical semantic work across requests/processes. The aggregate
 * freshness window is deliberately NOT permission for another paid attempt when
 * a rights/TTL window renews. Original evidence/fact expiries remain included.
 * The stored canonical input keeps its first deadline; this identity cannot
 * silently extend it. SQL independently bounds the execution lease. */
export function logicalProcessingHash(
  resultId: string,
  resultRevision: number,
  input: InsightInput,
): string {
  if (!UUID.test(resultId) || !Number.isSafeInteger(resultRevision) || resultRevision < 0) {
    throw new Error('invalid_processing_result');
  }
  assertProcessingJson(input);
  const keys = Object.keys(input).sort();
  if (keys.length !== INPUT_KEYS.length || keys.some((key, index) => key !== INPUT_KEYS[index])) {
    throw new Error('invalid_processing_input_shape');
  }
  if (!input.basis || typeof input.basis !== 'object' ||
    !UUID.test(input.basis.ownerId) || !HASH.test(input.basis.decisionBindingHash)) {
    throw new Error('invalid_processing_binding');
  }
  if (typeof input.now !== 'string' || typeof input.validUntil !== 'string' ||
    !Number.isFinite(Date.parse(input.now)) || !Number.isFinite(Date.parse(input.validUntil)) ||
    Date.parse(input.validUntil) <= Date.parse(input.now)) {
    throw new Error('invalid_processing_lease');
  }
  const {now: _now, validUntil: _aggregateFreshness, ...semanticInput} = input;
  return sha256(canonicalJson({
    version: 'personalized-operation/v2',
    resultId: resultId.toLowerCase(),
    resultRevision,
    input: semanticInput,
  }));
}

/** A facts-first operation must not coalesce with legacy writer-led work. */
export function logicalFactsFirstHash(resultId:string,resultRevision:number,input:InsightInput):string {
  return sha256(canonicalJson({version:'facts-first/v1',operationHash:logicalProcessingHash(resultId,resultRevision,input)}));
}

/** Hash the complete provider request, including instruction, schema and token
 * limit. Do not use only the personal projection as a dispatch replay identity.
 * Secrets and HTTP authentication headers are not part of providerRequest. */
export function processingIdentity(args: {
  operationHash: string;
  phase: ProcessingPhase;
  provider: string;
  model: string;
  serviceTier: 'paid';
  providerRequest: JsonValue;
  proposalHash: string | null;
}): ProcessingIdentity {
  if (!HASH.test(args.operationHash) ||
    !['decision', 'generation', 'copy_review'].includes(args.phase) ||
    typeof args.provider !== 'string' || !args.provider.trim() || args.provider.length > 100 ||
    typeof args.model !== 'string' || !args.model.trim() || args.model.length > 200 ||
    args.serviceTier !== 'paid') throw new Error('invalid_processing_identity');
  if (args.phase !== 'copy_review' ? args.proposalHash !== null :
    typeof args.proposalHash !== 'string' || !HASH.test(args.proposalHash)) {
    throw new Error('invalid_processing_proposal_binding');
  }
  assertProcessingJson(args.providerRequest);
  const purpose: ProcessingPurpose = args.phase === 'decision' ? 'personalized_product_action' :
    args.phase === 'generation' ? 'personalized_product_decision' : 'verify_personalized_product_decision';
  return {
    version: 'personalized-processing/v1',
    operationHash: args.operationHash,
    phase: args.phase,
    purpose,
    requestHash: sha256(canonicalJson({
      version: 'personalized-provider-request/v1', purpose,
      provider: args.provider, model: args.model, serviceTier: args.serviceTier,
      proposalHash: args.proposalHash, request: args.providerRequest,
    })),
    proposalHash: args.proposalHash,
  };
}
