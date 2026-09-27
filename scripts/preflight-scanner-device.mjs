import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Deliberately no backend calls, builds, launches, installs, permission changes or writes.
const PROBES = {
  head: ['git', ['rev-parse', 'HEAD']],
  clean: ['git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', 'status', '--porcelain']],
  xcode: ['xcodebuild', ['-version']],
  simulators: ['xcrun', ['simctl', 'list', 'devices', 'available', '--json']],
  devices: ['xcrun', ['devicectl', 'list', 'devices']],
  signing: ['security', ['find-identity', '-v', '-p', 'codesigning']],
};

function commandProbe(command, args, cwd) {
  return new Promise((complete) => {
    execFile(command, args, { cwd, encoding: 'utf8', timeout: 10_000, maxBuffer: 2 * 1024 * 1024 }, (error, stdout) => {
      // Native errors can contain paths and device identifiers. Never return them.
      complete({ ok: !error, stdout: error ? '' : stdout });
    });
  });
}

async function probe(runCommand, command, args) {
  try {
    const result = await runCommand(command, [...args]);
    return result?.ok === true && typeof result.stdout === 'string' ? result.stdout : null;
  } catch { return null; }
}

function safeModel(value) {
  if (typeof value !== 'string') return null;
  const model = value.replace(/\s+\((?:iPhone|iPad)\d{1,2},\d{1,2}\)$/, '').trim();
  // Only standard model words/numbers; never echo a custom device name or identifier.
  return /^(?:iPhone|iPad)(?: (?:\d{1,2}e?|\d{1,2}-inch|Pro|Max|Plus|mini|Air|SE|\(M[1-9]\)|\(A\d{1,2} Pro\)|\([1-9](?:st|nd|rd|th) generation\)))*$/.test(model) ? model : null;
}

function simulatorModel(identifier) {
  const prefix = 'com.apple.CoreSimulator.SimDeviceType.';
  if (typeof identifier !== 'string' || !identifier.startsWith(prefix)) return null;
  const parts = identifier.slice(prefix.length).split('-');
  const allowed = /^(?:iPhone|iPad|Pro|Max|Plus|mini|Air|SE|inch|generation|\d{1,2}e?|M[1-9]|A\d{1,2}|[1-9](?:st|nd|rd|th))$/;
  return parts.length > 0 && ['iPhone', 'iPad'].includes(parts[0]) && parts.every((part) => allowed.test(part))
    ? parts.join(' ') : null;
}

function simulatorSummary(stdout) {
  const unknown = { status: 'unknown', availableCount: null, bootedCount: null, models: [] };
  if (stdout === null) return unknown;
  try {
    const parsed = JSON.parse(stdout);
    if (!parsed.devices || typeof parsed.devices !== 'object' || Array.isArray(parsed.devices)) return unknown;
    const runtimes = Object.entries(parsed.devices).filter(([runtime]) => /^com\.apple\.CoreSimulator\.SimRuntime\.iOS-[\d-]+$/.test(runtime));
    if (!runtimes.length) return unknown;
    const entries = [];
    for (const [, devices] of runtimes) {
      if (!Array.isArray(devices) || devices.some((device) => !device || typeof device.isAvailable !== 'boolean')) return unknown;
      entries.push(...devices.filter((device) => device.isAvailable));
    }
    const models = new Map();
    let statesKnown = true;
    for (const device of entries) {
      const model = simulatorModel(device.deviceTypeIdentifier);
      const current = models.get(model) ?? { model, availableCount: 0, bootedCount: 0 };
      current.availableCount++;
      if (device.state === 'Booted' && current.bootedCount !== null) current.bootedCount++;
      else if (device.state !== 'Shutdown') { statesKnown = false; current.bootedCount = null; }
      models.set(model, current);
    }
    return { status: statesKnown ? 'observed' : 'partial', availableCount: entries.length,
      bootedCount: statesKnown ? entries.filter((device) => device.state === 'Booted').length : null,
      models: [...models.values()] };
  } catch { return unknown; }
}

function deviceSummary(stdout) {
  const unknown = { status: 'unknown', listedCount: null, availableCount: null, models: [] };
  if (stdout === null) return unknown;
  const lines = stdout.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => /\bIdentifier\s+State\s+Model\b/.test(line));
  if (headerIndex < 0) return unknown;
  const header = lines[headerIndex];
  const identifierColumn = header.indexOf('Identifier');
  const stateColumn = header.indexOf('State', identifierColumn);
  const modelColumn = header.indexOf('Model', stateColumn);
  const models = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim() || /^[-\s]+$/.test(line)) continue;
    if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(line.slice(identifierColumn, stateColumn).trim())) return unknown;
    const state = line.slice(stateColumn, modelColumn).trim();
    const availability = ['available', 'connected', 'unavailable', 'disconnected'].includes(state) ? state : 'unknown';
    models.push({ model: safeModel(line.slice(modelColumn)), availability });
  }
  const availabilityKnown = models.every((device) => device.availability !== 'unknown');
  return { status: availabilityKnown ? 'observed' : 'partial', listedCount: models.length,
    availableCount: availabilityKnown ? models.filter((device) => ['available', 'connected'].includes(device.availability)).length : null,
    models };
}

async function jsonFile(readText, filename) {
  try {
    const value = JSON.parse(await readText(filename));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}

function processShape(environment) {
  const flavor = environment.EXPO_PUBLIC_BUILD_FLAVOR?.trim() ?? '';
  const remote = environment.EXPO_PUBLIC_USE_REMOTE_SERVICE?.trim().toLowerCase() ?? '';
  const url = environment.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
  let backendUrlAbsolute = null;
  if (url) {
    try { const parsed = new URL(url); backendUrlAbsolute = ['http:', 'https:'].includes(parsed.protocol) && !parsed.username && !parsed.password; }
    catch { backendUrlAbsolute = false; }
  }
  return { source: 'process_only_not_installed_binary',
    buildFlavorRecognized: ['', 'development', 'remote-staging', 'production'].includes(flavor),
    remoteFlagRecognized: ['', 'true', 'false'].includes(remote),
    backendUrlPresent: Boolean(url), backendUrlAbsolute,
    publicClientKeyPresent: Boolean(environment.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || environment.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim()) };
}

/** Injectable probes are for tests; the CLI executes only the fixed read-only commands above. */
export async function preflightScannerDevice(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const runCommand = options.runCommand ?? ((command, args) => commandProbe(command, args, cwd));
  const readText = options.readText ?? ((filename) => readFile(resolve(cwd, filename), 'utf8'));
  const environment = options.environment ?? process.env;
  const names = Object.keys(PROBES);
  const outputs = await Promise.all(names.map((name) => probe(runCommand, ...PROBES[name])));
  const stdout = Object.fromEntries(names.map((name, index) => [name, outputs[index]]));
  const [pkg, app, eas, customModule] = await Promise.all([
    jsonFile(readText, 'package.json'), jsonFile(readText, 'app.json'), jsonFile(readText, 'eas.json'),
    jsonFile(readText, 'modules/derive-face-capture/expo-module.config.json'),
  ]);
  const head = stdout.head?.trim();
  const xcodeVersion = stdout.xcode?.match(/^Xcode (\d+(?:\.\d+){1,2})$/m)?.[1] ?? null;
  const signingCountText = stdout.signing?.match(/\b(\d+) valid identities found\b/)?.[1];
  const signingCount = signingCountText === undefined ? null : Number(signingCountText);
  const signingCountKnown = Number.isSafeInteger(signingCount) && signingCount >= 0;
  return {
    schemaVersion: 1,
    source: { head: /^[a-f\d]{40}$/i.test(head ?? '') ? head.toLowerCase() : null,
      worktreeClean: stdout.clean === null ? null : stdout.clean.trim() === '' },
    toolchain: { xcodeStatus: xcodeVersion ? 'observed' : 'unknown', xcodeVersion,
      signingStatus: signingCountKnown ? 'observed' : 'unknown',
      signingIdentityCount: signingCountKnown ? signingCount : null },
    simulators: simulatorSummary(stdout.simulators), physicalDevices: deviceSummary(stdout.devices),
    buildConfiguration: {
      expoDependencyDeclared: pkg ? typeof pkg.dependencies?.expo === 'string' : null,
      developmentClientDependencyDeclared: pkg ? typeof pkg.dependencies?.['expo-dev-client'] === 'string' : null,
      iosBundleIdentifierDeclared: app ? typeof app.expo?.ios?.bundleIdentifier === 'string' && !!app.expo.ios.bundleIdentifier.trim() : null,
      cameraUsageDescriptionDeclared: app ? typeof app.expo?.ios?.infoPlist?.NSCameraUsageDescription === 'string' && !!app.expo.ios.infoPlist.NSCameraUsageDescription.trim() : null,
      developmentClientProfileDeclared: eas ? eas.build?.development?.developmentClient === true : null,
      customNativeModuleManifestObserved: customModule ? true : null,
      processEnvironment: processShape(environment),
    },
    runtime: { expoGoCompatibility: 'UNKNOWN', backendConnectivity: 'NOT_PROBED', installedBinaryIdentity: 'NOT_PROBED',
      physicalAcceptance: 'PHYSICAL_UNVERIFIED' },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.stdout.write(`${JSON.stringify(await preflightScannerDevice(), null, 2)}\n`); }
  catch {
    // Preserve the privacy boundary even for an unexpected top-level failure.
    process.stdout.write(`${JSON.stringify({ schemaVersion: 1, status: 'unknown', physicalAcceptance: 'PHYSICAL_UNVERIFIED' })}\n`);
    process.exitCode = 1;
  }
}
