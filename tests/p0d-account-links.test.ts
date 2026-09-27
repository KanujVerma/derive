import assert from 'node:assert/strict';
import test from 'node:test';
import { openCustomerAccountLink } from '../src/presentation/customer-journey/accountLinks.ts';
test('failed Privacy and Support opens resolve to a plain retry message and never leak the exception', async () => {
 for (const label of ['Privacy', 'Support'] as const) {
  const result = await openCustomerAccountLink(label, 'https://example.com', { openURL: async () => { throw new Error('private native error detail'); } });
  assert.deepEqual(result, { error: `${label} could not be opened. Check your connection and try again.` });
 }
});
test('retry uses the configured URL again and clears the failure after a successful open', async () => {
 const urls: string[] = []; let fail = true;
 const open = async (url: string) => { urls.push(url); if (fail) throw new Error('unavailable'); };
 assert((await openCustomerAccountLink('Support', 'https://example.com/support', { openURL: open })).error);
 fail = false; assert.deepEqual(await openCustomerAccountLink('Support', 'https://example.com/support', { openURL: open }), { error: null });
 assert.deepEqual(urls, ['https://example.com/support', 'https://example.com/support']);
});
test('an absent link is recoverable without trying to open a fabricated destination', async () => {
 let calls = 0;
 assert((await openCustomerAccountLink('Privacy', '', { openURL: async () => { calls++; } })).error);
 assert.equal(calls, 0);
});

test('native-style link opener retains its receiver through failure and customer retry', async () => {
 const native = { available: false, calls: 0, async openURL(_url: string) { this.calls++; if (!this.available) throw new Error('native destination unavailable'); } };
 assert((await openCustomerAccountLink('Support', 'https://example.com/support', native)).error);
 native.available = true;
 assert.deepEqual(await openCustomerAccountLink('Support', 'https://example.com/support', native), { error: null });
 assert.equal(native.calls, 2);
});
