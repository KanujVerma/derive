import { analytics } from '../analytics.ts';
import type { DiagnosticCode, DiagnosticOperation } from '../telemetry/contract.ts';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Expo supplies the secure native fallback when Hermes lacks Web Crypto. */
export async function createDiagnosticTraceId(): Promise<string | null> {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
    const crypto = await import('expo-crypto');
    return crypto.randomUUID();
  } catch {
    // Diagnostics are optional; never substitute Math.random for an opaque ID.
    return null;
  }
}

export function diagnosticRequestHeaders(traceId: string | null): Record<string, string> {
  return traceId && UUID_V4.test(traceId) ? { 'x-derive-trace-id': traceId } : {};
}

function responseHeader(error: unknown, name: string): string | null {
  if (!error || typeof error !== 'object') return null;
  const context = (error as { context?: unknown }).context;
  if (!context || typeof context !== 'object') return null;
  const headers = (context as { headers?: { get?: (name: string) => string | null } }).headers;
  if (typeof headers?.get !== 'function') return null;
  try { return headers.get(name); } catch { return null; }
}

function safeTraceId(error: unknown, fallback?: string | null): string | undefined {
  const echoed = responseHeader(error, 'x-derive-trace-id');
  if (echoed && UUID_V4.test(echoed)) return echoed;
  return fallback && UUID_V4.test(fallback) ? fallback : undefined;
}

/** Maps only structured, bounded provider metadata. Never reads error.message. */
export function classifyRemoteFailure(error: unknown, operation: DiagnosticOperation): DiagnosticCode {
  if (!error || typeof error !== 'object') return 'UNKNOWN';
  const record = error as { code?: unknown; name?: unknown; status?: unknown; context?: { status?: unknown } };
  const serverCode = responseHeader(error, 'x-derive-error-code');
  const code = serverCode ?? record.code;
  if (code === 'MODEL_UNAVAILABLE' || code === 'INTELLIGENCE_UNAVAILABLE' || code === 'MODEL_INVALID_OUTPUT' || code === 'MODEL_OUTPUT_INVALID') return 'MODEL_UNAVAILABLE';
  if (code === 'CATALOG_UNAVAILABLE' || code === 'CATALOG_TOO_LARGE') return 'CATALOG_UNAVAILABLE';
  if (code === 'RESOLUTION_UNAVAILABLE' || code === 'PRODUCT_IDENTITY_UNRESOLVED') return 'RESOLUTION_UNAVAILABLE';
  if (code === 'UNAUTHORIZED') return 'AUTH_REQUIRED';
  if (code === 'MEMBERSHIP_REQUIRED' || code === 'MEMBERSHIP_INACTIVE') return 'MEMBERSHIP_REQUIRED';
  if (code === 'INVALID_PAYLOAD' || code === 'INVALID_BARCODE' || code === 'INVALID_INTAKE') return 'INVALID_INPUT';
  if (code === 'PHOTO_VERIFICATION_FAILED') return 'PHOTO_UPLOAD_FAILED';
  if (code === 'INVALID_RESPONSE') return 'INVALID_RESPONSE';
  if (record.name === 'FunctionsFetchError' || record.name === 'TypeError') return 'NETWORK_UNAVAILABLE';
  const status = record.status ?? record.context?.status;
  if (status === 401 || status === 403) return 'AUTH_REQUIRED';
  if (status === 400 || status === 422) return 'INVALID_INPUT';
  if (status === 503 && (operation === 'routine_propose' || operation === 'ask' || operation === 'product_scan')) return 'MODEL_UNAVAILABLE';
  if (typeof status === 'number' && status >= 500) return 'SERVER_UNAVAILABLE';
  if (operation === 'onboarding_upload') return 'PHOTO_UPLOAD_FAILED';
  return 'UNKNOWN';
}

export function recordRemoteFailure(operation: DiagnosticOperation, error: unknown, traceId?: string | null): void {
  analytics.track('diagnostic_operation', {
    operation,
    outcome: 'failure',
    errorCode: classifyRemoteFailure(error, operation),
    traceId: safeTraceId(error, traceId),
    buildFlavor: process.env.EXPO_PUBLIC_BUILD_FLAVOR,
  });
}

export function recordRemoteSuccess(operation: DiagnosticOperation): void {
  analytics.track('diagnostic_operation', {
    operation, outcome: 'success', buildFlavor: process.env.EXPO_PUBLIC_BUILD_FLAVOR,
  });
}
