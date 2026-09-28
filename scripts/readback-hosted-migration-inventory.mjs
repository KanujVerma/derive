#!/usr/bin/env node
/** Read-only migration-version drift check. Version parity never authorizes activation. */
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const exec = promisify(execFile);
export const PROJECT_REF = 'snojlbqovlawewwqbviz';
const MIGRATION_PATH = /^supabase\/migrations\/([0-9]{8}(?:[0-9]{4}(?:[0-9]{2})?)?)_[^/]+\.sql$/;
const VERSION = /^[0-9]{8}(?:[0-9]{4}(?:[0-9]{2})?)?$/;

function uniqueVersions(values) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== 'string' || !VERSION.test(value))) {
    throw new Error('INVALID_MIGRATION_INVENTORY');
  }
  if (new Set(values).size !== values.length) throw new Error('DUPLICATE_MIGRATION_VERSION');
  return [...values].sort();
}

/** Pure comparison; tests never connect to a hosted project. */
export function compareMigrationInventory({ sourcePaths, hostedRows, sourceRevision }) {
  if (!Array.isArray(sourcePaths) || !Array.isArray(hostedRows) ||
      typeof sourceRevision !== 'string' || !/^[a-f\d]{40}$/i.test(sourceRevision)) {
    throw new Error('INVALID_MIGRATION_INVENTORY');
  }
  if (sourcePaths.length === 0 || sourcePaths.some((path) => typeof path !== 'string' || !MIGRATION_PATH.test(path))) {
    throw new Error('INVALID_MIGRATION_INVENTORY');
  }
  const source = uniqueVersions(sourcePaths.map((path) => path.match(MIGRATION_PATH)[1]));
  if (hostedRows.length === 0 || hostedRows.some((row) =>
    !row || typeof row !== 'object' || Array.isArray(row) ||
    typeof row.local !== 'string' || typeof row.remote !== 'string' ||
    (!row.local && !row.remote))) {
    throw new Error('INVALID_MIGRATION_INVENTORY');
  }
  const cliLocal = uniqueVersions(hostedRows.map((row) => row.local).filter(Boolean));
  const hosted = uniqueVersions(hostedRows.map((row) => row.remote).filter(Boolean));
  const sourceSet = new Set(source);
  const localSet = new Set(cliLocal);
  const hostedSet = new Set(hosted);
  const missingHosted = source.filter((version) => !hostedSet.has(version));
  const unexpectedHosted = hosted.filter((version) => !sourceSet.has(version));
  const missingCliLocal = source.filter((version) => !localSet.has(version));
  const unexpectedCliLocal = cliLocal.filter((version) => !sourceSet.has(version));
  const localSourceMatchesCli = missingCliLocal.length === 0 && unexpectedCliLocal.length === 0;
  return {
    schemaVersion: 1,
    scope: 'READ_ONLY_MIGRATION_VERSION_INVENTORY_NOT_SCHEMA_OR_RELEASE_PROOF',
    hostedProjectRef: PROJECT_REF,
    sourceRevision: sourceRevision.toLowerCase(),
    sourceMigrationCount: source.length,
    cliLocalMigrationCount: cliLocal.length,
    hostedMigrationCount: hosted.length,
    missingHosted,
    unexpectedHosted,
    missingCliLocal,
    unexpectedCliLocal,
    localSourceMatchesCli,
    hostedVersionsMatchSource: localSourceMatchesCli && missingHosted.length === 0 && unexpectedHosted.length === 0,
    hostedSchemaVerified: false,
    activation: {
      ready: false,
      status: 'BLOCKED',
      reason: localSourceMatchesCli && missingHosted.length === 0 && unexpectedHosted.length === 0
        ? 'OTHER_HOSTED_AND_PHYSICAL_GATES_NOT_EVALUATED'
        : 'MIGRATION_VERSION_DRIFT',
    },
  };
}

async function command(file, args, cwd) {
  const { stdout } = await exec(file, args, {
    cwd, timeout: 60000, maxBuffer: 1024 * 1024, encoding: 'utf8',
  });
  return stdout;
}

export async function readbackHostedMigrationInventory(cwd = process.cwd()) {
  const sourceRevision = (await command('git', ['rev-parse', 'HEAD'], cwd)).trim();
  const [paths, hosted] = await Promise.all([
    command('git', ['ls-tree', '-r', '--name-only', sourceRevision, '--', 'supabase/migrations'], cwd),
    command('supabase', ['migration', 'list', '--project-ref', PROJECT_REF, '--output-format', 'json'], cwd),
  ]);
  const parsed = JSON.parse(hosted);
  return compareMigrationInventory({
    sourceRevision,
    sourcePaths: paths.trim().split('\n').filter(Boolean),
    hostedRows: parsed?.migrations,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await readbackHostedMigrationInventory();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.hostedVersionsMatchSource ? 0 : 2;
  } catch {
    // The CLI may include credentials or private data in errors: never print its raw output.
    process.stdout.write(`${JSON.stringify({ schemaVersion: 1, scope: 'READ_ONLY_MIGRATION_VERSION_INVENTORY', hostedProjectRef: PROJECT_REF, readback: 'UNKNOWN', activation: { ready: false, status: 'BLOCKED' } })}\n`);
    process.exitCode = 2;
  }
}
