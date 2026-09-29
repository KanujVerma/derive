import { isValidGtin, normalizeBarcode } from './product-identity.ts';

/** A link names a listing or source record, never a verified package/formula. */
export type ParsedProductLink =
  | { kind: 'barcode_hint'; source: 'open_beauty_facts_url'; canonicalUrl: string; barcode: string }
  | { kind: 'dailymed_label'; source: 'dailymed'; canonicalUrl: string; setId: string; requestedVersion?: number }
  | { kind: 'amazon_listing'; source: 'amazon'; canonicalUrl: string; asin: string }
  | { kind: 'needs_details'; source: 'amazon_short_link' | 'amazon' | 'unsupported'; reason: string };

export class InvalidProductLink extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Never fetch a submitted URL; recognize only a few exact public-host layouts. */
export function parseProductLink(raw: unknown): ParsedProductLink {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 2048 || raw.trim() !== raw
      || /[\u0000-\u001f\u007f\\]/.test(raw)) throw new InvalidProductLink('A valid HTTPS product link is required');
  let url: URL;
  try { url = new URL(raw); } catch { throw new InvalidProductLink('A valid HTTPS product link is required'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !url.hostname
      || url.hostname.endsWith('.') || url.hostname.includes('%') || url.hostname === 'localhost'
      || /^\[|^\d|\.local$/.test(url.hostname)) {
    throw new InvalidProductLink('Only public HTTPS product links without credentials are accepted');
  }
  const host = url.hostname.toLowerCase();
  if (host === 'dailymed.nlm.nih.gov' || host === 'www.dailymed.nlm.nih.gov') {
    if (url.pathname !== '/dailymed/drugInfo.cfm' && url.pathname !== '/dailymed/lookup.cfm') {
      return { kind: 'needs_details', source: 'unsupported', reason: 'Unsupported DailyMed page' };
    }
    const ids = url.searchParams.getAll('setid');
    const versions = url.searchParams.getAll('version');
    if (ids.length !== 1 || !UUID.test(ids[0]!) || versions.length > 1) {
      throw new InvalidProductLink('DailyMed link needs one valid label set ID');
    }
    let requestedVersion: number | undefined;
    if (versions.length) {
      if (!/^[1-9]\d{0,5}$/.test(versions[0]!)) throw new InvalidProductLink('DailyMed label version is invalid');
      requestedVersion = Number(versions[0]);
    }
    const setId = ids[0]!.toLowerCase();
    return { kind: 'dailymed_label', source: 'dailymed', setId, requestedVersion,
      canonicalUrl: `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${setId}${requestedVersion ? `&version=${requestedVersion}` : ''}` };
  }
  if (['openbeautyfacts.org', 'www.openbeautyfacts.org', 'world.openbeautyfacts.org', 'us.openbeautyfacts.org'].includes(host)) {
    const match = /^\/product\/(\d{8}|\d{12,14})(?:\/[^/]*)?\/?$/.exec(url.pathname);
    const barcode = normalizeBarcode(match?.[1]);
    if (!barcode || !isValidGtin(barcode)) throw new InvalidProductLink('Open Beauty Facts link needs a valid product barcode');
    // No ODbL record or photo is fetched; the GTIN only asks Derive's own resolver.
    return { kind: 'barcode_hint', source: 'open_beauty_facts_url', barcode,
      canonicalUrl: `https://world.openbeautyfacts.org/product/${barcode}` };
  }
  if (host === 'a.co' || host === 'amzn.to') {
    return { kind: 'needs_details', source: 'amazon_short_link', reason: 'Expand the short link or enter the product name' };
  }
  if (['amazon.com', 'www.amazon.com', 'smile.amazon.com'].includes(host)) {
    const match = /^(?:\/dp\/|\/gp\/product\/|\/gp\/aw\/d\/)([A-Za-z0-9]{10})(?:\/|$)/.exec(url.pathname);
    if (!match) return { kind: 'needs_details', source: 'amazon', reason: 'Enter the product name or photograph the label' };
    const asin = match[1]!.toUpperCase();
    return { kind: 'amazon_listing', source: 'amazon', asin, canonicalUrl: `https://www.amazon.com/dp/${asin}` };
  }
  return { kind: 'needs_details', source: 'unsupported', reason: 'Enter the product name or photograph the label' };
}
