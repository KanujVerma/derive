/** Read-only source preflight. A source report cannot certify an App Store candidate. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_ID = '4100d696-3e03-4b2c-bdb3-1986d5f1a624';
const BUNDLE_ID = 'com.derive.skincare';
const LEGACY_SHELL = /if\s*\(input\.buildFlavor\s*!==\s*['"]development['"]\)\s*return\s*['"]legacy['"]\s*;/;

function hostedPublicConfig(config) {
  if (!config) return 'UNKNOWN';
  const { url, publishableKey } = config;
  if (typeof url !== 'string' || typeof publishableKey !== 'string') return 'BLOCKED';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.supabase\.co$/.test(parsed.hostname)
      || parsed.port || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password) return 'BLOCKED';
  } catch { return 'BLOCKED'; }
  return /^sb_publishable_[A-Za-z0-9_-]{22}_[A-Za-z0-9_-]{8}$/.test(publishableKey)
    ? 'READY_TO_VERIFY' : 'BLOCKED';
}

/**
 * All inputs are explicit. Output contains no URL, key, source text, or customer content.
 * @param {{app: any, eas: any, pkg: any, source: {shell?: string}, iconExists: boolean,
 *   publicConfig?: {url?: string, publishableKey?: string}}} input
 */
export function inspectAppStoreSource({ app, eas, pkg, source, iconExists, publicConfig = undefined }) {
  const blockers = [];
  const gates = {
    bundleIdentifier: 'BLOCKED', marketingVersion: 'BLOCKED', appIcon: 'BLOCKED',
    deviceFamily: 'UNKNOWN', minimumIos: 'UNKNOWN', easProject: 'BLOCKED',
    buildProfile: 'BLOCKED', remoteBuildNumber: 'BLOCKED', serviceMode: 'BLOCKED',
    scannerFirstHostedShell: 'READY_TO_VERIFY', publicSupabaseConfig: hostedPublicConfig(publicConfig),
    encryptionDeclaration: 'BLOCKED', cameraPurpose: 'BLOCKED', photoLibraryPurpose: 'BLOCKED',
    fixtureRoutes: 'READY_TO_VERIFY', diagnostics: 'READY_TO_VERIFY',
    privacyManifests: 'READY_TO_VERIFY', requiredReasonApis: 'READY_TO_VERIFY',
    trackingAttIdfa: 'READY_TO_VERIFY', easToolchain: 'READY_TO_VERIFY',
    candidateArchive: 'READY_TO_VERIFY', appStoreConnect: 'UNKNOWN',
  };
  const expo = app?.expo ?? {};
  const ios = expo.ios ?? {};
  const profile = eas?.build?.production ?? {};
  const env = profile.env ?? {};
  const check = (gate, ok, code) => { gates[gate] = ok ? 'PASS' : 'BLOCKED'; if (!ok) blockers.push(code); };

  check('bundleIdentifier', ios.bundleIdentifier === BUNDLE_ID, 'BUNDLE_IDENTIFIER_MISMATCH');
  check('marketingVersion', typeof expo.version === 'string' && /^\d+\.\d+\.\d+$/.test(expo.version)
    && expo.version !== '0.0.0' && expo.version === pkg?.version, 'VERSION_INVALID');
  check('appIcon', typeof expo.icon === 'string' && iconExists === true, 'ICON_MISSING');
  gates.deviceFamily = ios.supportsTablet === false ? 'PASS' : 'UNKNOWN';
  gates.minimumIos = typeof ios.deploymentTarget === 'string' ? 'READY_TO_VERIFY' : 'UNKNOWN';
  check('easProject', expo.extra?.eas?.projectId === PROJECT_ID, 'EAS_PROJECT_MISMATCH');
  check('buildProfile', profile.distribution === 'store' && profile.environment === 'production'
    && profile.ios?.simulator === false && env.EXPO_PUBLIC_BUILD_FLAVOR === 'production', 'PRODUCTION_PROFILE_INVALID');
  check('remoteBuildNumber', eas?.cli?.appVersionSource === 'remote' && profile.autoIncrement === true,
    'REMOTE_BUILD_NUMBER_STRATEGY_MISSING');
  check('serviceMode', env.EXPO_PUBLIC_USE_REMOTE_SERVICE === 'true', 'PRODUCTION_MOCK_SERVICE');
  if (typeof source?.shell !== 'string' || LEGACY_SHELL.test(source.shell)) {
    gates.scannerFirstHostedShell = 'BLOCKED';
    blockers.push('PRODUCTION_LEGACY_SHELL');
  }
  check('encryptionDeclaration', ios.config?.usesNonExemptEncryption === false,
    'ENCRYPTION_DECLARATION_MISSING');
  const cameraPurpose = ios.infoPlist?.NSCameraUsageDescription;
  const libraryPurpose = ios.infoPlist?.NSPhotoLibraryUsageDescription;
  check('cameraPurpose', typeof cameraPurpose === 'string' && cameraPurpose.trim().length > 0,
    'CAMERA_PURPOSE_MISSING');
  if (gates.cameraPurpose === 'PASS') check('cameraPurpose', /bar\s?code/i.test(cameraPurpose)
    && /product/i.test(cameraPurpose) && /skin/i.test(cameraPurpose), 'CAMERA_PURPOSE_INCOMPLETE');
  check('photoLibraryPurpose', typeof libraryPurpose === 'string' && libraryPurpose.trim().length > 0,
    'PHOTO_LIBRARY_PURPOSE_MISSING');
  if (gates.photoLibraryPurpose === 'PASS') check('photoLibraryPurpose',
    /product/i.test(libraryPurpose) && /shelf/i.test(libraryPurpose) && /message/i.test(libraryPurpose),
    'PHOTO_LIBRARY_PURPOSE_INCOMPLETE');
  if (gates.publicSupabaseConfig === 'BLOCKED') blockers.push('PUBLIC_SUPABASE_CONFIG_INVALID');
  return {
    status: blockers.length ? 'BLOCKED' : 'READY_TO_VERIFY',
    exitCode: 2,
    scope: 'SOURCE_CONFIG_ONLY', profile: 'production', blockers, gates,
    limitations: [
      'EAS environment values require explicit candidate evidence; no remote environment was read.',
      'No archive, aggregate privacy report, required-reason API validation, or signed binary was inspected.',
      'No App Store Connect, hosted runtime, physical device, live URL, or reviewer evidence was inspected.',
    ],
  };
}

function readJson(name) { return JSON.parse(readFileSync(join(ROOT, name), 'utf8')); }
function readSource(name) { return readFileSync(join(ROOT, name), 'utf8'); }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2 && !(process.argv.length === 3 && process.argv[2] === '--public-config-env')) {
    console.error('Usage: node scripts/preflight-app-store-release.mjs [--public-config-env]');
    process.exitCode = 1;
  } else {
    try {
      const app = readJson('app.json');
      const report = inspectAppStoreSource({
        app, eas: readJson('eas.json'), pkg: readJson('package.json'),
        source: { shell: readSource('src/utils/shellPresentation.ts') },
        iconExists: typeof app.expo?.icon === 'string' && existsSync(join(ROOT, app.expo.icon)),
        ...(process.argv[2] === '--public-config-env' ? { publicConfig: {
          url: process.env.EXPO_PUBLIC_SUPABASE_URL,
          publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        } } : {}),
      });
      console.log(JSON.stringify(report, null, 2));
      process.exitCode = report.exitCode;
    } catch {
      console.error('App Store source preflight could not read its fixed source inputs.');
      process.exitCode = 1;
    }
  }
}
