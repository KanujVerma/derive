import { analytics } from '../analytics.ts';
import type { DiagnosticCode, DiagnosticOperation } from '../telemetry/contract.ts';

/** Maps only structured, bounded provider metadata. Never reads error.message. */
export function classifyRemoteFailure(error: unknown, operation: DiagnosticOperation): DiagnosticCode {
  if (!error || typeof error !== 'object') return 'UNKNOWN';
  const record = error as { code?: unknown; name?: unknown; status?: unknown; context?: { status?: unknown } };
  if (record.code === 'MODEL_UNAVAILABLE' || record.code === 'INTELLIGENCE_UNAVAILABLE') return 'MODEL_UNAVAILABLE';
  if (record.code === 'CATALOG_UNAVAILABLE' || record.code === 'CATALOG_TOO_LARGE') return 'CATALOG_UNAVAILABLE';
  if (record.code === 'RESOLUTION_UNAVAILABLE') return 'RESOLUTION_UNAVAILABLE';
  if (record.code === 'UNAUTHORIZED') return 'AUTH_REQUIRED';
  if (record.code === 'MEMBERSHIP_REQUIRED' || record.code === 'MEMBERSHIP_INACTIVE') return 'MEMBERSHIP_REQUIRED';
  if (record.code === 'INVALID_PAYLOAD' || record.code === 'INVALID_BARCODE') return 'INVALID_INPUT';
  if (record.code === 'INVALID_RESPONSE') return 'INVALID_RESPONSE';
  if (record.name === 'FunctionsFetchError' || record.name === 'TypeError') return 'NETWORK_UNAVAILABLE';
  const status = record.status ?? record.context?.status;
  if (status === 401 || status === 403) return 'AUTH_REQUIRED';
  if (status === 400 || status === 422) return 'INVALID_INPUT';
  if (status === 503 && (operation === 'routine_propose' || operation === 'ask' || operation === 'product_scan')) return 'MODEL_UNAVAILABLE';
  if (typeof status === 'number' && status >= 500) return 'SERVER_UNAVAILABLE';
  if (operation === 'onboarding_upload') return 'PHOTO_UPLOAD_FAILED';
  return 'UNKNOWN';
}

export function recordRemoteFailure(operation: DiagnosticOperation, error: unknown): void {
  analytics.track('diagnostic_operation', {
    operation,
    outcome: 'failure',
    errorCode: classifyRemoteFailure(error, operation),
  });
}

export function recordRemoteSuccess(operation: DiagnosticOperation): void {
  analytics.track('diagnostic_operation', { operation, outcome: 'success' });
}
