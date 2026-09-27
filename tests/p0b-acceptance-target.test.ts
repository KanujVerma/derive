import assert from 'node:assert/strict';
import { assertDisposableLocalTarget } from '../scripts/acceptance/p0b/target.ts';

// Catches a drifted CLI target permitting writes to hosted, LAN or a lookalike host.
for (const target of [undefined, null, '', 'https://project.supabase.co', 'http://192.168.1.2:54321', 'http://127.0.0.1.evil:54321', 'http://127.0.0.1:54321/path', 'http://127.0.0.1:54322', 'http://user:password@127.0.0.1:54321']) {
  assert.throws(() => assertDisposableLocalTarget(target), /disposable local Supabase/);
}
assert.doesNotThrow(() => assertDisposableLocalTarget('http://127.0.0.1:54321'));
console.log('P0-B acceptance refuses hosted, LAN, credential and port drift before disposable writes');
