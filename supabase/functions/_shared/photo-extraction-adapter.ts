import {parseProductEvidenceExtraction, type ExtractionEvidenceBinding} from './product-evidence-extraction.ts';

/** Provider-neutral result boundary. This module performs no network or image IO.
 * Decoding is not authorization to dispatch a model request. The eventual server
 * producer must bind authorized image bytes and a durable execution permit first.
 * Model observations may suggest catalog candidates, never establish a formula.
 */
export type PhotoRetakeReason = 'unreadable' | 'conflicting_evidence' | 'no_product_evidence' | 'identity_not_visible';
export type PhotoExtractionOutcome =
  | {kind: 'disabled'}
  | {kind: 'unavailable'; reason: 'unsupported_input' | 'invalid_response'}
  | {kind: 'retake'; reason: PhotoRetakeReason; action: 'clearer_photo' | 'another_angle' | 'front_label'}
  | {kind: 'catalog_lookup_required'; evidence: Readonly<ExtractionEvidenceBinding>;
      provider: Readonly<{id: string; model: string}>;
      observations: Readonly<Partial<Record<'barcodeText' | 'brandText' | 'productNameText' | 'variantText' | 'regionText', string>>>};

export interface PhotoExtractionAdapter {
  readonly provider: Readonly<{id: string; model: string}>;
  decode(raw: unknown, expected: ExtractionEvidenceBinding): PhotoExtractionOutcome;
}

const identityFields = ['barcodeText', 'brandText', 'productNameText', 'variantText', 'regionText'] as const;

/** Opt-in is server configuration only, never a client/model response field.
 * Default off. Gemini, Luna, or another provider can map their response to the
 * same existing neutral candidate DTO before this strict decoder is invoked.
 */
export function createPhotoExtractionAdapter(config: {
  providerId: string; modelId: string; enabled?: boolean;
}): PhotoExtractionAdapter {
  let providerId: unknown, modelId: unknown, enabledValue: unknown;
  try {
    if (!config || typeof config !== 'object' || Array.isArray(config)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(config))) throw Error();
    const values: Record<string, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(config)) {
      if (typeof key !== 'string' || !['providerId', 'modelId', 'enabled'].includes(key)) throw Error();
      const descriptor = Object.getOwnPropertyDescriptor(config, key);
      if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) throw Error();
      values[key] = descriptor.value;
    }
    ({providerId, modelId, enabled: enabledValue} = values);
  } catch { throw Error('invalid_photo_adapter_configuration'); }
  if (typeof providerId !== 'string' || typeof modelId !== 'string'
    || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,99}$/.test(providerId)
    || !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(modelId)
    || (enabledValue !== undefined && typeof enabledValue !== 'boolean')) {
    throw Error('invalid_photo_adapter_configuration');
  }
  const enabled = enabledValue === true;
  const provider = Object.freeze({id: providerId, model: modelId});
  return Object.freeze({provider, decode(raw: unknown, expected: ExtractionEvidenceBinding): PhotoExtractionOutcome {
    if (!enabled) return {kind: 'disabled'};
    let candidate;
    try { candidate = parseProductEvidenceExtraction(raw, expected); }
    catch { return {kind: 'unavailable', reason: 'invalid_response'}; }
    if (candidate.outcome === 'abstained') {
      switch (candidate.abstentionReason) {
        case 'unreadable': return {kind: 'retake', reason: 'unreadable', action: 'clearer_photo'};
        case 'conflicting_evidence': return {kind: 'retake', reason: 'conflicting_evidence', action: 'another_angle'};
        case 'no_product_evidence': return {kind: 'retake', reason: 'no_product_evidence', action: 'front_label'};
        default: return {kind: 'unavailable', reason: 'unsupported_input'};
      }
    }
    const observations: Partial<Record<typeof identityFields[number], string>> = {};
    for (const field of identityFields) {
      const value = candidate[field];
      if (value !== undefined) observations[field] = value;
    }
    // A region or variant alone does not identify a useful catalog query.
    if (!observations.barcodeText && !observations.brandText && !observations.productNameText) {
      return {kind: 'retake', reason: 'identity_not_visible', action: 'front_label'};
    }
    return {kind: 'catalog_lookup_required', provider,
      evidence: Object.freeze({evidenceId: candidate.evidenceId, role: candidate.role}),
      observations: Object.freeze(observations)};
  }});
}
