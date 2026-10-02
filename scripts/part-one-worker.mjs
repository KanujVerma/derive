#!/usr/bin/env node
/** Local supervised ledger consumer. No external adapters are authorized.
 * Run with local SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the isolated
 * stack environment, then `node scripts/part-one-worker.mjs [--once]`.
 * The process heartbeat is truthful only while this process is running; a
 * stopped consumer becomes unavailable after 30s. No hosted scheduling implied.
 */
if (!process.env.SUPABASE_URL) throw new Error('Explicit task-isolated SUPABASE_URL is required');
const url = new URL(process.env.SUPABASE_URL);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.protocol !== 'http:'
  || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
  throw new Error('Part 1 worker is restricted to an isolated local Supabase URL');
}
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key) throw new Error('Local service-role environment is required; no credential is created by this worker');
const once = process.argv.includes('--once');
let stopping = false;
process.on('SIGTERM', () => { stopping=true; });
process.on('SIGINT', () => { stopping=true; });
async function rpc(action, payload) {
  const result = await fetch(new URL('/rest/v1/rpc/part_one_worker',url),{
    method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
    body:JSON.stringify({p_action:action,p_payload:payload}),signal:AbortSignal.timeout(8000),
  });
  if (!result.ok) throw new Error(`Local ledger ${action} failed (${result.status}); no payload logged`);
  return result.json();
}
export async function consumeOnce() {
  await rpc('heartbeat',{consumerVersion:'part-one-local-disabled-adapters-1'});
  const {job}=await rpc('claim',{});
  if (!job) return false;
  const base={jobId:job.id,leaseToken:job.leaseToken,expectedPublishRevision:job.publishRevision,targets:job.targets};
  if (job.unknownReservations.length) {
    // An ambiguous dispatched call never receives an automatic retry/release.
    await rpc('retry',{...base,resultPatch:{reasonCodes:['unknown_call_outcome']}});
    return true;
  }
  if (!job.checkpoints.source_policy) await rpc('checkpoint',{
    ...base,stage:'source_policy',reservationId:null,
    output:{status:'disallowed_by_source_policy',provider:'all_external',policyVersion:'pending-1',parsedNegative:false},
  });
  // Catalog identity was checked before enqueue. Unapproved provider coverage
  // is a terminal, explicit state, never a negative product cache.
  await rpc('finish',{...base,resultPatch:{reasonCodes:['source_blocked']}});
  return true;
}
do {
  try {
    const consumed=await consumeOnce();
    if (once) break;
    if (!consumed) await new Promise(resolve=>setTimeout(resolve,1000));
  } catch {
    console.error('Part 1 local consumer unavailable; no request/provider/private payload logged');
    if (once) process.exitCode=1;
    if (once) break;
    await new Promise(resolve=>setTimeout(resolve,3000));
  }
} while (!stopping);
