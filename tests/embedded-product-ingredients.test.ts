import test from 'node:test';
import assert from 'node:assert/strict';
import { embeddedProductIngredientText } from '../supabase/functions/_shared/embedded-product-ingredients.ts';

const title = 'Stress Relief Body Lotion, Lavender Scent';
const pageTitle = `${title} | Stress Relief Body Lotion, Lavender Scent | Aveeno®`;
const heading = (level: number, text: string) => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] });
const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
function overview(productTitle = title, label = '18oz', names = ['Water', 'Glycerin', 'Fragrance']) {
  return { id: 'product-overview', product: { title: productTitle, label }, accordion: { items: [{
    id: 'ingredients', title: 'Ingredients', slotContent: { type: 'doc', content: [
      heading(4, '~99% of the formula is selected to benefit the skin'),
      paragraph('Promotional explanation, not an ingredient.'),
      ...names.flatMap(name => [heading(5, name), paragraph(`Description of ${name}`)]),
    ] },
  }] } };
}
function flight(...records: unknown[]) {
  const data = `12:${JSON.stringify([['$', '$L1a', null, { recommendations: [
    overview('Daily Moisturizing Lotion', '18oz', ['Wrong Recommendation', 'Not This Product']),
  ] }], ...records])}\n`;
  return `<title>${pageTitle}</title><script>self.__next_f.push(${JSON.stringify([1, data])})</script>`;
}

test('reads only declared level-five ingredient headings from the matching product, not descriptions or recommendations', () => {
  const html = flight(overview(title, '18oz', [
    'Avena Sativa (Oat) Kernel Flour | Hero Ingredient', 'Water', 'Glycerin',
    'Lavandula Angustifolia (Lavender) Flower Extract', '<1% Fragrance', 'Fragrance',
  ]));
  assert.equal(embeddedProductIngredientText(html, pageTitle),
    `${title} (18oz) Ingredients Avena Sativa (Oat) Kernel Flour, Water, Glycerin, Lavandula Angustifolia (Lavender) Flower Extract, Fragrance`);
  assert.doesNotMatch(embeddedProductIngredientText(html, pageTitle), /Description|Promotional|Wrong Recommendation|Hero Ingredient/);
});

test('same-list sizes dedupe, but conflicting size lists stay separate attributed passages', () => {
  const html = flight(overview(title, '12oz'), overview(title, '18oz'),
    overview(title, '33oz', ['Water', 'Petrolatum', 'Fragrance']));
  assert.equal(embeddedProductIngredientText(html, pageTitle).split('\n').length, 2);
  assert.match(embeddedProductIngredientText(html, pageTitle), /33oz\) Ingredients Water, Petrolatum, Fragrance/);
});

test('rejects another scent or appended variant, even when the page contains their product overview', () => {
  const html = flight(overview('Stress Relief Body Lotion, Fragrance Free'),
    overview(`${title} Plus`), overview('Stress Relief Body Wash, Lavender Scent'));
  assert.equal(embeddedProductIngredientText(html, pageTitle), '');
});

test('never executes scripts, and ignores malformed or unbounded data', () => {
  const valid = flight(overview());
  (globalThis as Record<string, unknown>).__embeddedIngredientExecuted = false;
  const executable = `<script>globalThis.__embeddedIngredientExecuted=true;self.__next_f.push([1,notJSON])</script>${valid}`;
  assert.match(embeddedProductIngredientText(executable, pageTitle), /Ingredients Water, Glycerin, Fragrance/);
  assert.equal((globalThis as Record<string, unknown>).__embeddedIngredientExecuted, false);
  assert.equal(embeddedProductIngredientText(`<!-- ${valid} -->`, pageTitle), '',
    'a commented-out Flight payload is not published page data');
  assert.equal(embeddedProductIngredientText('x'.repeat(2_000_001) + valid, pageTitle), '');
  assert.equal(embeddedProductIngredientText(flight(overview()) + '<script>self.__next_f.push([1,"unterminated)',
    'Other Product | Aveeno'), '');
  delete (globalThis as Record<string, unknown>).__embeddedIngredientExecuted;
});

test('limit exhaustion abstains instead of returning an earlier partial ingredient passage', () => {
  const valid = flight(overview());
  assert.equal(embeddedProductIngredientText(valid + '<script></script>'.repeat(161), pageTitle), '');
  const rows = [`12:${JSON.stringify([overview()])}`,
    ...Array.from({ length: 301 }, (_, index) => `${index + 13}:0`)].join('\n');
  const html = `<script>self.__next_f.push(${JSON.stringify([1, rows])})</script>`;
  assert.equal(embeddedProductIngredientText(html, pageTitle), '');
});

test('rejects non-ingredient headings, empty lists, and markup-like headings', () => {
  const node = overview();
  const item = node.accordion.items[0];
  item.slotContent.content = [heading(4, 'Ingredient benefits'), heading(5, '<script>alert(1)</script>'),
    heading(5, 'Water')];
  assert.equal(embeddedProductIngredientText(flight(node), pageTitle), '');
  item.slotContent.content = [heading(5, 'Water'), heading(5, 'Glycerin'),
    { ...heading(5, 'Fragrance'), content: Array.from({ length: 9 }, () => ({ type: 'text', text: 'a' })) }];
  assert.equal(embeddedProductIngredientText(flight(node), pageTitle), '',
    'an overlong heading cannot be truncated into a partial formula');
  item.slotContent.content = [heading(5, 'Water'), heading(5, 'Glycerin'),
    ...Array.from({ length: 239 }, () => paragraph('explanation'))];
  assert.equal(embeddedProductIngredientText(flight(node), pageTitle), '',
    'an overlong document cannot yield its first ingredients as a partial list');
});
