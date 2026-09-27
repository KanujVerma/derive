import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { preflightScannerDevice } from '../scripts/preflight-scanner-device.mjs';

const HEAD = '105b3a3c41132287e7b4df1331eefe72111e58d4';
const PRIVATE = 'PRIVATE_SECRET_NEVER_PRINT';
const header = `${'Name'.padEnd(28)}${'Hostname'.padEnd(42)}${'Identifier'.padEnd(39)}${'State'.padEnd(14)}Model`;
const device = (state = 'unavailable', model = 'iPhone 16 Pro Max (iPhone17,2)') => `${PRIVATE.padEnd(28)}${`${PRIVATE}.local`.padEnd(42)}${'15FF5C3A-F2FC-59CA-9C07-90C0B9EA0CB6'.padEnd(39)}${state.padEnd(14)}${model}`;
const files: Record<string, string> = {
  'package.json': JSON.stringify({ dependencies: { expo: '~57.0.23', 'expo-dev-client': '~57.0.19' } }),
  'app.json': JSON.stringify({ expo: { ios: { bundleIdentifier: PRIVATE, infoPlist: { NSCameraUsageDescription: PRIVATE } } } }),
  'eas.json': JSON.stringify({ build: { development: { developmentClient: true, env: { SECRET: PRIVATE } } } }),
  'modules/derive-face-capture/expo-module.config.json': JSON.stringify({ platforms: ['ios'], ios: { modules: [PRIVATE] } }),
};

function fixtures(overrides: Record<string, { ok: boolean; stdout: string } | Error> = {}) {
  const calls: { command: string; args: string[] }[] = [];
  const reads: string[] = [];
  const outputs: Record<string, { ok: boolean; stdout: string } | Error> = {
    'git rev-parse HEAD': { ok: true, stdout: HEAD },
    'git --no-optional-locks -c core.fsmonitor=false status --porcelain': { ok: true, stdout: '' },
    'xcodebuild -version': { ok: true, stdout: 'Xcode 26.6\nBuild version 17F113\n' },
    'xcrun simctl list devices available --json': { ok: true, stdout: JSON.stringify({ devices: {
      'com.apple.CoreSimulator.SimRuntime.iOS-26-5': [
        { name: PRIVATE, udid: PRIVATE, dataPath: `/Users/${PRIVATE}/device`, deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro', isAvailable: true, state: 'Shutdown' },
        { name: PRIVATE, udid: PRIVATE, deviceTypeIdentifier: 'com.apple.CoreSimulator.SimDeviceType.iPhone-17', isAvailable: true, state: 'Booted' },
      ],
    } }) },
    'xcrun devicectl list devices': { ok: true, stdout: `${header}\n${'-'.repeat(header.length)}\n${device()}\n` },
    'security find-identity -v -p codesigning': { ok: true, stdout: `1) HASH Apple Development: ${PRIVATE}\n 1 valid identities found\n` },
    ...overrides,
  };
  return {
    calls, reads,
    options: {
      runCommand: async (command: string, args: string[]) => {
        calls.push({ command, args });
        const result = outputs[[command, ...args].join(' ')];
        if (result instanceof Error) throw result;
        return result;
      },
      readText: async (filename: string) => { reads.push(filename); if (!(filename in files)) throw new Error(PRIVATE); return files[filename]; },
      environment: { EXPO_PUBLIC_BUILD_FLAVOR: 'development', EXPO_PUBLIC_USE_REMOTE_SERVICE: 'false',
        EXPO_PUBLIC_SUPABASE_URL: `https://${PRIVATE}.example`, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: PRIVATE },
    },
  };
}

test('preflight reports observed counts and model only, without claiming Expo Go or physical acceptance', async () => {
  const result = await preflightScannerDevice(fixtures().options);
  assert.deepEqual(result.source, { head: HEAD, worktreeClean: true });
  assert.equal(result.toolchain.xcodeVersion, '26.6');
  assert.equal(result.toolchain.signingIdentityCount, 1);
  assert.equal(result.simulators.availableCount, 2);
  assert.equal(result.simulators.bootedCount, 1);
  assert.deepEqual(result.physicalDevices, { status: 'observed', listedCount: 1, availableCount: 0,
    models: [{ model: 'iPhone 16 Pro Max', availability: 'unavailable' }] });
  assert.equal(result.buildConfiguration.customNativeModuleManifestObserved, true);
  assert.equal(result.runtime.expoGoCompatibility, 'UNKNOWN');
  assert.equal(result.runtime.physicalAcceptance, 'PHYSICAL_UNVERIFIED');
  assert.equal(result.runtime.backendConnectivity, 'NOT_PROBED');
});

test('safe JSON excludes names, identifiers, paths, key values, certificates and raw native errors', async () => {
  const fixture = fixtures({ 'git --no-optional-locks -c core.fsmonitor=false status --porcelain': { ok: true, stdout: ` M /Users/${PRIVATE}/sensitive-file` } });
  const result = await preflightScannerDevice(fixture.options);
  assert.equal(result.source.worktreeClean, false);
  const json = JSON.stringify(result);
  for (const forbidden of [PRIVATE, '15FF5C3A', '/Users/', '.local', 'Apple Development:', 'HASH', 'udid', 'serialNumber', 'dataPath']) {
    assert.equal(json.includes(forbidden), false, `must exclude ${forbidden}`);
  }
});

test('failed commands are unknown, never zero devices or missing signing identities', async () => {
  const fixture = fixtures({
    'git rev-parse HEAD': new Error(`${PRIVATE}/.git denied`),
    'git --no-optional-locks -c core.fsmonitor=false status --porcelain': { ok: false, stdout: PRIVATE },
    'xcodebuild -version': new Error(PRIVATE),
    'xcrun simctl list devices available --json': { ok: false, stdout: PRIVATE },
    'xcrun devicectl list devices': new Error(PRIVATE),
    'security find-identity -v -p codesigning': { ok: false, stdout: '0 valid identities found' },
  });
  const result = await preflightScannerDevice(fixture.options);
  assert.deepEqual(result.source, { head: null, worktreeClean: null });
  assert.equal(result.toolchain.signingIdentityCount, null);
  assert.equal(result.toolchain.xcodeStatus, 'unknown');
  assert.deepEqual(result.simulators, { status: 'unknown', availableCount: null, bootedCount: null, models: [] });
  assert.deepEqual(result.physicalDevices, { status: 'unknown', listedCount: null, availableCount: null, models: [] });
  assert.equal(JSON.stringify(result).includes(PRIVATE), false);
});

test('partial availability retains known counts but leaves unrecognized state and model unknown', async () => {
  const fixture = fixtures({
    'xcrun devicectl list devices': { ok: true, stdout: `${header}\n${device('connecting', `iPhone ${PRIVATE}`)}\n` },
    'xcrun simctl list devices available --json': { ok: true, stdout: JSON.stringify({ devices: {
      'com.apple.CoreSimulator.SimRuntime.iOS-26-5': [{ deviceTypeIdentifier: PRIVATE, isAvailable: true, state: 'Creating' }],
    } }) },
  });
  const result = await preflightScannerDevice(fixture.options);
  assert.equal(result.physicalDevices.listedCount, 1);
  assert.equal(result.physicalDevices.availableCount, null);
  assert.deepEqual(result.physicalDevices.models, [{ model: null, availability: 'unknown' }]);
  assert.equal(result.simulators.availableCount, 1);
  assert.equal(result.simulators.bootedCount, null);
  assert.equal(result.simulators.models[0].model, null);
  assert.equal(JSON.stringify(result).includes(PRIVATE), false);
});

test('explicit successful empty inventory and zero identities differ from malformed or missing probe output', async () => {
  const empty = fixtures({
    'xcrun devicectl list devices': { ok: true, stdout: `${header}\n${'-'.repeat(header.length)}\n` },
    'xcrun simctl list devices available --json': { ok: true, stdout: '{"devices":{"com.apple.CoreSimulator.SimRuntime.iOS-26-5":[]}}' },
    'security find-identity -v -p codesigning': { ok: true, stdout: '0 valid identities found' },
  });
  const result = await preflightScannerDevice(empty.options);
  assert.equal(result.physicalDevices.listedCount, 0);
  assert.equal(result.simulators.availableCount, 0);
  assert.equal(result.toolchain.signingIdentityCount, 0);
  const malformed = await preflightScannerDevice(fixtures({
    'xcrun devicectl list devices': { ok: true, stdout: PRIVATE },
    'xcrun simctl list devices available --json': { ok: true, stdout: '{}' },
    'security find-identity -v -p codesigning': { ok: true, stdout: PRIVATE },
  }).options);
  assert.equal(malformed.physicalDevices.listedCount, null);
  assert.equal(malformed.simulators.availableCount, null);
  assert.equal(malformed.toolchain.signingIdentityCount, null);
  const invalidCount = await preflightScannerDevice(fixtures({
    'security find-identity -v -p codesigning': { ok: true, stdout: '999999999999999999999999 valid identities found' },
  }).options);
  assert.equal(invalidCount.toolchain.signingStatus, 'unknown');
  assert.equal(invalidCount.toolchain.signingIdentityCount, null);
});

test('preflight has only fixed read-only probes and reads config shape without env files or service calls', async () => {
  const fixture = fixtures();
  await preflightScannerDevice(fixture.options);
  assert.deepEqual(fixture.calls, [
    { command: 'git', args: ['rev-parse', 'HEAD'] }, { command: 'git', args: ['--no-optional-locks', '-c', 'core.fsmonitor=false', 'status', '--porcelain'] },
    { command: 'xcodebuild', args: ['-version'] }, { command: 'xcrun', args: ['simctl', 'list', 'devices', 'available', '--json'] },
    { command: 'xcrun', args: ['devicectl', 'list', 'devices'] }, { command: 'security', args: ['find-identity', '-v', '-p', 'codesigning'] },
  ]);
  assert.deepEqual(fixture.reads, ['package.json', 'app.json', 'eas.json', 'modules/derive-face-capture/expo-module.config.json']);
  const script = readFileSync(new URL('../scripts/preflight-scanner-device.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(script, /\bfetch\s*\(|\bwriteFile\b|\bsupabase\s+status\b|\bshell\s*:/);
});

test('missing or malformed config is unknown; process configuration shape never implies the installed runtime', async () => {
  const fixture = fixtures();
  const result = await preflightScannerDevice({ ...fixture.options,
    readText: async () => { throw new Error(PRIVATE); },
    environment: { EXPO_PUBLIC_BUILD_FLAVOR: PRIVATE, EXPO_PUBLIC_USE_REMOTE_SERVICE: PRIVATE, EXPO_PUBLIC_SUPABASE_URL: `file://${PRIVATE}` },
  });
  assert.equal(result.buildConfiguration.expoDependencyDeclared, null);
  assert.equal(result.buildConfiguration.cameraUsageDescriptionDeclared, null);
  assert.equal(result.buildConfiguration.customNativeModuleManifestObserved, null);
  assert.equal(result.buildConfiguration.processEnvironment.buildFlavorRecognized, false);
  assert.equal(result.buildConfiguration.processEnvironment.backendUrlAbsolute, false);
  assert.equal(result.runtime.installedBinaryIdentity, 'NOT_PROBED');
  assert.equal(JSON.stringify(result).includes(PRIVATE), false);
});
