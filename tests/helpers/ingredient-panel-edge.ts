import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as identity from '../../supabase/functions/_shared/product-identity.ts';
import * as barcode from '../../supabase/functions/_shared/barcode-provenance.ts';
import * as ingredients from '../../supabase/functions/_shared/ingredient-candidates.ts';
import * as attempts from '../../supabase/functions/_shared/ingredient-panel-attempts.ts';
import { unresolvedProductTruth, verifiedProductTruth } from '../../src/fixtures/product-truth/snapshots.ts';

const access: Record<string, unknown> = {};
new Function('exports', ts.transpileModule(readFileSync(new URL('../../supabase/functions/_shared/access.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(access);

export const owner = 'ac000000-0000-4000-8000-000000000001';
export const otherOwner = 'ac000000-0000-4000-8000-000000000002';
export const scan = 'ac000000-0000-4000-8000-000000000003';
export const rootId = verifiedProductTruth.resolutionCaseId;
export const parentId = verifiedProductTruth.snapshotId;
export const photoPath = (n: number, role = 'ingredients', user = owner) => `${user}/free_scan/${role}/ac000000-0000-4000-8000-${String(n).padStart(12, '0')}.jpg`;
export const requestId = (n: number) => `ac100000-0000-4000-8000-${String(n).padStart(12, '0')}`;
type Call = { name: string; args: Record<string, any> };
type Result = { data: any; error: { code?: string } | null };
type Options = {
  userId?: string;
  grant?: boolean;
  stored?: boolean;
  root?: Record<string, unknown> | null;
  parent?: Record<string, unknown> | null;
  prior?: Record<string, unknown> | null;
  eligibleIdentity?: boolean;
  rpc?: (call: Call) => Promise<Result> | Result;
};

/** Real resolver entrypoint and new coordinator. Only existing Auth/DB/Storage
 * transport is synthetic; no fixture ever falls back to the network. The local
 * SQL runner supplies actual PostgreSQL RPCs through the same port.
 */
export function ingredientEdgeFixture(options: Options = {}) {
  const calls: Call[] = [], queries: { table: string; filters: Record<string, unknown> }[] = [];
  const userId = options.userId ?? owner;
  const root = options.root === undefined ? { id: rootId, consumer: 'scan', resolution_state: 'identified_formula_unverified',
    next_action: 'photograph_ingredients', product_id: verifiedProductTruth.product!.productId,
    variant_id: verifiedProductTruth.product!.variantId, truth_revision: 1, requires_founder_review: false, evidence_snapshot: {} } : options.root;
  const parent = options.parent === undefined ? { id: parentId, case_revision: 1 } : options.parent;
  const admin = {
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const data = () => {
        queries.push({ table, filters: { ...filters } });
        if (table === 'free_product_evidence_grants') return options.grant === false ? null : { id: requestId(90) };
        if (table === 'product_resolution_cases') return filters.id === rootId && filters.user_id === owner ? root : null;
        if (table === 'product_resolution_continuations') return options.prior ?? null;
        if (table === 'product_truth_snapshots') return filters.user_id === owner && filters.case_id === rootId && filters.id === parentId ? parent : null;
        return [];
      };
      const query: any = {
        select: () => query, eq: (key: string, value: unknown) => { filters[key] = value; return query; },
        order: () => query, limit: () => query, range: () => query, in: () => query, not: () => query,
        maybeSingle: async () => ({ data: data(), error: null }), single: async () => ({ data: data(), error: null }),
        then: (yes: (result: Result) => unknown, no: (error: unknown) => unknown) => Promise.resolve({ data: data(), error: null }).then(yes, no),
      };
      return query;
    },
    storage: { from: (bucket: string) => {
      assert.equal(bucket, 'customer-product-evidence');
      return { list: async (prefix: string, input: { search: string }) => ({ data: options.stored === false ? [] : [{ name: input.search }], error: null }) };
    } },
    rpc: async (name: string, args: Record<string, any>) => {
      const call = { name, args }; calls.push(call);
      if (options.rpc) return options.rpc(call);
      if (name === 'reserve_product_ingredient_panel') return { data: { decision: 'reserved', attemptsUsed: 1, leaseId: requestId(91) }, error: null };
      if (name === 'settle_product_ingredient_panel') return { data: { decision: 'settled', attemptsUsed: 1, reason: args.p_reason }, error: null };
      if (name === 'record_product_resolution') return { data: { id: options.eligibleIdentity ? rootId : requestId(92), consumer: 'scan', evidence_snapshot: args.p_evidence_snapshot }, error: null };
      if (name === 'seal_product_truth_snapshot') return { data: options.eligibleIdentity ? { ...verifiedProductTruth, state: 'identified_formula_unverified', formula: null, nextRequiredEvidence: 'ingredients', catalogReferences: { ...verifiedProductTruth.catalogReferences, formulaVersionId: null } } : { ...unresolvedProductTruth, resolutionCaseId: args.p_case_id }, error: null };
      if (name === 'bind_product_ingredient_scan') return { data: args.p_scan_session_id, error: null };
      throw new Error('Unverified fixture RPC: ' + name);
    },
  };
  class ServiceError extends Error {
    code: string; status: number;
    constructor(code: string, message: string, status: number) { super(message); this.code = code; this.status = status; }
  }
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'private, no-store, max-age=0' } });
  const modules: Record<string, unknown> = {
    'jsr:@supabase/functions-js/edge-runtime.d.ts': {},
    '../_shared/product-identity.ts': identity, '../_shared/access.ts': access,
    '../_shared/barcode-provenance.ts': barcode, '../_shared/ingredient-candidates.ts': ingredients,
    '../_shared/ingredient-panel-attempts.ts': attempts,
    '../_shared/runtime.ts': { ServiceError, corsHeaders: {}, jsonResponse: json,
      errorResponse: (error: unknown) => error instanceof ServiceError ? json({ code: error.code, error: error.message }, error.status) : json({ code: 'INTERNAL_ERROR' }, 500),
      readJsonObject: (req: Request) => req.json(), requireMemberEntitlement: async () => { throw new Error('Anonymous fixtures must never query membership'); },
      authenticate: async (req: Request) => {
        if (req.headers.get('authorization') !== 'Bearer synthetic-test-token') throw new ServiceError('UNAUTHORIZED', 'Authentication required', 401);
        return { userId, user: { id: userId, is_anonymous: true }, admin };
      } },
  };
  let handler: ((req: Request) => Promise<Response>) | undefined;
  const source = readFileSync(new URL('../../supabase/functions/resolve-product-identity/index.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  assert.deepEqual(compiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error), []);
  new Function('require', 'exports', 'Deno', compiled.outputText)((name: string) => { assert.ok(name in modules, name); return modules[name]; }, {}, {
    serve: (fn: typeof handler) => { handler = fn; },
  });
  assert.ok(handler);
  const invoke = async (body: unknown, authorization = 'Bearer synthetic-test-token') => handler!(new Request('https://synthetic.invalid/resolve-product-identity', {
    method: 'POST', headers: { authorization }, body: JSON.stringify(body),
  }));
  return { admin, calls, queries, invoke, client: { functions: { invoke: async (name: string, options: { body: unknown }) => {
    assert.equal(name, 'resolve-product-identity'); const response = await invoke(options.body);
    return { data: await response.json(), error: response.ok ? null : { message: 'Synthetic HTTP error' } };
  } } } };
}
