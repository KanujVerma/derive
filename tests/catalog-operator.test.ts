import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseArgs, validateCatalogEntry } from '../scripts/catalog-ingest.mjs';

const seed = JSON.parse(readFileSync(new URL('../docs/catalog-seeds/cerave-renewing-sa-cleanser.json', import.meta.url), 'utf8'));

test('Catalog operator: sourced product-only entry stays product-only', () => {
  const result = validateCatalogEntry(structuredClone(seed));
  assert.equal(result.product.brand, 'CeraVe');
  assert.equal(result.product.name, 'Renewing SA Cleanser');
  assert.equal(result.aliases[0].name, 'CeraVe SA Cleanser');
  assert.equal(result.variant, undefined);
  assert.equal(result.formula, undefined);
  assert.equal(result.identifier, undefined);
});

test('Catalog operator: refuses missing provenance and guessed formula claims', () => {
  const noSource = structuredClone(seed);
  delete noSource.product.sourceReference;
  assert.throws(() => validateCatalogEntry(noSource));
  const signedUrl = structuredClone(seed);
  signedUrl.product.publicSourceUrl = 'https://private.example/evidence?token=secret';
  assert.throws(() => validateCatalogEntry(signedUrl));
  const invalidFormula = structuredClone(seed);
  invalidFormula.variant = { name: 'US bottle', sourceReference: 'https://manufacturer.example/variant', observedAt: '2026-09-22T00:00:00Z', verificationStatus: 'verified' };
  invalidFormula.formula = {
    ingredients: ['Water'], provenanceType: 'member_photo',
    sourceReference: 'member observation', observedAt: '2026-09-22T00:00:00Z',
    verificationStatus: 'verified',
  };
  assert.throws(() => validateCatalogEntry(invalidFormula));
});

test('Catalog operator: computes S6 fingerprint and rejects invalid GTIN', () => {
  const enriched = structuredClone(seed);
  enriched.variant = { name: 'US bottle', regionCode: 'US', packageSize: '237 mL', sourceReference: 'https://manufacturer.example/variant', observedAt: '2026-09-22T00:00:00Z', verificationStatus: 'verified' };
  enriched.formula = {
    ingredients: ['Water', 'Glycerin'], provenanceType: 'manufacturer',
    sourceReference: 'https://manufacturer.example/ingredients', observedAt: '2026-09-22T00:00:00Z',
    verificationStatus: 'verified',
  };
  enriched.identifier = {
    type: 'gtin_12', value: '036000291452', sourceAuthority: 'manufacturer',
    sourceReference: 'https://manufacturer.example/gtin', observedAt: '2026-09-22T00:00:00Z',
    verifiedAt: '2026-09-22T00:00:00Z', linkFormula: true,
  };
  assert.equal(validateCatalogEntry(enriched).formula.normalizedIngredientFingerprint, 'water|glycerin');
  enriched.identifier.value = '036000291453';
  assert.throws(() => validateCatalogEntry(enriched));
});

test('Catalog operator: requires exact hosted project and explicit apply', () => {
  assert.deepEqual(parseArgs(['--file','entry.json','--project-ref','snojlbqovlawewwqbviz']), {
    file: 'entry.json', projectRef: 'snojlbqovlawewwqbviz', apply: false, local: false,
  });
  assert.throws(() => parseArgs(['--file','entry.json','--project-ref','wrong']));
  assert.throws(() => parseArgs(['--file','entry.json','--apply']));
});
