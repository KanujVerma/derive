/**
 * Candidate-only OTC sunscreen label lookup. This module is deliberately not
 * wired into Check: callers must explicitly enable it after release review.
 * A UPC/GTIN is never accepted as an NDC, and returned label text is never
 * canonical package/formula truth or medical advice.
 */

export type OtcSunscreenLabelQuery =
  | { kind: "exact_brand_name"; value: string }
  | { kind: "segmented_ndc"; value: string };

export interface OtcLabelCandidate {
  source: "openfda_drug_label";
  sourceRecordId: string;
  splSetId: string;
  effectiveTime: string;
  brandName: string;
  productNdcs: string[];
  packageNdcs: string[];
  activeIngredientLabelText: string[];
  inactiveIngredientLabelText: string[];
  sourceUrl: string;
  fetchedAt: string;
  dailyMed?: {
    source: "dailymed_spl";
    splVersion: number;
    publishedDate: string;
    sourceUrl: string;
  };
}

export type OtcLabelLookupResult =
  | { status: "disabled" | "invalid_input" | "configuration_required" | "no_match" | "provider_error"; candidates: [] }
  | { status: "candidates"; candidates: OtcLabelCandidate[]; truncated: boolean };

export interface OtcLabelLookupOptions {
  /** Remains off unless the server-side caller opts in. */
  enabled?: boolean;
  /** Server-only openFDA key. Never pass it from a mobile client. */
  apiKey?: string;
  fetcher?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
}

const FDA_URL = "https://api.fda.gov/drug/label.json";
const DAILYMED_URL = "https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json";
const MAX_RESULTS = 3;
const MAX_RESPONSE_BYTES = 512 * 1024;
const MAX_TIMEOUT_MS = 5000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Segments are required: a bare 12-digit UPC must never turn into an NDC.
const SEGMENTED_NDC = /^\d{4,5}-\d{3,4}(?:-\d{1,2})?$/;

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function strings(value: unknown, maxItems = 8): string[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems).filter((item): item is string => typeof item === "string")
    .map((item) => item.trim()).filter(Boolean);
}

function normalizedName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function safeQuery(query: OtcSunscreenLabelQuery): string | undefined {
  if (query.kind === "segmented_ndc") {
    return SEGMENTED_NDC.test(query.value) ? query.value : undefined;
  }
  if (query.kind !== "exact_brand_name") return undefined;
  const value = query.value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (value.length < 5 || value.length > 120 || !/^[\p{L}\p{N} .,'/&()+%\-]+$/u.test(value)) return undefined;
  return value;
}

function sourceUrl(setId: string): string {
  return `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${encodeURIComponent(setId)}`;
}

function fdaRecordUrl(id: string): string {
  const url = new URL(FDA_URL);
  url.searchParams.set("search", `id:"${id}"`);
  url.searchParams.set("limit", "1");
  return url.toString();
}

async function boundedJson(url: string, apiKey: string | undefined, fetcher: typeof fetch, timeoutMs: number): Promise<{ status: number; body?: JsonRecord }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(Math.max(timeoutMs, 1), MAX_TIMEOUT_MS));
  try {
    const headers = apiKey ? { Authorization: `Basic ${btoa(`${apiKey}:`)}` } : undefined;
    const response = await fetcher(url, { headers, signal: controller.signal, redirect: "error" });
    if (response.status === 404) return { status: 404 };
    if (!response.ok || !response.body) return { status: response.status };
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) return { status: 413 };
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_RESPONSE_BYTES) return { status: 413 };
        chunks.push(value);
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { status: response.status, body: record(JSON.parse(new TextDecoder().decode(bytes))) };
  } catch {
    return { status: 502 };
  } finally {
    clearTimeout(timer);
  }
}

function candidateFrom(raw: unknown, query: OtcSunscreenLabelQuery, exactValue: string, fetchedAt: string): OtcLabelCandidate | undefined {
  const label = record(raw);
  const fda = record(label?.openfda);
  if (!label || !fda || typeof label.id !== "string" || !UUID.test(label.id)
      || typeof label.set_id !== "string" || !UUID.test(label.set_id)
      || typeof label.effective_time !== "string" || !/^\d{8}$/.test(label.effective_time)) return undefined;
  if (!strings(fda.product_type).includes("HUMAN OTC DRUG")) return undefined;
  const names = strings(fda.brand_name);
  const productNdcs = strings(fda.product_ndc);
  const packageNdcs = strings(fda.package_ndc);
  const matched = query.kind === "exact_brand_name"
    ? names.some((name) => normalizedName(name) === normalizedName(exactValue))
    : [...productNdcs, ...packageNdcs].includes(exactValue);
  if (!matched || names.length === 0) return undefined;
  const matchedName = query.kind === "exact_brand_name"
    ? names.find((name) => normalizedName(name) === normalizedName(exactValue))!
    : names[0]!;
  const sunscreenText = [...names, ...strings(label.purpose), ...strings(label.active_ingredient)].join(" ");
  if (!/sunscreen/i.test(sunscreenText)) return undefined;
  return {
    source: "openfda_drug_label",
    sourceRecordId: label.id,
    splSetId: label.set_id,
    effectiveTime: label.effective_time,
    brandName: matchedName,
    productNdcs,
    packageNdcs,
    activeIngredientLabelText: strings(label.active_ingredient, 16),
    inactiveIngredientLabelText: strings(label.inactive_ingredient, 16),
    sourceUrl: fdaRecordUrl(label.id),
    fetchedAt,
  };
}

/** At most two bounded GETs (openFDA, then DailyMed for one unambiguous set ID). */
export async function lookupOtcSunscreenLabelCandidates(
  query: OtcSunscreenLabelQuery,
  options: OtcLabelLookupOptions = {},
): Promise<OtcLabelLookupResult> {
  if (!options.enabled) return { status: "disabled", candidates: [] };
  const value = safeQuery(query);
  if (!value) return { status: "invalid_input", candidates: [] };
  if (!options.apiKey?.trim()) return { status: "configuration_required", candidates: [] };

  const search = query.kind === "exact_brand_name"
    ? `openfda.brand_name.exact:"${value}"`
    : `openfda.${value.split("-").length === 3 ? "package_ndc" : "product_ndc"}.exact:"${value}"`;
  const url = new URL(FDA_URL);
  url.searchParams.set("search", search);
  url.searchParams.set("limit", String(MAX_RESULTS));
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 3000;
  const response = await boundedJson(url.toString(), options.apiKey, fetcher, timeoutMs);
  if (response.status === 404) return { status: "no_match", candidates: [] };
  if (response.status !== 200 || !response.body) return { status: "provider_error", candidates: [] };
  const results = response.body.results;
  if (!Array.isArray(results)) return { status: "provider_error", candidates: [] };
  const fetchedAt = (options.now ?? (() => new Date()))().toISOString();
  const candidates = results.map((entry) => candidateFrom(entry, query, value, fetchedAt))
    .filter((entry): entry is OtcLabelCandidate => Boolean(entry));
  if (candidates.length === 0) return { status: "no_match", candidates: [] };
  const total = record(record(response.body.meta)?.results)?.total;
  const truncated = typeof total !== "number" || !Number.isFinite(total) || total > MAX_RESULTS;

  // DailyMed is a version/provenance cross-check, not a source of formula truth.
  if (candidates.length === 1 && !truncated) {
    const dailyUrl = new URL(DAILYMED_URL);
    dailyUrl.searchParams.set("setid", candidates[0]!.splSetId);
    dailyUrl.searchParams.set("pagesize", "2");
    const daily = await boundedJson(dailyUrl.toString(), undefined, fetcher, timeoutMs);
    if (daily.status === 200 && Array.isArray(daily.body?.data)) {
      const matches = daily.body.data.map(record).filter((item) => item?.setid === candidates[0]!.splSetId);
      const match = matches.length === 1 ? matches[0] : undefined;
      if (match && Number.isSafeInteger(match.spl_version) && (match.spl_version as number) > 0
          && typeof match.published_date === "string") {
        candidates[0]!.dailyMed = {
          source: "dailymed_spl",
          splVersion: match.spl_version as number,
          publishedDate: match.published_date,
          sourceUrl: sourceUrl(candidates[0]!.splSetId),
        };
      }
    }
  }
  return { status: "candidates", candidates, truncated };
}
