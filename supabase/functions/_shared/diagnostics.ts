/** Opaque, single-operation trace IDs. No identity or request content enters logs. */
export const TRACE_HEADER = "x-derive-trace-id";
export const ERROR_CODE_HEADER = "x-derive-error-code";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;

export function validTraceId(value: unknown): value is string {
  return typeof value === "string" && UUID_V4.test(value);
}

export function diagnosticErrorHeaders(code: string): Record<string, string> {
  return { [ERROR_CODE_HEADER]: SAFE_CODE.test(code) ? code : "UNKNOWN" };
}

/** Adds a validated trace to the response and writes only bounded failure metadata. */
export async function withDiagnosticResponse(
  req: Request,
  operation: string,
  handle: () => Promise<Response>,
): Promise<Response> {
  const received = req.headers.get(TRACE_HEADER);
  const traceId = validTraceId(received) ? received : crypto.randomUUID();
  const response = await handle();
  const headers = new Headers(response.headers);
  headers.set(TRACE_HEADER, traceId);
  headers.set("Access-Control-Expose-Headers", `${TRACE_HEADER}, ${ERROR_CODE_HEADER}`);

  if (response.status >= 400) {
    const claimedCode = headers.get(ERROR_CODE_HEADER);
    const code = claimedCode && SAFE_CODE.test(claimedCode) ? claimedCode : "UNKNOWN";
    console.error("derive_operation_failure", JSON.stringify({
      operation,
      trace_id: traceId,
      status: response.status,
      code,
    }));
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
