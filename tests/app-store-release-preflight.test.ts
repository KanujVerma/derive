import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { inspectAppStoreSource } from '../scripts/preflight-app-store-release.mjs';

const app = { expo: { version: '1.0.0', icon: './assets/icon.png', ios: {
  bundleIdentifier: 'com.derive.skincare', supportsTablet: false,
  config: { usesNonExemptEncryption: false },
  infoPlist: {
    NSCameraUsageDescription: 'Scan product barcodes and capture product or skin photos you choose.',
    NSPhotoLibraryUsageDescription: 'Choose product photos for your shelf or an image for a message.',
  },
}, extra: { eas: { projectId: '4100d696-3e03-4b2c-bdb3-1986d5f1a624' } } } };
const eas = { cli: { appVersionSource: 'remote' }, build: { production: {
  distribution: 'store', environment: 'production', autoIncrement: true,
  ios: { simulator: false }, env: { EXPO_PUBLIC_BUILD_FLAVOR: 'production', EXPO_PUBLIC_USE_REMOTE_SERVICE: 'false' },
} } };
const pkg = { version: '1.0.0' };
const source = { shell: "if (input.buildFlavor !== 'development') return 'legacy';", fixtureRoute: 'guarded', analytics: 'dev console only' };
const input = { app, eas, pkg, source, iconExists: true };

test('current production profile is blocked for Mock and legacy shell', () => {
  const report = inspectAppStoreSource(input);
  assert.equal(report.status, 'BLOCKED');
  assert(report.blockers.includes('PRODUCTION_MOCK_SERVICE'));
  assert(report.blockers.includes('PRODUCTION_LEGACY_SHELL'));
  assert.equal(report.gates.candidateArchive, 'READY_TO_VERIFY');
  assert.equal(report.gates.appStoreConnect, 'UNKNOWN');
});

test('Remote profile alone cannot pass without scanner-first hosted composition and archive', () => {
  const report = inspectAppStoreSource({ ...input, eas: { ...eas, build: { production: {
    ...eas.build.production, env: { EXPO_PUBLIC_BUILD_FLAVOR: 'production', EXPO_PUBLIC_USE_REMOTE_SERVICE: 'true' },
  } } } });
  assert(!report.blockers.includes('PRODUCTION_MOCK_SERVICE'));
  assert(report.blockers.includes('PRODUCTION_LEGACY_SHELL'));
  assert.equal(report.status, 'BLOCKED');
});

test('source change cannot become candidate PASS without final binary evidence', () => {
  const report = inspectAppStoreSource({ ...input, source: { ...source, shell: 'new implementation' },
    eas: { ...eas, build: { production: { ...eas.build.production, env: {
      EXPO_PUBLIC_BUILD_FLAVOR: 'production', EXPO_PUBLIC_USE_REMOTE_SERVICE: 'true',
    } } } },
  });
  assert.equal(report.gates.scannerFirstHostedShell, 'READY_TO_VERIFY');
  assert.equal(report.gates.candidateArchive, 'READY_TO_VERIFY');
  assert.notEqual(report.status, 'PASS');
  assert.equal(report.exitCode, 2);
});

test('invalid identity and release metadata fail closed', () => {
  const report = inspectAppStoreSource({ ...input, app: { expo: { ...app.expo, version: '0.0.0',
    ios: { ...app.expo.ios, bundleIdentifier: 'com.example.app', infoPlist: {} },
  } }, iconExists: false });
  assert(report.blockers.includes('BUNDLE_IDENTIFIER_MISMATCH'));
  assert(report.blockers.includes('VERSION_INVALID'));
  assert(report.blockers.includes('ICON_MISSING'));
  assert(report.blockers.includes('CAMERA_PURPOSE_MISSING'));
});

test('purpose strings covering only old flows fail when barcode, shelf, and message use is omitted', () => {
  const report = inspectAppStoreSource({ ...input, app: { expo: { ...app.expo, ios: {
    ...app.expo.ios, infoPlist: {
      NSCameraUsageDescription: 'Derive uses your camera to capture private skin progress photos and scan your current skincare shelf.',
      NSPhotoLibraryUsageDescription: 'Derive needs photo library access to upload photos of your skincare products.',
    },
  } } } });
  assert(report.blockers.includes('CAMERA_PURPOSE_INCOMPLETE'));
  assert(report.blockers.includes('PHOTO_LIBRARY_PURPOSE_INCOMPLETE'));
});

test('missing public config evidence remains unknown and supplied secret values never appear', () => {
  const report = inspectAppStoreSource({ ...input, publicConfig: {
    url: 'https://example.supabase.co', publishableKey: 'sb_secret_PRIVATE_NEVER_OUTPUT',
  } });
  assert.equal(report.gates.publicSupabaseConfig, 'BLOCKED');
  assert(!JSON.stringify(report).includes('PRIVATE_NEVER_OUTPUT'));
  assert.equal(inspectAppStoreSource(input).gates.publicSupabaseConfig, 'UNKNOWN');
});

test('CLI on actual source exits blocked and never emits injected secrets', () => {
  const result = spawnSync(process.execPath, ['scripts/preflight-app-store-release.mjs'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 10000,
    env: { ...process.env, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_PRIVATE_NEVER_OUTPUT' },
  });
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert(report.blockers.includes('PRODUCTION_MOCK_SERVICE'));
  assert(report.blockers.includes('PRODUCTION_LEGACY_SHELL'));
  assert(!result.stdout.includes('PRIVATE_NEVER_OUTPUT'));
});
