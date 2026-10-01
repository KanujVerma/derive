/** Free official label evidence. A name match is not a verified barcode/formula match. */
export type DailyMedIngredientQuery = { barcode: string; name: string; brand: string | null; size: string | null };
export type DailyMedIngredientResult = {
  status: 'found' | 'not_found' | 'incomplete' | 'unavailable' | 'rate_limited' | 'ambiguous';
  evidence?: {
    source: 'dailymed'; sourceUrl: string; sourceLicense: 'DailyMed-public-label'; retrievedAt: string;
    sourceModifiedAt: string | null; barcode: string | null; productName: string; brand: string | null;
    quantity: string | null; ingredientsText: string; matchBasis: 'name_variant';
    formulaVerified: false; canonicalProductId: null;
  };
};

const ORIGIN = 'https://dailymed.nlm.nih.gov';
const MAX_JSON = 65_536;
const MAX_XML = 600_000;
const MAX_CANDIDATES = 6;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
const normalized = (s: string) => s.toLowerCase().replace(/\bspf\s*(\d+)/g, 'spf $1')
  .replace(/\bface\s*(\d+)\b/g, 'face $1')
  .replace(/\bmoistur(?:izing|ising|izer|iser)\b/g, 'moistur').replace(/[^a-z0-9]+/g, ' ').trim();
const filler = new Set(['the', 'and', 'with', 'for', 'of', 'a', 'an', 'oz', 'ounce', 'ounces', 'fl', 'fluid', 'ml', 'g', 'gram', 'grams', 'pack', 'count', 'ct', 'size']);

function nameTokens(query: DailyMedIngredientQuery): string[] {
  const withoutQuantity = query.name.replace(/\b\d+(?:\.\d+)?\s*(?:fl\.?\s*)?(?:oz\b|ounces?\b|ml\b|grams?\b|g\b)/gi, ' ');
  return normalized(withoutQuantity).split(' ').filter(t => t && !filler.has(t));
}

async function boundedText(response: Response, max: number): Promise<string> {
  const length = response.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > max)) throw new Error('size');
  if (!response.body) throw new Error('body');
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > max) throw new Error('size');
      parts.push(part.value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  const joined = new Uint8Array(bytes);
  let offset = 0;
  for (const part of parts) { joined.set(part, offset); offset += part.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(joined);
}

type XmlNode = { tag: string; attrs: Record<string, string>; children: Array<XmlNode | string> };
function decode(s: string): string {
  if (/&(?![^;\s]+;)/.test(s)) throw new Error('entity');
  return s.replace(/&([^;\s]+);/g, (_, name: string) => {
    const predefined: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (name in predefined) return predefined[name];
    const numeric = /^#(?:x([0-9a-f]+)|(\d+))$/i.exec(name);
    if (!numeric) throw new Error('entity');
    const point = numeric[1] ? parseInt(numeric[1], 16) : Number(numeric[2]);
    if (!Number.isSafeInteger(point) || point < 32 && ![9, 10, 13].includes(point)
      || point > 0x10ffff || point >= 0xd800 && point <= 0xdfff) throw new Error('entity');
    return String.fromCodePoint(point);
  });
}

/** Small non-validating XML reader: no DTD, entities, remote references, or regex nesting. */
function parseXml(xml: string): XmlNode {
  if (xml.length > MAX_XML || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('xml');
  const root: XmlNode = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  const tokens = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<[^>]*>|[^<]+/gy;
  let cursor = 0;
  let count = 0;
  while (cursor < xml.length) {
    tokens.lastIndex = cursor;
    const match = tokens.exec(xml);
    if (!match || ++count > 30_000) throw new Error('xml');
    cursor = tokens.lastIndex;
    const part = match[0];
    const parent = stack[stack.length - 1];
    if (part.startsWith('<!--') || part.startsWith('<?xml')) continue;
    if (part.startsWith('<?') || part.startsWith('<!') && !part.startsWith('<![CDATA[')) throw new Error('xml');
    if (part.startsWith('<![CDATA[')) { parent.children.push(part.slice(9, -3)); continue; }
    if (!part.startsWith('<')) { parent.children.push(decode(part)); continue; }
    const end = /^<\/([\w:.-]+)\s*>$/.exec(part);
    if (end) {
      if (stack.length === 1 || parent.tag !== end[1]) throw new Error('xml');
      stack.pop(); continue;
    }
    const start = /^<([\w:.-]+)((?:\s+[\s\S]*?)?)\s*(\/?)>$/.exec(part);
    if (!start) throw new Error('xml');
    const attrs: Record<string, string> = {};
    let rest = start[2].trim();
    while (rest) {
      const attr = /^([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')\s*/.exec(rest);
      if (!attr || attr[1] in attrs) throw new Error('xml');
      attrs[attr[1]] = decode(attr[2] ?? attr[3]);
      rest = rest.slice(attr[0].length);
    }
    const node: XmlNode = { tag: start[1], attrs, children: [] };
    parent.children.push(node);
    if (!start[3]) { stack.push(node); if (stack.length > 60) throw new Error('xml'); }
  }
  if (stack.length !== 1) throw new Error('xml');
  const documents = root.children.filter((n): n is XmlNode => typeof n !== 'string');
  if (documents.length !== 1 || localName(documents[0]) !== 'document'
    || root.children.some(n => typeof n === 'string' && n.trim())) throw new Error('xml');
  return documents[0];
}
const localName = (n: XmlNode) => n.tag.split(':').pop();
const children = (n: XmlNode) => n.children.filter((c): c is XmlNode => typeof c !== 'string');
function text(n: XmlNode): string {
  const block = new Set(['paragraph', 'br', 'tr', 'td', 'th', 'item', 'title']);
  return n.children.map(c => typeof c === 'string' ? c : text(c) + (block.has(localName(c) ?? '') ? '\n' : '')).join('');
}
function descendants(n: XmlNode, tag: string): XmlNode[] {
  const found: XmlNode[] = [];
  for (const c of children(n)) { if (localName(c) === tag) found.push(c); found.push(...descendants(c, tag)); }
  return found;
}
function extractIngredients(xml: string, expectedSetId: string): { status: 'found' | 'incomplete' | 'ambiguous'; text?: string } {
  const doc = parseXml(xml);
  const documentSetId = children(doc).find(n => localName(n) === 'setId')?.attrs.root;
  if (documentSetId?.toLowerCase() !== expectedSetId.toLowerCase()) throw new Error('identity');
  const active = new Set<string>();
  const inactive = new Set<string>();
  for (const section of descendants(doc, 'section')) {
    const fields = children(section);
    const code = fields.find(n => localName(n) === 'code')?.attrs.code;
    const title = normalized(text(fields.find(n => localName(n) === 'title') ?? { tag: 'title', attrs: {}, children: [] }));
    const kind = code === '55106-9' || /^active ingredients?$/.test(title) ? active
      : code === '51727-6' || /^inactive ingredients?$/.test(title) ? inactive : null;
    const narrative = fields.find(n => localName(n) === 'text');
    if (kind && narrative) {
      const value = text(narrative).split('\n').map(clean).filter(Boolean).join('\n');
      if (value && value.length <= 12_000) kind.add(value);
    }
  }
  if (active.size > 1 || inactive.size > 1) return { status: 'ambiguous' };
  if (active.size !== 1 || inactive.size !== 1) return { status: 'incomplete' };
  const declaration = `Active ingredients:\n${[...active][0]}\n\nInactive ingredients:\n${[...inactive][0]}`;
  return declaration.length > 24_000 ? { status: 'incomplete' } : { status: 'found', text: declaration };
}

export async function lookupDailyMedIngredients(query: DailyMedIngredientQuery,
  options: { fetch?: typeof fetch; now?: () => Date } = {}): Promise<DailyMedIngredientResult> {
  if (!query || typeof query.name !== 'string' || query.name.length > 240 || !clean(query.name)
    || query.brand !== null && (typeof query.brand !== 'string' || query.brand.length > 100)) return { status: 'incomplete' };
  const tokens = nameTokens(query);
  const brandTokens = normalized(query.brand ?? '').split(' ').filter(Boolean);
  if (tokens.filter(t => !brandTokens.includes(t)).length < 2) return { status: 'incomplete' };
  // API drug_name is a name substring filter. Search the first distinguishing words, then inspect qualifiers.
  // Keep a distinguishing word after a fourth-position number: "Sun Bum Face 50 Premium",
  // not the much broader "Sun Bum Face 50". This never changes final variant matching.
  const searchTokens = /\banti[\s-]*dandruff\b/i.test(query.name) ? tokens.slice(0, 1)
    : tokens.slice(0, /^\d+$/.test(tokens[3] ?? '') ? 5 : 4);
  const url = new URL(`${ORIGIN}/dailymed/services/v2/spls.json`);
  url.searchParams.set('drug_name', searchTokens.join(' '));
  url.searchParams.set('pagesize', String(MAX_CANDIDATES));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  const request = (endpoint: URL) => (options.fetch ?? fetch)(endpoint, { method: 'GET', redirect: 'error',
    // DailyMed's SPL detail endpoint rejects Accept: application/xml despite returning XML.
    credentials: 'omit', signal: controller.signal, headers: { Accept: endpoint.pathname.endsWith('.xml') ? '*/*' : 'application/json' } });
  try {
    const response = await request(url);
    if (response.status === 429) return { status: 'rate_limited' };
    if (response.status === 404) return { status: 'not_found' };
    if (!response.ok || !/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) return { status: 'unavailable' };
    const body: unknown = JSON.parse(await boundedText(response, MAX_JSON));
    if (!body || typeof body !== 'object' || Array.isArray(body)) return { status: 'unavailable' };
    const record = body as Record<string, unknown>;
    if (!Array.isArray(record.data) || record.data.length > MAX_CANDIDATES) return { status: 'unavailable' };
    if (record.data.length === 0) return { status: 'not_found' };
    const metadata = record.metadata as Record<string, unknown> | undefined;
    if (!metadata || !Number.isSafeInteger(Number(metadata.total_elements))) return { status: 'ambiguous' };
    if (Number(metadata.total_elements) < record.data.length) return { status: 'unavailable' };
    if (Number(metadata.total_elements) > MAX_CANDIDATES) return { status: 'ambiguous' };
    const matches = record.data.filter((r: unknown): r is Record<string, unknown> => {
      if (!r || typeof r !== 'object' || Array.isArray(r)) return false;
      const item = r as Record<string, unknown>;
      if (typeof item.title !== 'string' || item.title.length > 500 || typeof item.setid !== 'string' || !UUID.test(item.setid)) return false;
      const titleTokens = new Set(normalized(item.title.split('[')[0]).split(' '));
      const spf = /\bspf\s*(\d+)/i.exec(query.name)?.[1];
      if (spf && !new RegExp(`\\bspf\\s+${spf}\\b`).test(normalized(item.title))) return false;
      return tokens.every(t => titleTokens.has(t)) && brandTokens.every(t => titleTokens.has(t));
    });
    if (matches.length === 0) return { status: 'not_found' };
    if (matches.length > 1) return { status: 'ambiguous' };
    const label = matches[0];
    const xmlUrl = new URL(`${ORIGIN}/dailymed/services/v2/spls/${label.setid as string}.xml`);
    const xmlResponse = await request(xmlUrl);
    if (xmlResponse.status === 429) return { status: 'rate_limited' };
    if (!xmlResponse.ok || !/^(?:application|text)\/xml(?:\s*;|$)/i.test(xmlResponse.headers.get('content-type') ?? '')) return { status: 'unavailable' };
    const extracted = extractIngredients(await boundedText(xmlResponse, MAX_XML), label.setid as string);
    if (extracted.status !== 'found' || !extracted.text) return { status: extracted.status };
    const modifiedDate = typeof label.published_date === 'string' && /^[A-Z][a-z]{2} \d{2}, \d{4}$/.test(label.published_date)
      ? new Date(`${label.published_date} 00:00:00 UTC`) : null;
    return { status: 'found', evidence: {
      source: 'dailymed', sourceUrl: `${ORIGIN}/dailymed/drugInfo.cfm?setid=${label.setid as string}`,
      sourceLicense: 'DailyMed-public-label', retrievedAt: (options.now ?? (() => new Date()))().toISOString(),
      sourceModifiedAt: modifiedDate && Number.isFinite(modifiedDate.getTime()) ? modifiedDate.toISOString() : null,
      barcode: null, productName: clean(label.title as string), brand: query.brand, quantity: null,
      ingredientsText: extracted.text, matchBasis: 'name_variant', formulaVerified: false, canonicalProductId: null,
    } };
  } catch { return { status: 'unavailable' }; }
  finally { clearTimeout(timeout); }
}
