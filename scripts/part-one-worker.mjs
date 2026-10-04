#!/usr/bin/env node
/** Supervised local durable consumer. Source policies/configs default disabled;
 * no provider network transport, hosted scheduler, or private OCR upload exists.
 * Node 22 --experimental-strip-types loads the shared tested TypeScript pipeline.
 */
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {consumeOnce} from '../supabase/functions/_shared/part-one-consumer.ts';
export {consumeOnce};

/** Injection is for deterministic authorized fixtures. CLI has no way to enable
 * provider policies, endpoint configuration, or a DNS-pinned live transport. */

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
