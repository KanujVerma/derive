import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildWebIngredientSearchQuery, buildWebIngredientFallbackQuery, ingredientPageText, lookupWebProductIngredients, parseWebIngredientExtraction,
  parseWebProductIngredientsRequest, safeIngredientPageUrl, sameIngredientProduct, rememberedIngredientCandidates }
  from '../supabase/functions/_shared/web-product-ingredients.ts';
import { handlePrivateWebProductIngredients } from '../supabase/functions/private-web-product-ingredients/handler.ts';
import type { IngredientWebPage } from '../supabase/functions/_shared/web-product-ingredients.ts';
import { namedIngredientBrand } from '../src/contracts/WebProductIngredients.ts';

const query = { barcode: '0012044038840', name: 'Old Spice High Endurance Fresh Scent Deodorant for Men 3.0 Oz',
  brand: 'Old Spice', size: '3 oz' };
const title = 'Old Spice High Endurance Fresh Deodorant';
const list = 'Water, Propylene Glycol, Sodium Stearate, Fragrance.';
const pageUrl = 'https://www.target.com/p/old-spice-fresh/-/A-123456';
const html = `<html><head><title>${title}</title><script>Secret fabricated formula</script><style>.bad{display:none}</style></head>
  <body><nav>Unrelated other product</nav><h1>${title}</h1><p>Ingredients: ${list}</p></body></html>`;
const page: IngredientWebPage = { url: pageUrl, title, text: `${title} Ingredients: ${list}` };
const extracted = { status: 'found', sourceIndex: 0, productName: title, ingredientsText: list };
const provider = (value: unknown = extracted) => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] });
const keys = { serpApiKey: 'fixture-search-key', geminiApiKey: 'fixture-model-key', reserveRequest: async (): Promise<'reserved'> => 'reserved' };
const searchPayload = (organic_results: { link: string }[], q = buildWebIngredientSearchQuery(query)) => ({
  search_parameters: { engine: 'google_light', q },
  organic_results,
});

const oldSpiceSmartLabel = { fields: {
  gtin: '00012044038840', brandName: 'Old Spice',
  productName: 'Old Spice High Endurance Deodorant for Men, Aluminum Free, Fresh Scent, 3.0 oz',
  ingredientList: ['Dipropylene Glycol', 'Water', 'Propylene Glycol', 'Sodium Stearate',
    'Poloxamine 1307', 'PPG-3 Myristyl Ether', 'Fragrance', 'Tetrasodium EDTA', 'Violet 2', 'Green 6']
    .map(ingredientName => ({ ingredientName, ingredientType: 'INGREDIENTS',
      subIngredients: ingredientName === 'Fragrance' ? [{ ingredientName: 'Cinnamal' }] : [] })),
} };

test('exact-GTIN Old Spice SmartLabel supplies transient top-level published ingredients without search or formula promotion', async () => {
  const urls: string[] = [];
  const result = await lookupWebProductIngredients(query, { ...keys, preferManufacturerSearch: true,
    now: () => new Date('2026-10-01T00:00:00.000Z'),
    fetcher: async (url, init) => {
      urls.push(String(url));
      assert.equal(init?.redirect, 'error'); assert.ok(init?.signal);
      assert.equal(String(url), 'https://az-na-smartlabel-prod-functionapp-api.pgcloud.com/api/getproductdetails?gtin=00012044038840');
      return new Response(JSON.stringify(oldSpiceSmartLabel), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    } });
  assert.equal(urls.length, 1);
  assert.equal(result.status, 'found');
  if (result.status === 'found') {
    assert.equal(result.evidence.sourceUrl, 'https://smartlabel.pg.com/00012044038840.html');
    assert.equal(result.evidence.sourceName, 'smartlabel.pg.com');
    assert.equal(result.evidence.formulaVerified, false);
    assert.equal(result.evidence.basis, 'published_web');
    assert.match(result.evidence.ingredientsText, /Sodium Stearate, Poloxamine 1307, PPG-3 Myristyl Ether/);
    assert.doesNotMatch(result.evidence.ingredientsText, /Cinnamal/);
  }
});

test('SmartLabel exact GTIN, brand, title/form, and complete top-level list are all mandatory', async () => {
  const malformed = [
    { ...oldSpiceSmartLabel, fields: { ...oldSpiceSmartLabel.fields, gtin: '00012044038841' } },
    { ...oldSpiceSmartLabel, fields: { ...oldSpiceSmartLabel.fields, brandName: 'Other Brand' } },
    { ...oldSpiceSmartLabel, fields: { ...oldSpiceSmartLabel.fields,
      productName: 'Old Spice High Endurance Fresh Antiperspirant and Deodorant' } },
    { ...oldSpiceSmartLabel, fields: { ...oldSpiceSmartLabel.fields, ingredientList: [
      oldSpiceSmartLabel.fields.ingredientList[0], { ingredientName: '', ingredientType: 'INGREDIENTS' }] } },
    { ...oldSpiceSmartLabel, fields: { ...oldSpiceSmartLabel.fields, ingredientList: [
      oldSpiceSmartLabel.fields.ingredientList[0], { ingredientName: 'Water', ingredientType: 'ACTIVE' }] } },
  ];
  for (const payload of malformed) {
    const result = await lookupWebProductIngredients(query, { ...keys, preferManufacturerSearch: true, fetcher: async (url) => {
      if (String(url).startsWith('https://az-na-smartlabel-prod-functionapp-api.pgcloud.com/')) {
        return new Response(JSON.stringify(payload), { headers: { 'content-type': 'text/plain' } });
      }
      const q = new URL(String(url)).searchParams.get('q') ?? '';
      return new Response(JSON.stringify({ search_parameters: { q }, organic_results: [] }),
        { headers: { 'content-type': 'application/json' } });
    } });
    assert.equal(result.status, 'not_found');
  }
  assert.equal(safeIngredientPageUrl('https://smartlabel.pg.com/00012044038840.html'), null,
    'SmartLabel is a fixed-code adapter, not an arbitrary web-search fetch host');
});

test('web query is bounded valid barcode identity only, not URLs, owner, photos or skin context', () => {
  assert.deepEqual(parseWebProductIngredientsRequest(query), query);
  for (const value of [{ ...query, barcode: '12345678' }, { ...query, name: '' }, { ...query, name: 'a'.repeat(181) },
    { ...query, profile: {} }, { ...query, userId: 'owner' }, { ...query, sourceUrl: pageUrl },
    { ...query, photos: [] }, { ...query, brand: 7 }, { ...query, size: '3 oz\n' }]) {
    assert.throws(() => parseWebProductIngredientsRequest(value), /INVALID_WEB_INGREDIENT_QUERY/);
  }
});

test('explicit empty barcode permits distinctive branded name comparisons but never missing or invalid identifiers', () => {
  const named = { barcode: '', name: 'Old Spice Aqua Reef Deodorant', brand: 'Old Spice', size: null };
  assert.deepEqual(parseWebProductIngredientsRequest(named), named);
  assert.deepEqual(parseWebProductIngredientsRequest({ ...named, name: 'Aqua Reef Deodorant' }),
    { ...named, name: 'Aqua Reef Deodorant' });
  assert.deepEqual(parseWebProductIngredientsRequest({ ...named, name: 'Old Spice Aqua Reef' }),
    { ...named, name: 'Old Spice Aqua Reef' });
  const { barcode: _barcode, ...missing } = named;
  for (const value of [missing, { ...named, barcode: undefined }, { ...named, barcode: null },
    { ...named, barcode: ' ' }, { ...named, barcode: '12345678' }, { ...named, brand: null },
    { ...named, name: 'Old Spice' },
    { ...named, name: 'Old Spice Deodorant' }, { ...named, name: 'Old Spice Body Wash' },
    { ...named, name: 'Old Spice Aqua Reef Deodorant\n' }]) {
    assert.throws(() => parseWebProductIngredientsRequest(value), /INVALID_WEB_INGREDIENT_QUERY/);
  }
});

test('a remembered product name can declare its known brand without inventing form or variant', () => {
  assert.equal(namedIngredientBrand('Old Spice Aqua Reef Deodorant'), 'Old Spice');
  assert.equal(namedIngredientBrand('  AVEENO   Stress Relief Lotion '), 'Aveeno');
  assert.equal(namedIngredientBrand('Old Spiced Aqua Reef Deodorant'), null);
  assert.equal(namedIngredientBrand('My Old Spice Aqua Reef'), null);
  assert.equal(namedIngredientBrand('Aqua Reef'), null);
});

test('name-only comparisons require exact variant and role without borrowing a different formula line', () => {
  const named = { barcode: '', name: 'Old Spice Aqua Reef Deodorant', brand: 'Old Spice', size: null };
  assert.equal(sameIngredientProduct(named, 'Aqua Reef Deodorant | Old Spice'), true);
  assert.equal(sameIngredientProduct(named, 'Old Spice Aqua Reef Deodorant 3 oz'), true);
  for (const title of ['Old Spice Aqua Reef Body Wash', 'Old Spice Aqua Reef Antiperspirant Deodorant',
    'Old Spice Aqua Reef Fresh Deodorant', 'Old Spice Aqua Reef Gel Deodorant',
    'Old Spice Aqua Reef Soft Solid Deodorant', 'Old Spice Aqua Reef Deodorant Spray',
    'Old Spice Pure Sport Deodorant', 'Different Brand Aqua Reef Deodorant']) {
    assert.equal(sameIngredientProduct(named, title), false, title);
  }
});

test('name-only research skips exact-GTIN SmartLabel and returns only attributed matching ingredient data', async () => {
  const named = { barcode: '', name: 'Old Spice Aqua Reef Deodorant', brand: 'Old Spice', size: null };
  const pageName = 'Old Spice Aqua Reef Deodorant';
  const publicList = 'Water, Propylene Glycol, Sodium Stearate, Fragrance.';
  const url = 'https://www.oldspice.com/products/aqua-reef-deodorant';
  let searchCalls = 0, pageCalls = 0, reservations = 0;
  const result = await lookupWebProductIngredients(named, { ...keys, preferManufacturerSearch: true,
    reserveRequest: async () => { reservations++; return 'reserved'; }, fetcher: async (input) => {
      const target = String(input);
      assert.doesNotMatch(target, /pgcloud|gtin=/);
      if (target.startsWith('https://serpapi.com/')) {
        searchCalls++;
        return new Response(JSON.stringify({ search_parameters: { q: new URL(target).searchParams.get('q') },
          organic_results: [{ link: url }] }));
      }
      assert.equal(target, url); pageCalls++;
      return new Response(`<title>${pageName}</title><h1>${pageName}</h1>
        <script type="application/ld+json">${JSON.stringify({ '@type': 'Product', name: pageName, ingredients: publicList })}</script>`,
        { headers: { 'content-type': 'text/html' } });
    } });
  assert.equal(searchCalls, 1); assert.equal(pageCalls, 1); assert.equal(reservations, 1);
  assert.equal(result.status, 'found');
  if (result.status === 'found') {
    assert.equal(result.evidence.ingredientsText, publicList);
    assert.equal(result.evidence.sourceUrl, url);
    assert.equal(result.evidence.formulaVerified, false);
    assert.equal(result.evidence.basis, 'published_web');
  }
});

test('Aqua Reef manufacturer title aliases resolve one linked ingredient record without model extraction', async () => {
  const named = { barcode: '', name: 'Old Spice Aqua Reef Deodorant', brand: 'Old Spice', size: null };
  const heading = 'Old Spice Red Collection Deodorant for Men, Aqua Reef Scent';
  const recordName = "Old Spice Men's Aluminum-Free Deodorant, Aqua Reef, 3.0oz";
  const url = 'https://oldspice.com/shop-at-retailers/aqua-reef-deodorant/';
  const list = ['Dipropylene Glycol', 'Water', 'Propylene Glycol', 'Sodium Stearate', 'Fragrance',
    'Poloxamine 1307', 'PPG-3 Myristyl Ether', 'Tetrasodium EDTA', 'Blue 1'];
  assert.equal(sameIngredientProduct(named, heading + ' | ' + recordName + ' | Old Spice'), true);
  assert.equal(sameIngredientProduct({ ...named, name: heading }, recordName), true);
  for (const name of [recordName.replace('Aqua Reef', 'Fresh'), recordName.replace('Deodorant', 'Antiperspirant Deodorant'),
    recordName.replace('Deodorant', 'Body Wash'), recordName.replace('Deodorant', 'Gel Deodorant'),
    recordName.replace('Deodorant', 'Deodorant Spray'), recordName.replace('Deodorant', 'Clinical Deodorant')]) {
    assert.equal(sameIngredientProduct(named, name), false, name);
  }
  const calls: string[] = [];
  const result = await lookupWebProductIngredients(named, { ...keys, preferManufacturerSearch: true,
    fetcher: async input => {
      const target = String(input); calls.push(target);
      assert.doesNotMatch(target, /generativelanguage|^http:/);
      if (target.startsWith('https://serpapi.com/')) return new Response(JSON.stringify({
        search_parameters: { q: new URL(target).searchParams.get('q') }, organic_results: [{ link: url }] }));
      if (target === url) return new Response(`<title>${recordName} | Old Spice</title><h1>${heading}</h1>
        <a href="http://smartlabel.pg.com/00012044037522.html">Click here for more about the ingredients.</a>`,
        { headers: { 'content-type': 'text/html' } });
      assert.equal(target, 'https://az-na-smartlabel-prod-functionapp-api.pgcloud.com/api/getproductdetails?gtin=00012044037522');
      return new Response(JSON.stringify({ fields: { gtin: '00012044037522', brandName: 'Old Spice',
        productName: recordName, ingredientList: list.map(ingredientName => ({ ingredientName, ingredientType: 'INGREDIENTS' })) } }),
        { headers: { 'content-type': 'application/json' } });
    } });
  assert.equal(calls.length, 3);
  assert.equal(result.status, 'found');
  if (result.status === 'found') {
    assert.equal(result.evidence.ingredientsText, list.join(', '));
    assert.equal(result.evidence.sourceUrl, 'https://smartlabel.pg.com/00012044037522.html');
    assert.equal(result.evidence.formulaVerified, false);
  }
});

test('remembered branded names discover a unique published role, dedupe aliases and never borrow a variant from metadata', async () => {
  const short = { barcode: '', name: 'Old Spice Aqua Reef', brand: 'Old Spice', size: null };
  const heading = 'Old Spice Red Collection Deodorant for Men, Aqua Reef Scent';
  const recordName = "Old Spice Men's Aluminum-Free Deodorant, Aqua Reef, 3.0oz";
  const page = (title: string, path = 'aqua-reef-deodorant'): IngredientWebPage => ({
    title, url: 'https://oldspice.com/shop-at-retailers/' + path, text: title + ' Ingredients' });
  assert.deepEqual(rememberedIngredientCandidates(short, [page(heading), page(recordName)]), [{ name: heading, brand: 'Old Spice' }]);
  assert.deepEqual(rememberedIngredientCandidates(short, [page('Old Spice Fresh Deodorant | Old Spice Aqua Reef'),
    page(heading, '../../blog/aqua-reef')]), []);
  const choices = rememberedIngredientCandidates(short, [page(heading), page('Old Spice Aqua Reef Body Wash', 'wash'),
    page('Old Spice Aqua Reef Antiperspirant Deodorant', 'antiperspirant')]);
  assert.equal(choices.length, 3);
  let search = 0, model = 0;
  const result = await lookupWebProductIngredients(short, { ...keys, preferManufacturerSearch: true,
    fetcher: async input => {
      const url = String(input);
      if (url.startsWith('https://serpapi.com/')) { search++; return new Response(JSON.stringify({
        search_parameters: { q: new URL(url).searchParams.get('q') }, organic_results: [{ link: page(heading).url }] })); }
      if (url === page(heading).url) return new Response(`<h1>${heading}</h1><title>${recordName}</title>
        <a href="http://smartlabel.pg.com/00012044037522.html">Ingredients</a>`, { headers: { 'content-type': 'text/html' } });
      if (url.startsWith('https://generativelanguage')) model++;
      assert.equal(url, 'https://az-na-smartlabel-prod-functionapp-api.pgcloud.com/api/getproductdetails?gtin=00012044037522');
      return new Response(JSON.stringify({ fields: { gtin: '00012044037522', brandName: 'Old Spice', productName: recordName,
        ingredientList: ['Water', 'Propylene Glycol', 'Fragrance'].map(ingredientName => ({ ingredientName, ingredientType: 'INGREDIENTS' })) } }),
        { headers: { 'content-type': 'application/json' } });
    } });
  assert.equal(result.status, 'found'); assert.equal(search, 1); assert.equal(model, 0);
  if (result.status === 'found') assert.equal(result.evidence.formulaVerified, false);
});

test('different published product types return choices before extracting or assigning ingredients', async () => {
  const short = { barcode: '', name: 'Old Spice Aqua Reef', brand: 'Old Spice', size: null };
  const products = ['Old Spice Aqua Reef Deodorant', 'Old Spice Aqua Reef Body Wash'];
  const links = ['https://oldspice.com/shop-at-retailers/aqua-reef-deodorant/', 'https://oldspice.com/shop-at-retailers/aqua-reef-body-wash/'];
  const result = await lookupWebProductIngredients(short, { ...keys, preferManufacturerSearch: true,
    fetcher: async input => {
      const url = String(input);
      assert.doesNotMatch(url, /generativelanguage|pgcloud/);
      if (url.startsWith('https://serpapi')) return new Response(JSON.stringify({
        search_parameters: { q: new URL(url).searchParams.get('q') }, organic_results: links.map(link => ({ link })) }));
      return new Response(`<h1>${products[links.indexOf(url)]}</h1><p>Ingredients Water, Fragrance</p>`, { headers: { 'content-type': 'text/html' } });
    } });
  assert.deepEqual(result, { status: 'ambiguous', candidates: products.map(name => ({ name, brand: 'Old Spice' })) });
});

test('conflicting published lists for a named comparison remain ambiguous instead of merged', async () => {
  const named = { barcode: '', name: 'Old Spice Aqua Reef Deodorant', brand: 'Old Spice', size: null };
  const title = named.name;
  const links = ['https://www.oldspice.com/products/aqua-reef-deodorant', 'https://www.target.com/p/aqua-reef'];
  const result = await lookupWebProductIngredients(named, { ...keys, preferManufacturerSearch: true,
    fetcher: async (input) => {
      const url = String(input);
      if (url.startsWith('https://serpapi.com/')) return new Response(JSON.stringify({
        search_parameters: { q: new URL(url).searchParams.get('q') }, organic_results: links.map(link => ({ link })) }));
      const ingredients = url === links[0] ? 'Water, Glycerin, Fragrance.' : 'Water, Propylene Glycol, Fragrance.';
      return new Response(`<title>${title}</title><script type="application/ld+json">${JSON.stringify({
        '@type': 'Product', name: title, ingredients })}</script>`, { headers: { 'content-type': 'text/html' } });
    } });
  assert.equal(result.status, 'ambiguous');
});

test('an exact matching official named page may supply a SmartLabel GTIN without fetching its arbitrary link', async () => {
  const named = { barcode: '', name: oldSpiceSmartLabel.fields.productName, brand: 'Old Spice', size: null };
  const url = 'https://www.oldspice.com/products/fresh-deodorant';
  const calls: string[] = [];
  const result = await lookupWebProductIngredients(named, { ...keys, preferManufacturerSearch: true,
    fetcher: async (input) => {
      const target = String(input); calls.push(target);
      assert.ok(!target.startsWith('http:'));
      if (target.startsWith('https://serpapi.com/')) return new Response(JSON.stringify({
        search_parameters: { q: new URL(target).searchParams.get('q') }, organic_results: [{ link: url }] }));
      if (target === url) return new Response(`<title>${named.name}</title><h1>${named.name}</h1>
        <p>Ingredients</p><a href="http://smartlabel.pg.com/00012044038840.html">Ingredient details</a>`,
        { headers: { 'content-type': 'text/html' } });
      assert.equal(target, 'https://az-na-smartlabel-prod-functionapp-api.pgcloud.com/api/getproductdetails?gtin=00012044038840');
      return new Response(JSON.stringify(oldSpiceSmartLabel), { headers: { 'content-type': 'application/json' } });
    } });
  assert.equal(calls.length, 3); assert.equal(result.status, 'found');
  if (result.status === 'found') assert.equal(result.evidence.formulaVerified, false);
});

test('retailers cannot supply GTINs to the fixed manufacturer adapter', async () => {
  const named = { barcode: '', name: oldSpiceSmartLabel.fields.productName, brand: 'Old Spice', size: null };
  const url = 'https://www.target.com/p/fresh-deodorant';
  const result = await lookupWebProductIngredients(named, { ...keys, preferManufacturerSearch: true,
    fetcher: async (input) => {
      const target = String(input);
      assert.doesNotMatch(target, /pgcloud|smartlabel/);
      if (target.startsWith('https://serpapi.com/')) return new Response(JSON.stringify({
        search_parameters: { q: new URL(target).searchParams.get('q') }, organic_results: [{ link: url }] }));
      if (target === url) return new Response(`<title>${named.name}</title><p>Ingredients unavailable</p>
        <a href="http://smartlabel.pg.com/00012044038840.html">Ingredient details</a>`, { headers: { 'content-type': 'text/html' } });
      return new Response(JSON.stringify(provider({ status: 'not_found', sourceIndex: null, productName: null, ingredientsText: null })));
    } });
  assert.equal(result.status, 'not_found');
});

test('search covers manufacturer and retailer results, deduplicates brand and quantity without losing variant or SPF', () => {
  assert.equal(buildWebIngredientSearchQuery(query), query.name + ' ingredients');
  assert.equal(buildWebIngredientSearchQuery({ ...query, name: 'Daily Moisturizing Lotion', brand: 'Aveeno', size: '12 fl oz' }),
    'Aveeno Daily Moisturizing Lotion 12 fl oz ingredients');
  assert.equal(buildWebIngredientSearchQuery({ ...query, name: 'Aveeno Daily Moisturizing Lotion 12 fl oz', brand: 'Aveeno', size: 'One 12 fl oz Bottle' }),
    'Aveeno Daily Moisturizing Lotion 12 fl oz ingredients');
  assert.equal(buildWebIngredientSearchQuery({ ...query, name: 'CeraVe AM Facial Moisturizing Lotion SPF 30', brand: 'CeraVe', size: '3 oz' }),
    'CeraVe AM Facial Moisturizing Lotion SPF 30 3 oz ingredients');
  assert.equal(buildWebIngredientSearchQuery({ ...query, name: 'Old Spice High Endurance Fresh Deodorant', brand: null, size: null }),
    'Old Spice High Endurance Fresh Deodorant ingredients');
  assert.equal(buildWebIngredientSearchQuery({ ...query, name: 'Other Brand Fresh Aerosol Deodorant', brand: 'Other Brand', size: '4 oz' }),
    'Other Brand Fresh Aerosol Deodorant 4 oz ingredients');
  assert.equal(buildWebIngredientSearchQuery({ ...query, name: 'Moisturizing Cream', brand: 'https://evil.com', size: null }),
    'https://evil.com Moisturizing Cream ingredients');
});

test('only exact HTTPS approved source hosts may be fetched; private hosts and redirect/proxy URLs rejected', () => {
  for (const host of ['aveeno.com', 'www.oldspice.com', 'cerave.com', 'www.cetaphil.com', 'neutrogena.com',
    'www.target.com', 'walgreens.com', 'www.walmart.com', 'cvs.com']) {
    assert.equal(safeIngredientPageUrl('https://' + host + '/products/example#ingredients'), 'https://' + host + '/products/example');
  }
  for (const value of ['http://target.com/a', 'https://127.0.0.1/a', 'https://[::1]/a', 'https://localhost/a',
    'https://www.target.com.evil.com/a', 'https://evil.target.com/a', 'https://user:pass@target.com/a',
    'https://www.target.com:8443/a', 'https://www.target.com./a', 'https://www.target.com\\@evil.com/a',
    'https://www.target.com/redirect/a', 'https://www.target.com/fetch/a', 'https://www.target.com/a?url=http://localhost',
    'https://www.target.com/a?next=https://evil.com', 'https://www.target.com/a\n']) {
    assert.equal(safeIngredientPageUrl(value), null, value);
  }
});

test('explicit non-U.S. country routes on global brand sources are rejected', () => {
  for (const host of ['www.dove.com', 'vaseline.com']) {
    assert.equal(safeIngredientPageUrl('https://' + host + '/us/en/products/lotion'),
      'https://' + host + '/us/en/products/lotion');
    assert.equal(safeIngredientPageUrl('https://' + host + '/en-us/products/lotion'),
      'https://' + host + '/en-us/products/lotion');
    for (const route of ['/uk/en/products/lotion', '/ca/en/products/lotion', '/in/en/products/lotion', '/en-gb/products/lotion']) {
      assert.equal(safeIngredientPageUrl('https://' + host + route), null, route);
    }
  }
});

test('HTML strips executable/navigation noise and normalizes visible ingredient text and heading entities', () => {
  const result = ingredientPageText(html);
  assert.match(result.title, /Old Spice High Endurance Fresh Deodorant/);
  assert.match(result.text, /Water, Propylene Glycol/);
  assert.doesNotMatch(result.text, /Secret fabricated|Unrelated other|display:none|script|nav/);
  const entities = ingredientPageText('<title>Aveeno</title><h1>Daily Moisturizing Lotion</h1><p>Ingredients: Water,&#32;Glycerin&nbsp;&amp; Oat.</p>');
  assert.equal(entities.title, 'Daily Moisturizing Lotion | Aveeno');
  assert.match(entities.text, /Water, Glycerin & Oat\./);
});

test('short manufacturer headings match narrowly recognized UPC marketing tails without losing formula variants', () => {
  const lotion = { ...query, name: 'Aveeno Daily Moisturizing Lotion for Dry Skin 12 fl oz', brand: 'Aveeno', size: '12 fl oz' };
  assert.equal(sameIngredientProduct(lotion, 'Aveeno Daily Moisturizing Lotion'), true);
  assert.equal(sameIngredientProduct(lotion, 'Aveeno Daily Moisturizing Lotion Skin Relief'), false);
  assert.equal(sameIngredientProduct(lotion, 'Aveeno Daily Moisturizing Lotion Sheer Hydration'), false);
  assert.equal(sameIngredientProduct({ ...lotion, name: lotion.name + ' Fragrance Free' }, 'Aveeno Daily Moisturizing Lotion'), false);
  assert.equal(sameIngredientProduct({ ...lotion, name: lotion.name + ' SPF 30' }, 'Aveeno Daily Moisturizing Lotion SPF 50'), false);
  const cream = { ...query, name: 'CeraVe Moisturizing Cream Body and Face Moisturizer for Dry Skin 16 oz', brand: 'CeraVe', size: '16 oz' };
  assert.equal(sameIngredientProduct(cream, 'CeraVe Moisturizing Cream'), true);
  assert.equal(sameIngredientProduct(cream, 'CeraVe Moisturizing Lotion'), false);
  assert.equal(sameIngredientProduct({ ...cream, name: cream.name + ' 1%' }, 'CeraVe Moisturizing Cream 2%'), false);
});

test('matching Product JSON-LD recovers explicit ingredient facts without executing scripts', () => {
  const structured = { '@context': 'https://schema.org', '@type': 'Product', name: title,
    additionalProperty: [{ '@type': 'PropertyValue', name: 'Ingredients', value: list }] };
  const result = ingredientPageText(`<title>${title}</title><h1>${title}</h1>
    <script>throw Error('must not execute'); fabricated ingredients</script>
    <script type="application/ld+json">${JSON.stringify(structured)}</script>`);
  assert.equal(result.title, title + ' | ' + title);
  assert.match(result.text, /Water, Propylene Glycol, Sodium Stearate, Fragrance\./);
  assert.doesNotMatch(result.text, /throw Error|must not execute|fabricated|additionalProperty|schema.org/);
  assert.equal(parseWebIngredientExtraction(extracted, query, [{ ...page, ...result }]).status, 'found');
});

test('bounded JSON-LD graphs support explicit lists but reject unrelated variants and arbitrary metadata', () => {
  const graph = { '@graph': [
    { '@type': ['Thing', 'Product'], name: title, ingredients: list },
    { '@type': 'Product', name: 'Old Spice High Endurance Pure Sport Deodorant', ingredients: 'Wrong fragrance, Wrong list.' },
    { '@type': 'Product', name: title + ' Antiperspirant', ingredients: 'Wrong aluminum, Wrong list.' },
    { '@type': 'WebPage', name: title, ingredients: 'Wrong page metadata.' },
    { '@type': 'Product', name: title, description: 'Wrong description pretending ingredients.',
      additionalProperty: [{ name: 'Fragrance', value: 'Wrong property.' }] },
  ] };
  const result = ingredientPageText(`<title>${title}</title><script type='application/ld+json'>${JSON.stringify(graph)}</script>`);
  assert.match(result.text, /Water, Propylene Glycol/);
  assert.doesNotMatch(result.text, /Wrong|Pure Sport|Antiperspirant|description|Fragrance pretending/);
  const malformed = ingredientPageText(`<title>${title}</title><script type="application/ld+json">{broken</script>`);
  assert.doesNotMatch(malformed.text, /broken|Ingredients/);
  const inactive = ingredientPageText(`<title>${title}</title>
    <!-- <script type="application/ld+json">${JSON.stringify(graph)}</script> -->
    <script data-type="application/ld+json">${JSON.stringify(graph)}</script>`);
  assert.doesNotMatch(inactive.text, /Ingredients|Propylene|Wrong/);
  const oversized = ingredientPageText(`<title>${title}</title><script type="application/ld+json">${JSON.stringify({
    '@type': 'Product', name: title, ingredients: list, ignored: 'x'.repeat(66_000),
  })}</script>`);
  assert.doesNotMatch(oversized.text, /Ingredients|Propylene/);
});

test('structured lists remain separate source passages and do not replace conflicting formula checks', () => {
  const html = `<title>${title}</title><script type="application/ld+json">${JSON.stringify([
    { '@type': 'Product', name: title, additionalProperty: { name: 'Ingredient list', value: list } },
    { '@type': 'https://schema.org/Product', name: title, ingredients: 'Water, Glycerin, Fragrance.' },
  ])}</script>`;
  const result = ingredientPageText(html);
  assert.match(result.text, /Water, Propylene Glycol/);
  assert.match(result.text, /Water, Glycerin, Fragrance/);
  assert.equal(parseWebIngredientExtraction({ status: 'ambiguous', sourceIndex: null,
    productName: null, ingredientsText: null }, query, [{ ...page, ...result }]).status, 'ambiguous');
  assert.equal(parseWebIngredientExtraction({ ...extracted, ingredientsText: 'Water, Sodium Stearate, Glycerin.' },
    query, [{ ...page, ...result }]).status, 'not_found');
});

test('variant/form guards distinguish plain deodorant, antiperspirant, sprays, scent and SPF', () => {
  assert.equal(sameIngredientProduct(query, title), true);
  for (const name of ['Old Spice High Endurance Fresh Antiperspirant Deodorant',
    'Old Spice High Endurance Pure Sport Deodorant', 'Old Spice High Endurance Fresh Deodorant Dry Spray',
    'Old Spice High Endurance Fresh Deodorant Aerosol', 'Old Spice High Endurance Fresh Gel Deodorant', 'Old Spice Fresh Body Wash']) {
    assert.equal(sameIngredientProduct(query, name), false, name);
  }
  const sunscreen = { ...query, name: 'CeraVe AM Facial Moisturizing Lotion SPF 30', brand: 'CeraVe' };
  assert.equal(sameIngredientProduct(sunscreen, 'CeraVe AM Facial Moisturizing Lotion SPF 30'), true);
  assert.equal(sameIngredientProduct(sunscreen, 'CeraVe AM Facial Moisturizing Lotion SPF 50'), false);
  assert.equal(sameIngredientProduct(sunscreen, sunscreen.name + ' Cream'), false);
  assert.equal(sameIngredientProduct(sunscreen, 'CeraVe AM Facial Moisturizing Lotion SPF30'), true);
  assert.equal(sameIngredientProduct(sunscreen, sunscreen.name + ' | CeraVe AM Facial Moisturizing Lotion SPF 50'), false);
  assert.equal(sameIngredientProduct({ ...sunscreen, name: sunscreen.name.replace('SPF 30', 'SPF30') }, sunscreen.name), true);
  assert.equal(sameIngredientProduct(query, title + ' for Women'), false);
  const plain = { ...query, name: 'CeraVe Facial Moisturizing Lotion', brand: 'CeraVe' };
  assert.equal(sameIngredientProduct(plain, plain.name + ' SPF 30'), false);
  assert.equal(sameIngredientProduct(plain, plain.name + ' Medicated'), false);
});

test('percentage strengths remain formula distinctions instead of ignored package quantities', () => {
  const strength = { ...query, name: 'Other Brand Benzoyl Peroxide Lotion 5%', brand: 'Other Brand' };
  assert.equal(sameIngredientProduct(strength, 'Other Brand Benzoyl Peroxide Lotion 5 percent'), true);
  assert.equal(sameIngredientProduct(strength, 'Other Brand Benzoyl Peroxide Lotion 5.0%'), true);
  assert.equal(sameIngredientProduct(strength, 'Other Brand Benzoyl Peroxide Lotion 10%'), false);
  assert.equal(sameIngredientProduct(strength, 'Other Brand Benzoyl Peroxide Lotion'), false);
  const plain = { ...strength, name: 'Other Brand Moisturizing Lotion' };
  assert.equal(sameIngredientProduct(plain, 'Other Brand Moisturizing Lotion 5%'), false);
});

test('plain Aveeno lotion rejects extra named formula variants even when all requested words occur', () => {
  const lotion = { ...query, name: 'Aveeno Daily Moisturizing Lotion', brand: 'Aveeno' };
  assert.equal(sameIngredientProduct(lotion, 'Aveeno Daily Moisturizing Lotion for Dry Skin'), true);
  for (const variant of ['Sheer Hydration', 'Skin Relief', 'Eczema Therapy']) {
    assert.equal(sameIngredientProduct(lotion, 'Aveeno Daily Moisturizing ' + variant + ' Lotion'), false, variant);
  }
  const sheer = { ...lotion, name: 'Aveeno Daily Moisturizing Sheer Hydration Lotion' };
  assert.equal(sameIngredientProduct(sheer, sheer.name), true);
  assert.equal(sameIngredientProduct(sheer, lotion.name), false);
  assert.equal(parseWebIngredientExtraction({ ...extracted, productName: lotion.name }, lotion,
    [{ ...page, title: 'Aveeno Daily Moisturizing Sheer Hydration Lotion' }]).status, 'ambiguous');
});

test('contrasted formula lines are rejected across brands rather than only on Aveeno headings', () => {
  const shampoo = { ...query, name: 'Nizoral Anti-Dandruff Shampoo', brand: 'Nizoral' };
  assert.equal(sameIngredientProduct(shampoo, shampoo.name), true);
  for (const variant of ['Regrowth', 'Pet', 'Psoriasis']) {
    const heading = 'Nizoral Anti-Dandruff ' + variant + ' Shampoo';
    assert.equal(sameIngredientProduct(shampoo, heading), false, heading);
    assert.equal(sameIngredientProduct({ ...shampoo, name: heading }, heading), true, heading);
    assert.equal(parseWebIngredientExtraction({ ...extracted, productName: shampoo.name }, shampoo,
      [{ ...page, title: heading }]).status, 'ambiguous');
  }
  const conflictingHeading = title + ' | Old Spice High Endurance Pure Sport Deodorant';
  assert.equal(sameIngredientProduct(query, conflictingHeading), false);
  assert.equal(parseWebIngredientExtraction(extracted, query, [{ ...page, title: conflictingHeading }]).status, 'ambiguous');
  const plainLotion = { ...query, name: 'Other Brand Daily Moisturizing Lotion', brand: 'Other Brand' };
  for (const variant of ['Sheer Hydration', 'Skin Relief', 'Eczema']) {
    assert.equal(sameIngredientProduct(plainLotion, plainLotion.name + ' ' + variant), false, variant);
  }
});

test('model can only return a verbatim list from an indexed fetched page, not invented facts or another variant', () => {
  const result = parseWebIngredientExtraction(extracted, query, [page], new Date('2026-10-01T12:00:00Z'));
  assert.deepEqual(result, { status: 'found', evidence: { productName: title, ingredientsText: list,
    sourceUrl: pageUrl, sourceName: 'target.com', retrievedAt: '2026-10-01T12:00:00.000Z', basis: 'published_web', formulaVerified: false } });
  assert.equal(parseWebIngredientExtraction({ ...extracted, ingredientsText: 'Water, Fake Ingredient.' }, query, [page]).status, 'not_found');
  assert.equal(parseWebIngredientExtraction({ ...extracted, ingredientsText: 'Water,\nPropylene Glycol,  Sodium Stearate, Fragrance.' }, query, [page]).status, 'found');
  assert.equal(parseWebIngredientExtraction({ ...extracted, productName: title + ' Antiperspirant' }, query, [page]).status, 'ambiguous');
  assert.equal(parseWebIngredientExtraction(extracted, query, [{ ...page, title: 'Old Spice Pure Sport Deodorant' }]).status, 'ambiguous');
  for (const value of [{ ...extracted, sourceIndex: 5 }, { ...extracted, sourceUrl: 'https://evil.com' },
    { ...extracted, score: 99 }, { ...extracted, ingredientsText: 'x'.repeat(16001) }]) {
    assert.equal(parseWebIngredientExtraction(value, query, [page]).status, 'unavailable');
  }
  for (const status of ['not_found', 'ambiguous'] as const) assert.equal(parseWebIngredientExtraction({ status, sourceIndex: null,
    productName: null, ingredientsText: null }, query, [page]).status, status);
});

test('one private budget precedes search, at most top ten pages run concurrently, one extraction call uses no search tools', async () => {
  let reserved = 0, pageCalls = 0, modelCalls = 0, activePages = 0, maxPages = 0;
  const result = await lookupWebProductIngredients(query, { ...keys,
    reserveRequest: async () => { reserved++; return 'reserved'; },
    now: () => new Date('2026-10-01T12:00:00Z'),
    fetcher: async (url, init) => {
      assert.equal(reserved, 1);
      const parsed = new URL(String(url));
      if (parsed.hostname === 'az-na-smartlabel-prod-functionapp-api.pgcloud.com') {
        return new Response('', { status: 404 });
      }
      if (parsed.hostname === 'serpapi.com') {
        assert.equal(parsed.pathname, '/search.json'); assert.equal(parsed.searchParams.get('engine'), 'google_light');
        assert.equal(parsed.searchParams.has('num'), false); assert.equal(parsed.searchParams.get('gl'), 'us');
        assert.equal(parsed.searchParams.get('hl'), 'en'); assert.equal(parsed.searchParams.get('api_key'), keys.serpApiKey);
        assert.equal(parsed.searchParams.get('q'), query.name + ' ingredients');
        assert.equal(init?.redirect, 'error');
        return new Response(JSON.stringify(searchPayload(Array.from({ length: 12 }, (_v, index) => ({ link: pageUrl + '?id=' + index })))));
      }
      if (parsed.hostname === 'generativelanguage.googleapis.com') {
        modelCalls++; assert.equal(pageCalls, 10); assert.equal(init?.redirect, 'error');
        assert.equal((init!.headers as Record<string, string>)['x-goog-api-key'], keys.geminiApiKey);
        const body = JSON.parse(init!.body as string); assert.equal('tools' in body, false);
        assert.equal(body.generationConfig.responseMimeType, 'application/json');
        assert.doesNotMatch(init!.body as string, /fixture-search-key|fixture-model-key|skin.*profile|e6000000/);
        return new Response(JSON.stringify(provider()));
      }
      pageCalls++; activePages++; maxPages = Math.max(maxPages, activePages);
      assert.equal(init?.redirect, 'manual');
      await new Promise(resolve => setTimeout(resolve, 5)); activePages--;
      return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
    },
  });
  assert.equal(result.status, 'found'); assert.equal(reserved, 1); assert.equal(pageCalls, 10);
  assert.equal(maxPages, 10); assert.equal(modelCalls, 1);
});

test('explicit matching ingredients bypass the model and remain attributed rather than verified', async () => {
  let reserved = 0, modelCalls = 0;
  const result = await lookupWebProductIngredients(query, { ...keys, preferManufacturerSearch: true,
    reserveRequest: async () => { reserved++; return 'reserved'; },
    fetcher: async url => {
      const parsed = new URL(String(url));
      if (parsed.hostname === 'serpapi.com') {
        assert.equal(parsed.searchParams.get('q'), buildWebIngredientFallbackQuery(query));
        return new Response(JSON.stringify(searchPayload([{ link: pageUrl }], parsed.searchParams.get('q')!)));
      }
      if (parsed.hostname === 'generativelanguage.googleapis.com') {
        modelCalls++; return new Response('', { status: 503 });
      }
      return new Response(`<title>${title}</title><script type="application/ld+json">${JSON.stringify({
        '@type': 'Product', name: title, ingredients: list,
      })}</script>`, { headers: { 'content-type': 'text/html' } });
    },
  });
  assert.equal(result.status, 'found'); assert.equal(reserved, 1); assert.equal(modelCalls, 0);
  if (result.status === 'found') {
    assert.equal(result.evidence.ingredientsText, list);
    assert.equal(result.evidence.sourceUrl, pageUrl);
    assert.equal(result.evidence.basis, 'published_web');
    assert.equal(result.evidence.formulaVerified, false);
  }
});

test('conflicting explicit matching lists abstain without model reconciliation', async () => {
  let modelCalls = 0;
  const result = await lookupWebProductIngredients(query, { ...keys, fetcher: async url => {
    const parsed = new URL(String(url));
    if (parsed.hostname === 'serpapi.com') return new Response(JSON.stringify(searchPayload([{ link: pageUrl }])));
    if (parsed.hostname === 'generativelanguage.googleapis.com') {
      modelCalls++; return new Response(JSON.stringify(provider()));
    }
    return new Response(`<title>${title}</title><script type="application/ld+json">${JSON.stringify([
      { '@type': 'Product', name: title, ingredients: list },
      { '@type': 'Product', name: title, ingredients: 'Water, Glycerin, Fragrance.' },
    ])}</script>`, { headers: { 'content-type': 'text/html' } });
  } });
  assert.equal(result.status, 'ambiguous'); assert.equal(modelCalls, 0);
});

test('unsafe organic links and redirects never fetch the suggested private or unrelated URL', async () => {
  const fetched: string[] = [];
  const result = await lookupWebProductIngredients(query, { ...keys, fetcher: async (url) => {
    const value = String(url); fetched.push(value);
    if (value.startsWith('https://serpapi.com/')) return new Response(JSON.stringify(searchPayload([
      { link: 'https://127.0.0.1/a' }, { link: 'https://evil.com/a' }, { link: pageUrl },
    ], new URL(value).searchParams.get('q')!)));
    return new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } });
  } });
  assert.equal(result.status, 'not_found'); assert.equal(fetched.length, 3); assert.equal(fetched[1], pageUrl);
});

test('a blocked manufacturer does not discard an exact allowed retailer in the first five results', async () => {
  const fetched: string[] = [];
  const result = await lookupWebProductIngredients(query, { ...keys, fetcher: async (url, init) => {
    const value = String(url);
    if (value.startsWith('https://serpapi.com/')) return new Response(JSON.stringify(searchPayload([
      { link: 'https://oldspice.com/products/fresh' }, { link: pageUrl },
    ])));
    if (value.startsWith('https://generativelanguage.googleapis.com/')) {
      const pages = JSON.parse(init!.body as string).contents[0].parts[0].text;
      assert.equal(JSON.parse(pages).pages.length, 1);
      assert.equal(JSON.parse(pages).pages[0].title.includes(title), true);
      return new Response(JSON.stringify(provider()));
    }
    fetched.push(value);
    return value.includes('oldspice.com') ? new Response(null, { status: 403 })
      : new Response(html, { headers: { 'content-type': 'text/html' } });
  } });
  assert.equal(result.status, 'found');
  if (result.status === 'found') assert.equal(result.evidence.sourceUrl, pageUrl);
  assert.deepEqual(fetched, ['https://oldspice.com/products/fresh', pageUrl]);
});

test('unsafe first-ten results do not cause an eleventh result to be fetched', async () => {
  let calls = 0;
  const result = await lookupWebProductIngredients({ ...query, brand: null }, { ...keys, fetcher: async (url) => {
    calls++;
    assert.match(String(url), /^https:\/\/serpapi\.com\//);
    return new Response(JSON.stringify(searchPayload([
      ...Array.from({ length: 10 }, (_value, index) => ({ link: 'https://unapproved.example/product/' + index })),
      { link: pageUrl },
    ])));
  } });
  assert.equal(result.status, 'not_found'); assert.equal(calls, 1);
});

test('wrong extra Aveeno variant is excluded before model extraction', async () => {
  const lotion = { ...query, name: 'Aveeno Daily Moisturizing Lotion', brand: 'Aveeno', size: null };
  let modelCalls = 0;
  const result = await lookupWebProductIngredients(lotion, { ...keys, fetcher: async (url) => {
    const value = String(url);
    if (value.startsWith('https://serpapi.com/')) return new Response(JSON.stringify({
      search_parameters: { q: new URL(value).searchParams.get('q') }, organic_results: [{ link: pageUrl }],
    }));
    if (value.startsWith('https://generativelanguage.googleapis.com/')) { modelCalls++; throw Error('unexpected'); }
    return new Response('<h1>Aveeno Daily Moisturizing Sheer Hydration Lotion</h1><p>Ingredients: ' + list + '</p>',
      { headers: { 'content-type': 'text/html' } });
  } });
  assert.equal(result.status, 'ambiguous'); assert.equal(modelCalls, 0);
});

test('safe manufacturer redirects retain actual final source URL', async () => {
  let pageCalls = 0;
  const result = await lookupWebProductIngredients(query, { ...keys, fetcher: async (url) => {
    if (String(url).startsWith('https://serpapi.com/')) return new Response(JSON.stringify(searchPayload([{ link: 'https://oldspice.com/products/fresh' }])));
    if (String(url).startsWith('https://generativelanguage.googleapis.com/')) return new Response(JSON.stringify(provider()));
    pageCalls++;
    if (pageCalls === 1) return new Response(null, { status: 301, headers: { location: 'https://www.oldspice.com/products/fresh' } });
    return new Response(html, { headers: { 'content-type': 'text/html' } });
  } });
  assert.equal(result.status, 'found');
  if (result.status === 'found') assert.equal(result.evidence.sourceUrl, 'https://www.oldspice.com/products/fresh');
  assert.equal(pageCalls, 2);
});

test('missing keys, invalid model and denied private budget make no network requests', async () => {
  let calls = 0, reserved = 0;
  const fetcher: typeof fetch = async () => { calls++; throw Error('unexpected'); };
  const reserveRequest = async (): Promise<'reserved'> => { reserved++; return 'reserved'; };
  for (const override of [{ serpApiKey: '' }, { geminiApiKey: '' }, { model: '../../other' }]) {
    assert.equal((await lookupWebProductIngredients(query, { ...keys, reserveRequest, fetcher, ...override })).status, 'configuration_required');
  }
  assert.equal(reserved, 0); assert.equal(calls, 0);
  assert.equal((await lookupWebProductIngredients(query, { ...keys, fetcher, reserveRequest: async () => 'rate_limited' })).status, 'rate_limited');
  assert.equal(calls, 0);
});

test('HTTP 200 with missing or unrelated echoed query is not accepted as a successful search', async () => {
  for (const response of [
    { organic_results: [{ link: pageUrl }] },
    { ...searchPayload([{ link: pageUrl }]), search_parameters: { q: '3' } },
  ]) {
    let calls = 0;
    const result = await lookupWebProductIngredients(query, { ...keys, fetcher: async (url) => {
      calls++; assert.match(String(url), /^https:\/\/serpapi\.com\/search\.json\?/);
      return new Response(JSON.stringify(response));
    } });
    assert.deepEqual(result, { status: 'unavailable' }); assert.equal(calls, 1);
  }
});

test('search/model quota and missing permission remain typed and never leak provider URLs or keys', async () => {
  for (const [http, status] of [[429, 'rate_limited'], [403, 'configuration_required'], [503, 'unavailable']] as const) {
    const result = await lookupWebProductIngredients(query, { ...keys, fetcher: async () => new Response('{}', { status: http }) });
    assert.deepEqual(result, { status });
  }
  for (const [http, status] of [[429, 'rate_limited'], [404, 'configuration_required'], [503, 'unavailable']] as const) {
    const result = await lookupWebProductIngredients(query, { ...keys, fetcher: async (url) => {
      if (String(url).startsWith('https://serpapi.com/')) return new Response(JSON.stringify(searchPayload([{ link: pageUrl }])));
      if (String(url).startsWith('https://generativelanguage.googleapis.com/')) return new Response('{}', { status: http });
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    } });
    assert.deepEqual(result, { status });
  }
});

test('bounded oversized provider/page bodies and malformed model output fail cleanly', async () => {
  assert.equal((await lookupWebProductIngredients(query, { ...keys, fetcher: async () => new Response('x'.repeat(262145)) })).status, 'unavailable');
  for (const modelBody of ['{}', JSON.stringify(provider({ ...extracted, ingredientsText: 'Fake A, Fake B.' })), 'x'.repeat(65537)]) {
    const result = await lookupWebProductIngredients(query, { ...keys, fetcher: async (url) => {
      if (String(url).startsWith('https://serpapi.com/')) return new Response(JSON.stringify(searchPayload([{ link: pageUrl }])));
      if (String(url).startsWith('https://generativelanguage.googleapis.com/')) return new Response(modelBody);
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    } });
    assert.equal(result.status, modelBody.includes('Fake A') ? 'not_found' : 'unavailable');
  }
  const oversizedPage = await lookupWebProductIngredients(query, { ...keys, fetcher: async (url) => {
    if (String(url).startsWith('https://serpapi.com/')) return new Response(JSON.stringify(searchPayload([{ link: pageUrl }], new URL(String(url)).searchParams.get('q')!)));
    return new Response('x'.repeat(1048577), { headers: { 'content-type': 'text/html' } });
  } });
  assert.equal(oversizedPage.status, 'not_found');
});

test('search and extraction request timeout aborts without retries', async () => {
  for (const phase of ['search', 'model'] as const) {
    let calls = 0;
    const result = await lookupWebProductIngredients(query, { ...keys, searchTimeoutMs: 5, modelTimeoutMs: 5,
      fetcher: async (url, init) => {
        const search = String(url).startsWith('https://serpapi.com/');
        const model = String(url).startsWith('https://generativelanguage.googleapis.com/');
        if (phase === 'search' && search || phase === 'model' && model) {
          calls++; await new Promise((_resolve, reject) => init!.signal!.addEventListener('abort', () => reject(Error('timeout')), { once: true }));
          throw Error('unreachable');
        }
        if (search) return new Response(JSON.stringify(searchPayload([{ link: pageUrl }])));
        return new Response(html, { headers: { 'content-type': 'text/html' } });
      },
    });
    assert.equal(result.status, 'unavailable'); assert.equal(calls, 1);
  }
});

const owner = 'e6000000-0000-4000-8000-000000000001';
const deps = () => ({ enabled: true, allowedUserIds: [owner], authenticate: async () => ({ userId: owner }),
  lookup: async () => ({ status: 'not_found' as const }),
  failure: (code: string, _message: string, status: number) => Object.assign(Error(code), { status }),
  respond: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status }),
  errorResponse: (error: unknown) => new Response(null, { status: (error as { status?: number }).status ?? 500 }), corsHeaders: {},
});
const request = (body: unknown = query) => new Request('https://example.com', { method: 'POST', body: JSON.stringify(body) });

test('endpoint blocks disabled, missing auth, non-allowlisted owners and forged context before provider', async () => {
  let calls = 0;
  const lookup = async () => { calls++; return { status: 'not_found' as const }; };
  for (const [overrides, status] of [[{ enabled: false }, 503], [{ allowedUserIds: [] }, 503],
    [{ authenticate: async () => ({ userId: 'other' }) }, 403],
    [{ authenticate: async () => { throw Object.assign(Error(), { status: 401 }); } }, 401]] as const) {
    assert.equal((await handlePrivateWebProductIngredients(request(), { ...deps(), lookup, ...overrides })).status, status);
  }
  assert.equal((await handlePrivateWebProductIngredients(request({ ...query, profile: {} }), { ...deps(), lookup })).status, 400);
  assert.equal((await handlePrivateWebProductIngredients(request({ ...query, name: 'x'.repeat(5000) }), { ...deps(), lookup })).status, 413);
  assert.equal(calls, 0);
  assert.equal((await handlePrivateWebProductIngredients(new Request('https://example.com'), deps())).status, 405);
});

test('endpoint forwards only parsed product identity plus authenticated owner with typed HTTP statuses', async () => {
  for (const [status, http] of [['not_found', 200], ['ambiguous', 200], ['configuration_required', 503], ['unavailable', 503], ['rate_limited', 429]] as const) {
    const response = await handlePrivateWebProductIngredients(request(), { ...deps(), lookup: async (input, identity) => {
      assert.deepEqual(input, query); assert.equal(identity.userId, owner); return { status };
    } });
    assert.equal(response.status, http);
  }
});

test('server flags, two server-only keys and existing private budget do not write ingredient records', () => {
  const source = readFileSync(new URL('../supabase/functions/private-web-product-ingredients/index.ts', import.meta.url), 'utf8');
  assert.match(source, /DERIVE_WEB_INGREDIENT_TEST_ENABLED'\) === 'true'/);
  assert.match(source, /DERIVE_UPC_PRIVATE_TESTER_IDS/); assert.match(source, /SERPAPI_API_KEY/); assert.match(source, /GEMINI_API_KEY/);
  assert.match(source, /reserve_private_grounded_search.*p_user_id: userId/);
  assert.doesNotMatch(source, /\.insert\(|\.upsert\(|\.storage/);
  assert.match(source, /report: event => console.info/);
});

test('manufacturer fallback preserves identity markers and charges its own budget before the second search', async () => {
  const lotion = { ...query, name: 'Aveeno Stress Relief Body Lotion Lavender Scent 18 Fl oz', brand: 'Aveeno', size: '18 oz' };
  assert.equal(buildWebIngredientFallbackQuery(lotion), 'site:aveeno.com Aveeno Stress Relief Body Lotion Lavender Scent ingredients');
  assert.match(buildWebIngredientFallbackQuery({ ...lotion, name: 'Aveeno Sensitive Lotion SPF 30 12 oz' })!, /Sensitive Lotion SPF 30 ingredients/);
  assert.equal(buildWebIngredientFallbackQuery({ ...lotion, brand: 'Unknown' }), null);
  let reserved = 0, searches = 0;
  const events: unknown[] = [];
  const productTitle = 'Aveeno Stress Relief Body Lotion Lavender Scent';
  const result = await lookupWebProductIngredients(lotion, { ...keys,
    reserveRequest: async () => { reserved++; return 'reserved'; }, report: event => events.push(event),
    fetcher: async (url, init) => {
      const parsed = new URL(String(url));
      if (parsed.hostname === 'serpapi.com') {
        searches++; assert.equal(reserved, searches);
        return new Response(JSON.stringify(searchPayload(searches === 1 ? [{ link: 'https://unapproved.example/post' }]
          : [{ link: 'https://www.aveeno.com/products/stress-relief' }], parsed.searchParams.get('q')!)));
      }
      if (parsed.hostname === 'generativelanguage.googleapis.com') return new Response(JSON.stringify(provider({ ...extracted, productName: productTitle })));
      return new Response(`<title>${productTitle}</title><p>Ingredients ${list}</p>`, { headers: { 'content-type': 'text/html' } });
    },
  });
  assert.equal(result.status, 'found'); assert.equal(searches, 2); assert.equal(reserved, 2);
  assert.doesNotMatch(JSON.stringify(events), /fixture-|Aveeno|Stress Relief|038137|https:/);
});

test('denied fallback budget does not make a second search request', async () => {
  let reserved = 0, searches = 0;
  const result = await lookupWebProductIngredients(query, { ...keys,
    reserveRequest: async () => ++reserved === 1 ? 'reserved' : 'rate_limited',
    fetcher: async () => { searches++; return new Response(JSON.stringify(searchPayload([]))); },
  });
  assert.equal(result.status, 'rate_limited'); assert.equal(searches, 1);
});
