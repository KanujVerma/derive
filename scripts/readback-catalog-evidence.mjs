#!/usr/bin/env node
/** Read-only catalog evidence inventory. Counts are not customer-demand coverage or release proof. */
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const exec = promisify(execFile);
export const PROJECT_REF = 'snojlbqovlawewwqbviz';
const COUNT_FIELDS = [
  'total_products', 'sourced_products', 'not_sourced_products', 'sourced_aliases',
  'active_sourced_variants', 'verified_sourced_variants', 'verified_authoritative_gtins',
  'verified_formula_versions', 'uniquely_linked_formula_variants', 'conflicting_formula_variants',
];

// All reads are restricted to source-confirmed catalog products. No customer products,
// ingredient lists, photos, member records or source URLs leave the database.
export const INVENTORY_SQL = `
with sourced as (
  select id from public.products
  where is_catalog_standard is true and catalog_verified_at is not null
), active_variants as (
  select v.id, v.catalog_verification_status from public.product_variants v
  join sourced p on p.id = v.product_id
  where v.lifecycle_status = 'active'
), linked as (
  select i.variant_id, count(distinct f.id) as formula_count
  from public.product_identifiers i
  join active_variants v on v.id = i.variant_id
  join public.product_formula_versions f on f.id = i.formula_version_id and f.variant_id = v.id
  where i.verified_at is not null
    and i.source_authority in ('manufacturer', 'gs1', 'founder')
    and f.verification_status = 'verified'
    and f.provenance_type in ('manufacturer', 'package_label', 'regulator', 'founder_review')
    and nullif(trim(f.source_reference), '') is not null and f.observed_at is not null
    and cardinality(f.ingredients) > 0
  group by i.variant_id
)
select
  (select count(*) from public.products)::integer as total_products,
  (select count(*) from sourced)::integer as sourced_products,
  (select count(*) from public.products where not (is_catalog_standard is true and catalog_verified_at is not null))::integer as not_sourced_products,
  (select count(*) from public.product_search_aliases a join sourced p on p.id = a.product_id)::integer as sourced_aliases,
  (select count(*) from active_variants)::integer as active_sourced_variants,
  (select count(*) from active_variants where catalog_verification_status = 'verified')::integer as verified_sourced_variants,
  (select count(*) from public.product_identifiers i join active_variants v on v.id = i.variant_id
    where i.verified_at is not null and i.source_authority in ('manufacturer', 'gs1', 'founder')
      and i.identifier_type in ('gtin_8', 'gtin_12', 'gtin_13', 'gtin_14'))::integer as verified_authoritative_gtins,
  (select count(*) from public.product_formula_versions f join active_variants v on v.id = f.variant_id
    where f.verification_status = 'verified'
      and f.provenance_type in ('manufacturer', 'package_label', 'regulator', 'founder_review'))::integer as verified_formula_versions,
  (select count(*) from linked where formula_count = 1)::integer as uniquely_linked_formula_variants,
  (select count(*) from linked where formula_count > 1)::integer as conflicting_formula_variants;
`;

function nonnegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

/** Pure receipt validation. Never turn inventory parity into activation approval. */
export function catalogEvidenceReceipt({ row, target, sourceRevision, observedAt }) {
  if (!row || typeof row !== 'object' || Array.isArray(row)
    || !['local', PROJECT_REF].includes(target)
    || typeof sourceRevision !== 'string' || !/^[a-f\d]{40}$/i.test(sourceRevision)
    || typeof observedAt !== 'string' || !Number.isFinite(Date.parse(observedAt))
    || COUNT_FIELDS.some((field) => !nonnegativeInteger(row[field]))) {
    throw new Error('INVALID_CATALOG_EVIDENCE_READBACK');
  }
  if (row.sourced_products + row.not_sourced_products !== row.total_products
    || row.verified_sourced_variants > row.active_sourced_variants
    || row.uniquely_linked_formula_variants + row.conflicting_formula_variants > row.active_sourced_variants) {
    throw new Error('INCONSISTENT_CATALOG_EVIDENCE_READBACK');
  }
  return {
    schemaVersion: 1,
    scope: 'READ_ONLY_SOURCED_CATALOG_EVIDENCE_INVENTORY_NOT_DEMAND_OR_RELEASE_PROOF',
    target,
    sourceRevision: sourceRevision.toLowerCase(),
    observedAt,
    counts: Object.fromEntries(COUNT_FIELDS.map((field) => [field, row[field]])),
    limitations: [
      'Counts do not show whether intended customers can find their products.',
      'A verified GTIN does not establish an exact formula or package authenticity.',
      'A unique formula link is not physical Check, safety, hosted Auth or release acceptance.',
      'Current hosted migration/function revisions and live customer flow require separate readback.',
    ],
    activation: { ready: false, status: 'BLOCKED', reason: 'OTHER_HOSTED_PHYSICAL_AND_DEMAND_GATES_NOT_EVALUATED' },
  };
}

export function parseArgs(argv) {
  if (argv.length === 1 && argv[0] === '--local') return { target: 'local' };
  if (argv.length === 2 && argv[0] === '--project-ref' && argv[1] === PROJECT_REF) {
    return { target: PROJECT_REF };
  }
  throw new Error('Choose --local or --project-ref with the exact Derive project ref');
}

async function command(file, args, cwd) {
  const { stdout } = await exec(file, args, { cwd, timeout: 60000, maxBuffer: 1024 * 1024, encoding: 'utf8' });
  return stdout.trim();
}

export async function readbackCatalogEvidence(target, cwd = process.cwd()) {
  if (!['local', PROJECT_REF].includes(target)) throw new Error('INVALID_CATALOG_TARGET');
  const sourceRevision = await command('git', ['rev-parse', 'HEAD'], cwd);
  const tempDir = await mkdtemp(join(tmpdir(), 'derive-catalog-readback-'));
  try {
    const sqlFile = join(tempDir, 'inventory.sql');
    await writeFile(sqlFile, INVENTORY_SQL, { mode: 0o600 });
    const args = ['db', 'query', target === 'local' ? '--local' : '--linked'];
    if (target !== 'local') args.push('--project-ref', PROJECT_REF);
    args.push('--file', sqlFile, '--output-format', 'json');
    const raw = await command(process.env.SUPABASE_CLI || 'supabase', args, cwd);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.rows) || parsed.rows.length !== 1) throw new Error('INVALID_CATALOG_EVIDENCE_READBACK');
    return catalogEvidenceReceipt({ row: parsed.rows[0], target, sourceRevision, observedAt: new Date().toISOString() });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { target } = parseArgs(process.argv.slice(2));
    const receipt = await readbackCatalogEvidence(target);
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  } catch {
    // CLI errors can include private connection strings: never print raw error text.
    process.stdout.write(`${JSON.stringify({ schemaVersion: 1, scope: 'READ_ONLY_CATALOG_EVIDENCE_INVENTORY', readback: 'UNKNOWN', activation: { ready: false, status: 'BLOCKED' } })}\n`);
    process.exitCode = 2;
  }
}
