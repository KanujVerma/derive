import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
export function sourceMetadata() {
 const git = args => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
 return { sha: git(['rev-parse', 'HEAD']), dirty: Boolean(git(['status', '--porcelain'])), branch: git(['branch', '--show-current']) };
}
export function buildMetadata() {
 const app = JSON.parse(readFileSync(new URL('../../../app.json', import.meta.url), 'utf8')).expo;
 const eas = JSON.parse(readFileSync(new URL('../../../eas.json', import.meta.url), 'utf8'));
 return { configuredVersion: app.version, bundleIdentifier: app.ios.bundleIdentifier, buildNumberSource: eas.cli.appVersionSource, profiles: Object.entries(eas.build).map(([name, value]) => ({ name, distribution: value.distribution, flavor: value.env?.EXPO_PUBLIC_BUILD_FLAVOR, remote: value.env?.EXPO_PUBLIC_USE_REMOTE_SERVICE })), limitation: 'Configuration is not an installed binary or embedded backend identity.' };
}
