#!/usr/bin/env node
/** Read-only function-name drift check. Name parity never authorizes hosted activation. */
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const exec = promisify(execFile);
export const PROJECT_REF = 'snojlbqovlawewwqbviz';
const FUNCTION_PATH = /^supabase\/functions\/([a-z][a-z0-9-]*)\/index\.ts$/;
const FUNCTION_NAME = /^[a-z][a-z0-9-]*$/;

function uniqueNames(values) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== 'string' || !FUNCTION_NAME.test(value))) {
    throw new Error('INVALID_FUNCTION_INVENTORY');
  }
  const names = new Set(values);
  if (names.size !== values.length) throw new Error('DUPLICATE_FUNCTION_NAME');
  return [...names].sort();
}

/** Accepts already-read inventories so drift handling can be tested without network access. */
export function compareFunctionInventory({ sourcePaths, hostedRows, sourceRevision }) {
  if (!Array.isArray(sourcePaths) || !Array.isArray(hostedRows) ||
      typeof sourceRevision !== 'string' || !/^[a-f\d]{40}$/i.test(sourceRevision)) {
    throw new Error('INVALID_FUNCTION_INVENTORY');
  }
  const sourceNames = uniqueNames(sourcePaths.map((path) => {
    if (typeof path !== 'string') throw new Error('INVALID_FUNCTION_INVENTORY');
    return path.match(FUNCTION_PATH)?.[1] ?? null;
  }).filter((name) => name !== null));
  if (sourceNames.length === 0 || hostedRows.some((row) => !row || typeof row !== 'object')) {
    throw new Error('INVALID_FUNCTION_INVENTORY');
  }
  const hostedNames = uniqueNames(hostedRows.map((row) => row.slug));
  const sourceSet = new Set(sourceNames);
  const hostedSet = new Set(hostedNames);
  const missingHosted = sourceNames.filter((name) => !hostedSet.has(name));
  const unexpectedHosted = hostedNames.filter((name) => !sourceSet.has(name));
  return {
    schemaVersion: 1,
    scope: 'READ_ONLY_FUNCTION_NAME_INVENTORY_NOT_REVISION_OR_RELEASE_PROOF',
    hostedProjectRef: PROJECT_REF,
    sourceRevision: sourceRevision.toLowerCase(),
    sourceFunctionCount: sourceNames.length,
    hostedFunctionCount: hostedNames.length,
    missingHosted,
    unexpectedHosted,
    functionNamesMatch: missingHosted.length === 0 && unexpectedHosted.length === 0,
    hostedFunctionRevisionsVerified: false,
    activation: { ready: false, status: 'BLOCKED', reason: 'OTHER_HOSTED_AND_PHYSICAL_GATES_NOT_EVALUATED' },
  };
}

async function command(file, args, cwd) {
  const { stdout } = await exec(file, args, {
    cwd, timeout: 45000, maxBuffer: 1024 * 1024, encoding: 'utf8',
  });
  return stdout;
}

export async function readbackHostedFunctionInventory(cwd = process.cwd()) {
  const sourceRevision = (await command('git', ['rev-parse', 'HEAD'], cwd)).trim();
  const [paths, hosted] = await Promise.all([
    command('git', ['ls-tree', '-r', '--name-only', sourceRevision, '--', 'supabase/functions'], cwd),
    command('supabase', ['functions', 'list', '--project-ref', PROJECT_REF, '--output', 'json'], cwd),
  ]);
  return compareFunctionInventory({
    sourceRevision,
    sourcePaths: paths.trim().split('\n').filter((path) => FUNCTION_PATH.test(path)),
    hostedRows: JSON.parse(hosted),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await readbackHostedFunctionInventory();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.functionNamesMatch ? 0 : 2;
  } catch {
    // CLI errors and raw hosted responses may contain credentials: never echo them.
    process.stdout.write(`${JSON.stringify({ schemaVersion: 1, scope: 'READ_ONLY_FUNCTION_NAME_INVENTORY', hostedProjectRef: PROJECT_REF, readback: 'UNKNOWN', activation: { ready: false, status: 'BLOCKED' } })}\n`);
    process.exitCode = 2;
  }
}
