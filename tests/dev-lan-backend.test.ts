import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePublicEnvironment } from '../src/config/environment.ts';
import { resolveShellPresentation } from '../src/utils/shellPresentation.ts';
import { normalizeDevelopmentLanUrl } from '../src/config/localDevelopmentBackend.ts';

const url = 'http://192.168.1.20:54321';
const input = {
  buildFlavor: 'development', useRemoteService: 'true', supabaseUrl: url,
  legacySupabaseAnonKey: 'disposable-local-public-key',
  developmentSupabaseLanUrl: url, developmentRuntime: true,
};

test('Physical QA: exact opted-in private LAN backend works only in a development runtime', () => {
  const environment = resolvePublicEnvironment(input);
  assert.equal(environment.developmentSupabaseLanUrl, `${url}/`);
  assert.equal(resolveShellPresentation({ buildFlavor: 'development', remoteEnabled: true,
    supabaseUrl: url, developmentLanUrl: environment.developmentSupabaseLanUrl,
    developmentRuntime: true }), 'local_free_integration');
  assert.throws(() => resolvePublicEnvironment({ ...input, developmentRuntime: false }));
  assert.throws(() => resolvePublicEnvironment({ ...input, developmentRuntime: undefined }));
  assert.equal(resolveShellPresentation({ buildFlavor: 'development', remoteEnabled: true,
    supabaseUrl: url, developmentLanUrl: url, developmentRuntime: false }), 'legacy');
});

test('Physical QA: missing opt-in, target mismatch, Mock, staging and production never activate LAN access', () => {
  assert.throws(() => resolvePublicEnvironment({ ...input, developmentSupabaseLanUrl: '' }));
  assert.throws(() => resolvePublicEnvironment({ ...input, supabaseUrl: 'http://192.168.1.21:54321' }));
  assert.throws(() => resolvePublicEnvironment({ ...input, useRemoteService: 'false' }));
  for (const buildFlavor of ['remote-staging', 'production'] as const) {
    assert.throws(() => resolvePublicEnvironment({ ...input, buildFlavor }));
    assert.equal(resolveShellPresentation({ buildFlavor, remoteEnabled: true,
      supabaseUrl: url, developmentLanUrl: url, developmentRuntime: true }), 'legacy');
  }
  assert.equal(resolveShellPresentation({ buildFlavor: 'development', remoteEnabled: true,
    supabaseUrl: url, developmentLanUrl: '', developmentRuntime: true }), 'legacy');
  assert.equal(resolveShellPresentation({ buildFlavor: 'development', remoteEnabled: false,
    supabaseUrl: url, developmentLanUrl: url, developmentRuntime: true }), 'scanner_first_preview');
});

test('Physical QA: opt-in accepts only canonical RFC1918 IPv4 and the exact local API port/base URL', () => {
  for (const host of ['10.0.0.3', '172.16.0.3', '172.31.255.2', '192.168.0.3']) {
    assert.equal(normalizeDevelopmentLanUrl(`http://${host}:54321`), `http://${host}:54321/`);
  }
  for (const invalid of [
    'http://172.15.0.1:54321', 'http://172.32.0.1:54321', 'http://8.8.8.8:54321',
    'http://127.0.0.1:54321', 'http://169.254.1.2:54321', 'http://0.0.0.0:54321',
    'http://192.168.1.20:80', 'http://192.168.1.20', 'https://192.168.1.20:54321',
    'http://192.168.1.20:54321/auth/v1', 'http://192.168.1.20:54321/?x=1',
    'http://192.168.1.20:54321/#x', 'http://name:password@192.168.1.20:54321',
    'http://192.168.1.20.evil.test:54321', 'http://local-mac.test:54321',
    'https://snojlbqovlawewwqbviz.supabase.co', 'http://[::1]:54321',
    'http://0xc0a80114:54321', 'http://3232235796:54321', 'http://192.168.001.020:54321',
    'http://192.168.1.20:054321', 'http://192.168.1.20:54321/../', 'not a url',
  ]) assert.throws(() => normalizeDevelopmentLanUrl(invalid), invalid);
});

test('Physical QA: existing loopback and hosted configuration remain backward compatible', () => {
  assert.equal(resolvePublicEnvironment({}).developmentSupabaseLanUrl, undefined);
  assert.equal(resolvePublicEnvironment({ supabaseUrl: 'http://127.0.0.1:54321' }).supabaseUrl, 'http://127.0.0.1:54321');
  assert.equal(resolveShellPresentation({ buildFlavor: 'development', remoteEnabled: true,
    supabaseUrl: 'http://127.0.0.1:54321' }), 'local_free_integration');
  assert.equal(resolveShellPresentation({ buildFlavor: 'development', remoteEnabled: true,
    supabaseUrl: 'https://snojlbqovlawewwqbviz.supabase.co', developmentLanUrl: url,
    developmentRuntime: true }), 'legacy');
  assert.equal(resolvePublicEnvironment({ buildFlavor: 'production',
    supabaseUrl: 'https://project.supabase.co' }).buildFlavor, 'production');
});
