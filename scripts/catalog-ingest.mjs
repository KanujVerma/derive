/** Trusted, source-backed catalog entry ingestion through authenticated Supabase management CLI. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isValidGtin, normalizeIngredientFingerprint } from '../supabase/functions/_shared/product-identity.ts';

const HOSTED_PROJECT = 'snojlbqovlawewwqbviz';
const CATEGORIES = new Set(['cleanser','toner','treatment','serum','moisturizer','sunscreen','oil','mask','deodorant','body_care','hair_care','other']);
const TRUSTED_AUTHORITIES = new Set(['manufacturer','gs1','founder']);
const FORMULA_SOURCES = new Set(['manufacturer','package_label','regulator','founder_review','member_photo']);

function object(value, label, allowed) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  assert.ok(Object.keys(value).every((key) => allowed.includes(key)), `${label} has an unexpected field`);
  return value;
}
function string(value, label, max) {
  assert.ok(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max, `${label} is required`);
  return value.trim();
}
function publicUrl(value, label) {
  const checked = string(value, label, 1000);
  let parsed;
  try { parsed = new URL(checked); } catch { throw new Error(`${label} must be a public HTTPS URL`); }
  assert.ok(parsed.protocol === 'https:' && parsed.username === '' && parsed.password === ''
    && parsed.search === '' && parsed.hash === '' && !/[?@#]/.test(checked),
  `${label} must be an explicit public HTTPS URL without credentials or query`);
  return checked;
}

function date(value, label) {
  const checked = string(value, label, 40);
  assert.ok(Number.isFinite(Date.parse(checked)), `${label} must be a timestamp`);
  return new Date(checked).toISOString();
}

export function validateCatalogEntry(raw) {
  const payload = object(raw, 'entry', ['product','aliases','variant','formula','identifier']);
  const product = object(payload.product, 'product', ['brand','name','category','sourceReference','publicSourceUrl','observedAt']);
  product.brand = string(product.brand, 'brand', 120);
  product.name = string(product.name, 'name', 180);
  product.category = string(product.category, 'category', 40);
  assert.ok(CATEGORIES.has(product.category), 'unsupported category');
  product.sourceReference = string(product.sourceReference, 'product sourceReference', 1000);
  if (product.publicSourceUrl !== undefined) product.publicSourceUrl = publicUrl(product.publicSourceUrl, 'product publicSourceUrl');
  product.observedAt = date(product.observedAt, 'product observedAt');
  if (payload.aliases !== undefined) {
    assert.ok(Array.isArray(payload.aliases) && payload.aliases.length <= 30, 'aliases must be a bounded array');
    payload.aliases = payload.aliases.map((item) => {
      const alias = object(item, 'alias', ['name','sourceReference','observedAt']);
      return {
        name: string(alias.name, 'alias name', 180),
        sourceReference: string(alias.sourceReference, 'alias sourceReference', 1000),
        observedAt: date(alias.observedAt, 'alias observedAt'),
      };
    });
  }
  if (payload.variant !== undefined) {
    const variant = object(payload.variant, 'variant', ['name','regionCode','packageSize','packagingMarkers','sourceReference','publicSourceUrl','observedAt','verificationStatus']);
    variant.name = string(variant.name, 'variant name', 180);
    variant.sourceReference = string(variant.sourceReference, 'variant sourceReference', 1000);
    if (variant.publicSourceUrl !== undefined) variant.publicSourceUrl = publicUrl(variant.publicSourceUrl, 'variant publicSourceUrl');
    variant.observedAt = date(variant.observedAt, 'variant observedAt');
    variant.verificationStatus = string(variant.verificationStatus, 'variant verificationStatus', 20);
    assert.ok(['provisional','verified'].includes(variant.verificationStatus), 'unsupported variant verification status');
    if (variant.regionCode !== undefined) {
      variant.regionCode = string(variant.regionCode, 'regionCode', 12);
      assert.match(variant.regionCode, /^[A-Z]{2}(-[A-Z0-9]{1,8})?$/, 'invalid regionCode');
    }
    if (variant.packageSize !== undefined) variant.packageSize = string(variant.packageSize, 'packageSize', 80);
    if (variant.packagingMarkers !== undefined) {
      assert.ok(Array.isArray(variant.packagingMarkers) && variant.packagingMarkers.length <= 30, 'invalid packagingMarkers');
      variant.packagingMarkers = variant.packagingMarkers.map((item) => string(item, 'packaging marker', 120));
    }
  }
  if (payload.formula !== undefined || payload.identifier !== undefined) {
    assert.ok(payload.variant, 'variant is required for formula or identifier evidence');
  }
  if (payload.formula !== undefined) {
    const formula = object(payload.formula, 'formula', ['ingredients','provenanceType','sourceReference','publicSourceUrl','observedAt','verificationStatus','supersedesId']);
    assert.ok(Array.isArray(formula.ingredients) && formula.ingredients.length >= 1 && formula.ingredients.length <= 300, 'formula ingredients must be exact and bounded');
    formula.ingredients = formula.ingredients.map((item) => string(item, 'ingredient', 180));
    formula.normalizedIngredientFingerprint = normalizeIngredientFingerprint(formula.ingredients);
    assert.ok(formula.normalizedIngredientFingerprint, 'formula fingerprint is empty');
    formula.provenanceType = string(formula.provenanceType, 'formula provenanceType', 40);
    assert.ok(FORMULA_SOURCES.has(formula.provenanceType), 'unsupported formula provenance');
    formula.sourceReference = string(formula.sourceReference, 'formula sourceReference', 1000);
    if (formula.publicSourceUrl !== undefined) formula.publicSourceUrl = publicUrl(formula.publicSourceUrl, 'formula publicSourceUrl');
    formula.observedAt = date(formula.observedAt, 'formula observedAt');
    formula.verificationStatus = string(formula.verificationStatus, 'formula verificationStatus', 20);
    assert.ok(['provisional','verified'].includes(formula.verificationStatus), 'unsupported formula verification status');
    if (formula.verificationStatus === 'verified') {
      assert.notEqual(formula.provenanceType, 'member_photo', 'member photo alone cannot verify a formula');
    }
    if (formula.supersedesId !== undefined) assert.match(string(formula.supersedesId, 'supersedesId', 40), /^[0-9a-f-]{36}$/i);
  }
  if (payload.identifier !== undefined) {
    const identifier = object(payload.identifier, 'identifier', ['type','value','sourceAuthority','sourceReference','observedAt','verifiedAt','linkFormula']);
    identifier.type = string(identifier.type, 'identifier type', 20);
    assert.ok(['gtin_8','gtin_12','gtin_13','gtin_14'].includes(identifier.type), 'unsupported identifier type');
    identifier.value = string(identifier.value, 'identifier value', 14);
    assert.equal(identifier.value.length, Number(identifier.type.split('_')[1]), 'GTIN type and length differ');
    assert.ok(isValidGtin(identifier.value), 'invalid GTIN check digit');
    identifier.sourceAuthority = string(identifier.sourceAuthority, 'identifier sourceAuthority', 40);
    assert.ok(['manufacturer','gs1','founder','retailer','member'].includes(identifier.sourceAuthority), 'unsupported identifier authority');
    identifier.sourceReference = string(identifier.sourceReference, 'identifier sourceReference', 1000);
    identifier.observedAt = date(identifier.observedAt, 'identifier observedAt');
    if (identifier.verifiedAt !== undefined) {
      identifier.verifiedAt = date(identifier.verifiedAt, 'identifier verifiedAt');
      assert.ok(TRUSTED_AUTHORITIES.has(identifier.sourceAuthority), 'only authoritative identifiers can be verified');
    }
    if (identifier.linkFormula !== undefined) {
      assert.equal(typeof identifier.linkFormula, 'boolean', 'linkFormula must be boolean');
      if (identifier.linkFormula) {
        assert.ok(payload.formula?.verificationStatus === 'verified' && identifier.verifiedAt, 'formula link needs a verified formula and identifier');
      }
    }
  }
  return payload;
}

export function parseArgs(argv) {
  const args = { apply: false, local: false };
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (value === '--file') args.file = argv[++index];
    else if (value === '--project-ref') args.projectRef = argv[++index];
    else if (value === '--apply') args.apply = true;
    else if (value === '--local') args.local = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  assert.ok(args.file, '--file is required');
  assert.ok(args.local !== Boolean(args.projectRef), 'Choose --local or --project-ref');
  if (args.projectRef) assert.equal(args.projectRef, HOSTED_PROJECT, 'Refusing the wrong hosted project');
  return args;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const payload = validateCatalogEntry(JSON.parse(readFileSync(args.file, 'utf8')));
    console.log(JSON.stringify({
      target: args.local ? 'local' : args.projectRef,
      product: `${payload.product.brand} ${payload.product.name}`,
      aliases: payload.aliases?.length ?? 0,
      variant: Boolean(payload.variant), identifier: Boolean(payload.identifier),
      formula: payload.formula?.verificationStatus ?? 'none',
      action: args.apply ? 'apply' : 'preview_only',
    }));
    if (args.apply) {
      const dir = mkdtempSync(join(tmpdir(), 'derive-catalog-'));
      try {
        const sqlFile = join(dir, 'ingest.sql');
        const hex = Buffer.from(JSON.stringify(payload), 'utf8').toString('hex');
        writeFileSync(sqlFile, `select private.ingest_catalog_product(convert_from(decode('${hex}','hex'),'UTF8')::jsonb) as result;\n`, { mode: 0o600 });
        const cli = process.env.SUPABASE_CLI || 'supabase';
        const commandArgs = ['db','query',args.local ? '--local' : '--linked'];
        if (args.projectRef) commandArgs.push('--project-ref',args.projectRef);
        commandArgs.push('--file',sqlFile,'--output-format','json');
        const result = spawnSync(cli, commandArgs, { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] });
        if (result.status !== 0) throw new Error(`Ingestion failed: ${result.stderr?.trim().slice(0,300) || 'management query error'}`);
        const response = JSON.parse(result.stdout);
        console.log(JSON.stringify({ result: response.rows?.[0]?.result ?? null }));
      } finally { rmSync(dir, { recursive: true, force: true }); }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Invalid catalog entry');
    process.exitCode = 1;
  }
}
