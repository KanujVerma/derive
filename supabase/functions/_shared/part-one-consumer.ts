import {runPartOneLookup,type PartOneLookupPorts} from './part-one-lookup.ts';
import {normalizeDatabaseDates} from './part-one-runtime.ts';
import {ExternalSourcePolicies} from '../../../src/domain/part-one/policies.ts';
import {ItemSnapshotSchema} from '../../../src/contracts/PartOne.ts';
export type PartOneWorkerRpc=(action:string,payload:Record<string,unknown>)=>Promise<any>;
export interface ConsumerOptions {rpc:PartOneWorkerRpc;lookupPorts?:Partial<PartOneLookupPorts>;renewEveryMs?:number}
/** Existing durable consumer, shared by supervised CLI and bounded ordinary Edge
 * composition. There is no perpetual loop or implicit provider in this module. */
export async function consumeOnce({ rpc, lookupPorts = {}, renewEveryMs = 10000 }: ConsumerOptions) {
  await rpc('heartbeat', { consumerVersion: 'part-one-primary-ledger-2' });
  const { job } = normalizeDatabaseDates(await rpc('claim', {})) as {job:any};
  if (!job) return false;
  const base = { jobId: job.id, leaseToken: job.leaseToken, expectedPublishRevision: job.publishRevision, targets: job.targets };
  let deferred = false;
  let renewalError: unknown;
  let renewal = Promise.resolve();
  const timer = setInterval(() => {
    if (deferred) return;
    renewal = renewal.then(async () => {
      await rpc('heartbeat', { consumerVersion: 'part-one-primary-ledger-2' });
      if (!deferred) await rpc('renew', base);
    }).catch(error => { renewalError = error; });
  }, renewEveryMs);
  const guarded = async (action: string, payload: Record<string, unknown>) => {
    await renewal;
    if (renewalError) throw renewalError;
    return normalizeDatabaseDates(await rpc(action, payload)) as any;
  };
  try {
    await runPartOneLookup(job, {
      now: () => new Date().toISOString(), uuid: () => crypto.randomUUID(),
      hash: async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),byte=>byte.toString(16).padStart(2,'0')).join(''),
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
