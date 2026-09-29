/** Real local Edge -> validated mobile helper -> owner-fenced controller -> Check gate. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { resolveProductLink } from '../src/services/productLinks.ts';
import { createProductLinkController } from '../src/presentation/product-links/controller.ts';
import { canPublishCheckResult, validateCheckResolution } from '../src/presentation/check/checkMemory.ts';

const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}));
assert.equal(status.API_URL, 'http://127.0.0.1:54321', 'Refuse non-local Supabase');
const options = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
const client = createClient(status.API_URL, status.ANON_KEY, options);
const created = await client.auth.signInAnonymously();
assert.ifError(created.error);
const ownerId = created.data.user.id;
let liveOwner = ownerId;
try {
  let firstCaseId;
  let calls = 0;
  const requests = [];
  const controller = createProductLinkController({ createRequestId: randomUUID, getCurrentOwner: () => liveOwner,
    transport: async (input) => {
      calls++;
      requests.push(input);
      const result = await resolveProductLink(input, client);
      assert.equal(result.status, 'resolution');
      if (calls === 1) {
        firstCaseId = result.resolution.caseId;
        throw new Error('Simulated lost response after real server completion');
      }
      return result;
    },
  });
  controller.setOwner(ownerId);
  controller.setInput('https://world.openbeautyfacts.org/product/036000291452');
  assert.equal(await controller.submit(), null);
  assert.equal(controller.getState().kind, 'error');
  assert.equal(calls, 1, 'no automatic retry');
  const result = await controller.submit();
  assert.equal(result.status, 'resolution');
  assert.equal(result.resolution.caseId, firstCaseId, 'response-loss retry keeps the same immutable case');
  assert.deepEqual(requests[0], requests[1]);
  const checked = validateCheckResolution(result.resolution);
  assert.equal(checked.truthSnapshot.resolutionCaseId, firstCaseId);
  assert.equal(checked.truthSnapshot.evidence.find(item => item.type === 'barcode')?.source, 'member_input');
  assert.equal(canPublishCheckResult(true, ownerId, liveOwner), true);
  assert.equal(checked.state, 'insufficient_evidence', 'a link alone cannot invent a product or formula');

  // A live owner change wins even before a React effect can clear the old field.
  const stale = createProductLinkController({ createRequestId: randomUUID, getCurrentOwner: () => liveOwner,
    transport: async (input) => { const response = await resolveProductLink(input, client); liveOwner = null; return response; },
  });
  stale.setOwner(ownerId); stale.setInput('https://www.amazon.com/dp/B00ABC1234');
  assert.equal(await stale.submit(), null);
  assert.equal(stale.getState().ownerId, null);
  assert.equal(stale.getState().url, '');
  console.log('Product link client journey: real Edge, validated helper, owner controller, Check gate and response-loss retry passed');
} finally {
  assert.ifError((await admin.auth.admin.deleteUser(ownerId)).error);
}
