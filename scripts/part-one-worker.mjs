#!/usr/bin/env node
/** Supervised local durable consumer. Source policies/configs default disabled;
 * no provider network transport, hosted scheduler, or private OCR upload exists.
 * Node 22 --experimental-strip-types loads the shared tested TypeScript pipeline.
 */
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { runPartOneLookup } from '../supabase/functions/_shared/part-one-lookup.ts';
import { normalizeDatabaseDates } from '../supabase/functions/_shared/part-one-runtime.ts';
import { ExternalSourcePolicies } from '../src/domain/part-one/policies.ts';
import { ItemSnapshotSchema } from '../src/contracts/PartOne.ts';

/** Injection is for deterministic authorized fixtures. CLI has no way to enable
 * provider policies, endpoint configuration, or a DNS-pinned live transport. */
export async function consumeOnce({ rpc, lookupPorts = {}, renewEveryMs = 10000 }) {
  await rpc('heartbeat', { consumerVersion: 'part-one-primary-ledger-2' });
  const { job } = normalizeDatabaseDates(await rpc('claim', {}));
  if (!job) return false;
  const base = { jobId: job.id, leaseToken: job.leaseToken, expectedPublishRevision: job.publishRevision, targets: job.targets };
  let deferred = false;
  let renewalError;
  let renewal = Promise.resolve();
  const timer = setInterval(() => {
    if (deferred) return;
    renewal = renewal.then(async () => {
      await rpc('heartbeat', { consumerVersion: 'part-one-primary-ledger-2' });
      if (!deferred) await rpc('renew', base);
    }).catch(error => { renewalError = error; });
  }, renewEveryMs);
  timer.unref?.();
  const guarded = async (action, payload) => {
    await renewal;
    if (renewalError) throw renewalError;
    return normalizeDatabaseDates(await rpc(action, payload));
  };
  try {
    await runPartOneLookup(job, {
      now: () => new Date().toISOString(), uuid: randomUUID,
      hash: async text => createHash('sha256').update(text).digest('hex'),
      policies: ExternalSourcePolicies, configs: {},
      // The catalog returns public immutable item data only, never owner/profile.
      readCatalog: async () => {
        const catalog = await guarded('catalog', base);
        if (!catalog) return null;
        const selected = catalog.item && Object.fromEntries(Object.keys(ItemSnapshotSchema.shape).map(k => [k, catalog.item[k]]));
        return { resultPatch: catalog.resultPatch, item: selected ? ItemSnapshotSchema.parse(selected) : null };
      },
      ...lookupPorts,
      reserve: async (stage, provider) => {
        const r = await guarded('reserve', { ...base, stage, provider });
        if (r.deferred) {
          // Quota transaction already relinquished the lease and durably owns
          // wakeup. Do not attempt a publication with that stale lease.
          deferred = true;
          return { reservationId: null, work: 'deferred_budget', nextEligibleAt: r.nextCheckAfter };
        }
        return { reservationId: r.reservationId };
      },
      dispatch: async reservationId => (await guarded('dispatch', { ...base, reservationId })).mayDispatch,
      checkpoint: async (stage, output, reservationId) => {
        // null leaves a dispatched/unknown reservation charged after timeout.
        if (!deferred) await guarded('checkpoint', { ...base, stage, output, reservationId });
      },
      admit: async payload => { await guarded('admit', payload); },
      publish: async publication => {
        if (deferred) return;
        await guarded(publication.work === 'retry_wait' ? 'retry' : 'finish', {
          ...base, resultPatch: publication.resultPatch, nextEligibleAt: publication.nextEligibleAt,
          terminalWork: publication.work === 'failed_final' ? 'failed_final' : null,
        });
      },
    });
    return true;
  } finally {
    clearInterval(timer);
    await renewal;
  }
}

async function main() {
  if (!process.env.SUPABASE_URL) throw new Error('Explicit task-isolated SUPABASE_URL is required');
  const url = new URL(process.env.SUPABASE_URL);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.protocol !== 'http:'
    || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Part 1 worker is restricted to an isolated local Supabase URL');
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Local service-role environment is required; no credential is created by this worker');
  const rpc = async (action, payload) => {
    const result = await fetch(new URL('/rest/v1/rpc/part_one_worker', url), {
      method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_action: action, p_payload: payload }), signal: AbortSignal.timeout(8000),
    });
    if (!result.ok) throw new Error(`Local ledger ${action} failed (${result.status}); no payload logged`);
    return result.json();
  };
  const once = process.argv.includes('--once');
  let stopping = false;
  process.on('SIGTERM', () => { stopping = true; });
  process.on('SIGINT', () => { stopping = true; });
  do {
    try {
      const consumed = await consumeOnce({ rpc });
      if (once) break;
      if (!consumed) await new Promise(resolve => setTimeout(resolve, 1000));
    } catch {
      console.error('Part 1 local consumer unavailable; no request/provider/private payload logged');
      if (once) { process.exitCode = 1; break; }
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  } while (!stopping);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(() => { console.error('Part 1 local consumer configuration unavailable; no secrets logged'); process.exitCode = 1; });
}
