/** Authenticated link intake smoke. Refuses hosted targets; no provider fetch. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const status = JSON.parse(execFileSync('supabase', ['status', '-o', 'json'], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}));
assert.equal(status.API_URL, 'http://127.0.0.1:54321', 'Refuse non-local Supabase');
const makeClient = (key) => createClient(status.API_URL, key, { auth: { autoRefreshToken: false, persistSession: false } });
const admin = makeClient(status.SERVICE_ROLE_KEY);
const first = makeClient(status.ANON_KEY);
const second = makeClient(status.ANON_KEY);
const owners = [];
const invoke = async (client, body) => {
  const { data, error } = await client.functions.invoke('resolve-product-link', { body });
  return { data, error, status: error?.context?.status ?? 200 };
};

try {
  for (const client of [first, second]) {
    const created = await client.auth.signInAnonymously();
    assert.ifError(created.error);
    owners.push(created.data.user.id);
  }
  const unauthenticated = await fetch(`${status.API_URL}/functions/v1/resolve-product-link`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  assert.equal(unauthenticated.status, 401);
  const amazon = await invoke(first, { requestId: randomUUID(), url: 'https://www.amazon.com/dp/B00ABC1234?tag=private' });
  assert.ifError(amazon.error);
  assert.equal(amazon.data.status, 'needs_details');
  assert.equal(amazon.data.sourceUrl, 'https://www.amazon.com/dp/B00ABC1234');
  assert.equal(amazon.data.nextAction, 'search_or_photo');
  const daily = await invoke(first, { requestId: randomUUID(),
    url: 'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=9c084eb9-91b0-49be-9830-19c8920d4b21' });
  assert.ifError(daily.error);
  assert.equal(daily.data.status, 'needs_details', 'Serve with default-off DailyMed for this smoke');
  assert.equal(daily.data.source, 'dailymed');
  const invalid = await invoke(first, { requestId: randomUUID(), url: 'https://169.254.169.254/latest/meta-data' });
  assert.equal(invalid.status, 400);
  const input = { requestId: randomUUID(), url: 'https://world.openbeautyfacts.org/product/036000291452' };
  const firstResult = await invoke(first, input);
  assert.ifError(firstResult.error);
  assert.equal(firstResult.data.status, 'resolution');
  assert.equal(firstResult.data.resolution.state, 'insufficient_evidence');
  assert.equal(firstResult.data.resolution.product, undefined);
  assert.equal(firstResult.data.resolution.truthSnapshot.evidence.find((item) => item.type === 'barcode')?.source, 'member_input');
  const storedEvidence = await admin.from('product_resolution_evidence').select('source_type')
    .eq('case_id', firstResult.data.resolution.caseId).eq('evidence_type', 'barcode');
  assert.ifError(storedEvidence.error);
  assert.deepEqual(storedEvidence.data, [{ source_type: 'member_input' }]);
  const retried = await invoke(first, input);
  assert.ifError(retried.error);
  assert.equal(retried.data.resolution.caseId, firstResult.data.resolution.caseId);
  const secondResult = await invoke(second, input);
  assert.ifError(secondResult.error);
  assert.notEqual(secondResult.data.resolution.caseId, firstResult.data.resolution.caseId);
  const visible = await second.from('product_resolution_cases').select('id').eq('id', firstResult.data.resolution.caseId);
  assert.ifError(visible.error);
  assert.deepEqual(visible.data, []);
  console.log('Product links: Auth, invalid URL, private owner/retry resolution, disabled DailyMed and Amazon recovery passed');
} finally {
  for (const owner of owners) assert.ifError((await admin.auth.admin.deleteUser(owner)).error);
}
