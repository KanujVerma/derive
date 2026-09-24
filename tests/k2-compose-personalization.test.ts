import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createPersonalizationDraft } from '../src/presentation/personalization/draft.ts';
import { createPersonalizationGateway, resolvePersonalizationOwnerId, canOpenPersonalizationRoute } from '../src/presentation/personalization/gateway.ts';
import { describePersonalFitRefresh } from '../src/presentation/personalization/result.ts';
import { resolveLocalAccessRoute } from '../src/utils/localAccessRouting.ts';
import { resolveShellPresentation } from '../src/utils/shellPresentation.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('K2 gateway fails closed by default and never invents fit or persistence', async () => {
  const gateway = createPersonalizationGateway();
  assert.equal((await gateway.loadProfile('guest-A')).kind, 'unavailable');
  assert.equal((await gateway.saveProfile('guest-A', createPersonalizationDraft())).kind, 'unavailable');
  assert.equal((await gateway.getFit('guest-A', 'product-1')).kind, 'unavailable');
});

test('K2 explicit session demo retains answers only for its gateway instance and never invents fit', async () => {
  const gateway = createPersonalizationGateway('session_demo');
  const profile = { ...createPersonalizationDraft(), goals: ['breakouts'] as const };
  assert.deepEqual(await gateway.saveProfile('guest-A', { ...profile, goals: [...profile.goals] }), { kind: 'ready', scope: 'client_session' });
  assert.deepEqual(await gateway.loadProfile('guest-A'), { kind: 'ready', scope: 'client_session', profile: { ...profile, goals: [...profile.goals] } });
  assert.equal((await gateway.getFit('guest-A', 'product-1')).kind, 'unavailable');
  assert.equal((await createPersonalizationGateway('session_demo').loadProfile('guest-A')).kind, 'unavailable');
});

test('K2 Check puts factual result before separate Personal Fit and keeps Formula Details', () => {
  const check = read('../src/components/check/CheckProductScreen.tsx');
  const result = check.slice(check.indexOf('if (catalogDetail) {'), check.indexOf('if (resolution && !catalogDetail)'));
  assert.ok(result.indexOf('previewProductHeading') < result.indexOf('<PersonalFitSection'));
  assert.ok(result.indexOf('header="Formula Details"') < result.indexOf('<PersonalFitSection'));
  assert.match(result, /onPersonalize=\{.*openPersonalization/);
  assert.match(result, /Verified ingredients for this exact package/);
});

test('K2 optional editor returns to the mounted result and My Stuff reuses it', () => {
  const screen = read('../app/personalize/index.tsx');
  const check = read('../src/components/check/CheckProductScreen.tsx');
  const stuff = read('../app/(tabs)/my-stuff.tsx');
  assert.match(screen, /PersonalizationFlow/);
  assert.match(screen, /onSkip=\{\(\) => router\.back\(\)\}/);
  assert.match(screen, /onComplete=.*saveProfile/s);
  assert.match(screen, /router\.back\(\)/);
  assert.match(check, /router\.push\('\/personalize'\)/);
  assert.match(stuff, /onEditProfile=.*personalize/);
  assert.doesNotMatch(screen + stuff, /evaluateProduct|scan-product|skin_profiles|onboardingStore|membership/);
});

test('K2 retains Mock preview and Remote Staging legacy branches', () => {
  const check = read('../src/components/check/CheckProductScreen.tsx');
  assert.match(check, /const preview = shell === 'scanner_first_preview'/);
  assert.match(check, /const integrated = shell === 'local_free_integration'/);
  assert.match(check, /targetShell \? \([\s\S]*<PersonalFitSection/);
  assert.doesNotMatch(check.slice(check.indexOf('if (catalogDetail) {'), check.indexOf('if (resolution && !catalogDetail)')), /Not available yet/);
  assert.match(check, /if \(!targetShell && audience !== 'member'\)/);
  assert.match(check, /evaluateProduct/); // Legacy member path remains available only outside target shell.
  const owned = [read('../app/personalize/index.tsx'), read('../app/(tabs)/my-stuff.tsx'), read('../src/presentation/personalization/gateway.ts')].join('\n');
  assert.doesNotMatch(owned, /deriveClient|scan-evaluator|skin_profiles|AsyncStorage|services\/supabase|ai-workflows/);
});

test('K2 editor route is reachable from free and managed local shells', () => {
  const free = { userId: 'user-1', managedAccess: false } as Parameters<typeof resolveLocalAccessRoute>[1];
  const managed = { userId: 'user-1', managedAccess: true } as Parameters<typeof resolveLocalAccessRoute>[1];
  assert.equal(resolveLocalAccessRoute(['personalize', 'index'], free), null);
  assert.equal(resolveLocalAccessRoute(['personalize', 'index'], managed), null);
  assert.match(read('../app/_layout.tsx'), /Stack.Screen name=\"personalize\/index\"/);
});

test('K2 Personal Fit copy is concise and states an unavailable save once', () => {
  const factual = describePersonalFitRefresh({ kind: 'factual_only' });
  assert.equal(factual.title, 'Not personalized yet');
  assert.ok(factual.message.length < 80);
  assert.doesNotMatch(factual.message, /45 seconds|below/i);
  const unsaved = describePersonalFitRefresh({ kind: 'unavailable', reason: 'answers_not_saved' });
  assert.match(unsaved.message, /answers were not saved/i);
  assert.equal((unsaved.message.match(/answers were not saved/gi) ?? []).length, 1);
  assert.doesNotMatch(unsaved.message, /below/i);
  const ready = describePersonalFitRefresh({ kind: 'unavailable', reason: 'client_session_ready' });
  assert.match(ready.message, /this session/i);
  assert.doesNotMatch(ready.message, /fit.*great|fits you|below/i);
});

test('K2 Check renders one Personal Fit section with a minimal action', () => {
  const check = read('../src/components/check/CheckProductScreen.tsx');
  const section = read('../src/components/personalization/PersonalFitSection.tsx');
  const integratedResult = check.slice(check.indexOf('if (catalogDetail) {'), check.indexOf('if (resolution && !catalogDetail)'));
  assert.equal((integratedResult.match(/<PersonalFitSection/g) ?? []).length, 1);
  assert.doesNotMatch(integratedResult, /<Text[^>]*>Not personalized yet/);
  assert.doesNotMatch(integratedResult, /Personalization unavailable\. Your answers were not saved/);
  assert.match(section, /label=\"Personalize\"/);
  assert.doesNotMatch(section, /label=\"Personalize Derive\"/);
});

test('K2 gateway clears transient status and demo answers when Auth UUID changes A to B', async () => {
  const real = createPersonalizationGateway();
  await real.saveProfile('guest-A', createPersonalizationDraft());
  assert.equal(real.lastSaveStatus('guest-A')?.kind, 'unavailable');
  assert.equal(real.lastSaveStatus(null), null);
  assert.equal(real.lastSaveStatus('guest-B'), null);
  assert.equal(real.lastSaveStatus('guest-A'), null);

  const demo = createPersonalizationGateway('session_demo');
  await demo.saveProfile('guest-A', { ...createPersonalizationDraft(), goals: ['breakouts'] });
  assert.equal((await demo.loadProfile('guest-A')).kind, 'ready');
  assert.equal((await demo.loadProfile('guest-B')).kind, 'unavailable');
  assert.equal(demo.lastSaveStatus('guest-B'), null);
  assert.equal((await demo.loadProfile('guest-A')).kind, 'unavailable');
  const check = read('../src/components/check/CheckProductScreen.tsx');
  const editor = read('../app/personalize/index.tsx');
  assert.match(check, /lastSaveStatus\(ownerId\)/);
  assert.match(check, /\[ownerId, catalogDetail\?\.productId\]/);
  assert.match(editor, /key=\{ownerId \?\? 'signed-out'\}/);
  assert.match(editor, /saveProfile\(ownerId, answers\)/);
});

test('K2 Mock My Stuff opens the same local editor without an Auth UUID', () => {
  assert.equal(resolvePersonalizationOwnerId(null, 'scanner_first_preview'), 'mock-preview:local-session');
  assert.equal(resolvePersonalizationOwnerId(null, 'local_free_integration'), null);
  assert.equal(resolvePersonalizationOwnerId(null, 'legacy'), null);
  assert.equal(resolvePersonalizationOwnerId('guest-A', 'scanner_first_preview'), 'guest-A');
  const stuff = read('../app/(tabs)/my-stuff.tsx');
  const editor = read('../app/personalize/index.tsx');
  assert.match(stuff, /onEditProfile=.*router\.push\('\/personalize'\)/);
  assert.match(editor, /resolvePersonalizationOwnerId/);
  assert.match(editor, /PersonalizationFlow/);
  assert.doesNotMatch(editor, /mock-preview.*supabase|legacy.*mock-preview/s);
});

test('K2 personalization deep links deny legacy Remote Staging and production shells', () => {
  const staging = resolveShellPresentation({ buildFlavor: 'remote-staging', remoteEnabled: true, supabaseUrl: 'https://example.invalid' });
  const production = resolveShellPresentation({ buildFlavor: 'production', remoteEnabled: true, supabaseUrl: 'https://example.invalid' });
  const mock = resolveShellPresentation({ buildFlavor: 'development', remoteEnabled: false });
  const local = resolveShellPresentation({ buildFlavor: 'development', remoteEnabled: true, supabaseUrl: 'http://127.0.0.1:54321' });
  assert.equal(canOpenPersonalizationRoute(staging, true), false);
  assert.equal(canOpenPersonalizationRoute(production, true), false);
  assert.equal(canOpenPersonalizationRoute(mock, false), true);
  assert.equal(canOpenPersonalizationRoute(local, false), false);
  assert.equal(canOpenPersonalizationRoute(local, true), true); // Free and managed local access use the same READY projection.
  const layout = read('../app/_layout.tsx');
  assert.match(layout, /Stack.Protected guard=\{canOpenPersonalizationRoute\(shell, localReady\)\}/);
  assert.match(layout, /Stack.Protected guard=\{canOpenPersonalizationRoute[\s\S]*Stack.Screen name=\"personalize\/index\"/);
});

test('K2 My Stuff offers the shared editor only in scanner-first shells', () => {
  const stuff = read('../app/(tabs)/my-stuff.tsx');
  assert.match(stuff, /const targetShell = shell !== 'legacy'/);
  assert.match(stuff, /onEditProfile=\{targetShell \? .*router\.push\('\/personalize'\).* : undefined\}/);
});

test('K2 Mock Check exposes factual Personal Fit and returns unavailable after optional completion', async () => {
  const ownerId = resolvePersonalizationOwnerId(null, 'scanner_first_preview');
  const gateway = createPersonalizationGateway();
  assert.equal(gateway.lastSaveStatus(ownerId), null);
  await gateway.saveProfile(ownerId, createPersonalizationDraft());
  assert.equal(gateway.lastSaveStatus(ownerId)?.kind, 'unavailable');
  assert.equal((await gateway.getFit(ownerId, 'preview-product')).kind, 'unavailable');
  const check = read('../src/components/check/CheckProductScreen.tsx');
  const result = check.slice(check.indexOf('if (catalogDetail) {'), check.indexOf('if (resolution && !catalogDetail)'));
  assert.match(check, /resolvePersonalizationOwnerId\(sessionUserId, shell\)/);
  assert.match(result, /<PersonalFitSection state=\{personalFitState\} onPersonalize=\{openPersonalization\}/);
  assert.ok(result.indexOf('header=\"Formula Details\"') < result.indexOf('<PersonalFitSection'));
  assert.doesNotMatch(result, /GREAT FIT|COULD WORK|Not available yet/);
});
