/** Read first-party Next flight product ingredient headings as inert data. */
const MAX_HTML = 2_000_000;
const MAX_PUSH = 350_000;
const MAX_SCRIPTS = 160;
const MAX_ROWS = 300;
const MAX_NODES = 30_000;
const MAX_DEPTH = 48;
const MAX_PASSAGES = 12;

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizedTitle(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

function belongsToPage(productTitle: unknown, pageTitle: string): productTitle is string {
  if (typeof productTitle !== 'string' || !productTitle.trim() || productTitle.length > 220) return false;
  const expected = normalizedTitle(productTitle);
  const pageHeading = normalizedTitle(pageTitle.split('|', 1)[0] ?? '');
  // The page heading may prepend the brand, but cannot append a different
  // scent, strength, or named variant to the embedded product's title.
  return expected.length >= 12 && (pageHeading === expected || pageHeading === `aveeno ${expected}`);
}

function headingText(value: unknown): string | null {
  if (!object(value) || value.type !== 'heading' || !object(value.attrs)
    || value.attrs.level !== 5 || !Array.isArray(value.content) || value.content.length > 8) return null;
  const pieces: string[] = [];
  for (const part of value.content) {
    if (!object(part) || part.type !== 'text' || typeof part.text !== 'string') return null;
    pieces.push(part.text);
  }
  const text = pieces.join('').replace(/\u200b/g, '').replace(/\s*\|\s*Hero Ingredient\s*$/i, '')
    .normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!text || text.length > 160 || !/[\p{L}]/u.test(text)
    || /[<>\x00-\x1f\x7f]/.test(text)) return null;
  return text;
}

function isConcentrationGroup(value: Record<string, unknown>): boolean {
  if (!Array.isArray(value.content) || value.content.length !== 1
    || !object(value.content[0]) || typeof value.content[0].text !== 'string') return false;
  return /^\s*[<~]\s*\d+(?:\.\d+)?%\s+[\p{L}\s]{1,100}\s*$/u.test(value.content[0].text.replace(/\u200b/g, ''));
}

function passage(value: Record<string, unknown>, pageTitle: string): string | null {
  if (value.id !== 'product-overview' || !object(value.product)
    || !belongsToPage(value.product.title, pageTitle) || !object(value.accordion)
    || !Array.isArray(value.accordion.items)) return null;
  const ingredients = value.accordion.items.find(item => object(item) && item.id === 'ingredients');
  if (!object(ingredients) || !object(ingredients.slotContent)
    || ingredients.slotContent.type !== 'doc' || !Array.isArray(ingredients.slotContent.content)
    || ingredients.slotContent.content.length > 240) return null;
  const names: string[] = [];
  for (const block of ingredients.slotContent.content) {
    if (!object(block) || block.type !== 'heading' || !object(block.attrs) || block.attrs.level !== 5) continue;
    // Some product documents mark the fragrance percentage as a level-five
    // grouping heading. It is not an ingredient; the later Fragrance heading is.
    if (isConcentrationGroup(block)) continue;
    const name = headingText(block);
    if (!name) return null;
    names.push(name);
  }
  if (names.length < 2 || names.length > 160) return null;
  const label = typeof value.product.label === 'string' && /^[\p{L}\p{N}.\s-]{1,32}$/u.test(value.product.label)
    ? ` (${value.product.label.trim()})` : '';
  const result = `${value.product.title}${label} Ingredients ${names.join(', ')}`;
  return result.length <= 16_000 ? result : null;
}

/**
 * Next Flight pushes contain JSON-encoded line records, not JavaScript to run.
 * Unknown rows, malformed JSON, and unrelated product-overview nodes abstain.
 */
export function embeddedProductIngredientText(html: string, pageTitle: string): string {
  if (typeof html !== 'string' || html.length > MAX_HTML || typeof pageTitle !== 'string'
    || pageTitle.length > 500) return '';
  const passages: string[] = [];
  const uniqueLists = new Set<string>();
  let scripts = 0, rows = 0, nodes = 0;
  const uncommented = html.replace(/<!--[\s\S]*?-->/g, ' ');
  for (const script of uncommented.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    if (++scripts > MAX_SCRIPTS) return '';
    for (const push of script[1].matchAll(/self\.__next_f\.push\(\s*(\[\s*1\s*,\s*"(?:\\.|[^"\\])*"\s*\])\s*\)/g)) {
      if (push[1].length > MAX_PUSH) continue;
      let chunk: unknown;
      try { chunk = JSON.parse(push[1]); } catch { continue; }
      if (!Array.isArray(chunk) || chunk.length !== 2 || chunk[0] !== 1 || typeof chunk[1] !== 'string') continue;
      for (const line of chunk[1].split('\n')) {
        if (++rows > MAX_ROWS) return '';
        const colon = line.indexOf(':');
        if (colon < 1 || colon > 12 || !/^[\da-f]+$/i.test(line.slice(0, colon))) continue;
        let parsed: unknown;
        try { parsed = JSON.parse(line.slice(colon + 1)); } catch { continue; }
        const pending: Array<{ value: unknown; depth: number }> = [{ value: parsed, depth: 0 }];
        while (pending.length) {
          if (++nodes > MAX_NODES) return '';
          const next = pending.pop()!;
          if (next.depth > MAX_DEPTH) continue;
          if (Array.isArray(next.value)) {
            for (const item of next.value.slice(0, 300)) pending.push({ value: item, depth: next.depth + 1 });
          } else if (object(next.value)) {
            const found = passage(next.value, pageTitle);
            if (found) {
              const list = found.slice(found.indexOf(' Ingredients ') + ' Ingredients '.length);
              if (!uniqueLists.has(list)) {
                uniqueLists.add(list);
                passages.push(found);
                if (passages.length > MAX_PASSAGES) return '';
              }
            }
            for (const item of Object.values(next.value).slice(0, 100)) {
              pending.push({ value: item, depth: next.depth + 1 });
            }
          }
        }
      }
    }
  }
  return passages.join('\n');
}
