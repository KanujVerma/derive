import type { ParsedProductLink } from './product-link-intake.ts';

export interface DailyMedLabelCandidate {
  source: 'dailymed_spl';
  sourceRecordId: string;
  sourceVersion: number;
  title: string;
  publishedDate: string;
  sourceUrl: string;
  retrievedAt: string;
  /** A published label title is not exact package, GTIN, formula, or FDA approval. */
  identityStatus: 'label_title_only';
}

export type DailyMedLinkLookup =
  | { status: 'candidate'; candidate: DailyMedLabelCandidate }
  | { status: 'no_match' | 'historical_version_unavailable' | 'rate_limited' | 'unavailable'; candidate: null };

const MAX_RESPONSE_BYTES = 32_768;

/** One bounded GET to a constructed official API URL; no submitted URL is fetched. */
export async function lookupDailyMedLink(link: Extract<ParsedProductLink, { kind: 'dailymed_label' }>, options: {
  fetcher?: typeof fetch; now?: () => Date; timeoutMs?: number;
} = {}): Promise<DailyMedLinkLookup> {
  const endpoint = new URL('https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json');
  endpoint.searchParams.set('setid', link.setId);
  endpoint.searchParams.set('pagesize', '2');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(Math.max(options.timeoutMs ?? 3_000, 1), 5_000));
  try {
    const response = await (options.fetcher ?? fetch)(endpoint, {
      method: 'GET', redirect: 'error', credentials: 'omit', signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (response.status === 404) return { status: 'no_match', candidate: null };
    if (response.status === 429) return { status: 'rate_limited', candidate: null };
    if (!response.ok || !response.body || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
      return { status: 'unavailable', candidate: null };
    }
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) return { status: 'unavailable', candidate: null };
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > MAX_RESPONSE_BYTES) return { status: 'unavailable', candidate: null };
        chunks.push(part.value);
      }
    } finally { await reader.cancel().catch(() => undefined); }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    let value: unknown;
    try { value = JSON.parse(new TextDecoder().decode(body)); } catch { return { status: 'unavailable', candidate: null }; }
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { status: 'unavailable', candidate: null };
    const data = (value as Record<string, unknown>).data;
    if (!Array.isArray(data) || data.length === 0) return { status: 'no_match', candidate: null };
    if (data.length !== 1) return { status: 'unavailable', candidate: null };
    const item = data[0];
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { status: 'unavailable', candidate: null };
    const record = item as Record<string, unknown>;
    const version = Number(record.spl_version);
    if (record.setid !== link.setId || !Number.isSafeInteger(version) || version < 1
        || typeof record.title !== 'string' || typeof record.published_date !== 'string') {
      return { status: 'unavailable', candidate: null };
    }
    if (link.requestedVersion && link.requestedVersion !== version) {
      return { status: 'historical_version_unavailable', candidate: null };
    }
    const title = record.title.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();
    const publishedDate = record.published_date.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    if (!title || title.length > 240 || !publishedDate || publishedDate.length > 40) {
      return { status: 'unavailable', candidate: null };
    }
    return { status: 'candidate', candidate: {
      source: 'dailymed_spl', sourceRecordId: link.setId, sourceVersion: version,
      title, publishedDate, sourceUrl: link.canonicalUrl,
      retrievedAt: (options.now ?? (() => new Date()))().toISOString(), identityStatus: 'label_title_only',
    } };
  } catch { return { status: 'unavailable', candidate: null }; }
  finally { clearTimeout(timeout); }
}
