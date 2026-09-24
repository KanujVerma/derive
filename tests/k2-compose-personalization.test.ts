import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createPersonalizationDraft } from '../src/presentation/personalization/draft.ts';
import { createPersonalizationGateway } from '../src/presentation/personalization/gateway.ts';
import { describePersonalFitRefresh } from '../src/presentation/personalization/result.ts';
import { resolveLocalAccessRoute } from '../src/utils/localAccessRouting.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('K2 gateway fails closed by default and never invents fit or persistence', async () => {
  const gateway = createPersonalizationGateway();
  assert.equal((await gateway.loadProfile()).kind, 'unavailable');
  assert.equal((await gateway.saveProfile(createPersonalizationDraft())).kind, 'unavailable');
  assert.equal((await gateway.getFit('product-1')).kind, 'unavailable');
});

test('K2 explicit session demo retains answers only for its gateway instance and never invents fit', async () => {
  const gateway = createPersonalizationGateway('session_demo');
  const profile = { ...createPersonalizationDraft(), goals: ['breakouts'] as const };
  assert.deepEqual(await gateway.saveProfile({ ...profile, goals: [...profile.goals] }), { kind: 'ready', scope: 'client_session' });
  assert.deepEqual(await gateway.loadProfile(), { kind: 'ready', scope: 'client_session', profile: { ...profile, goals: [...profile.goals] } });
  assert.equal((await gateway.getFit('product-1')).kind, 'unavailable');
  assert.equal((await createPersonalizationGateway('session_demo').loadProfile()).kind, 'unavailable');
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
  assert.match(check, /integrated \? <>[\s\S]*<PersonalFitSection[\s\S]*: <GroupedSection header=\"Personal Fit\">/);
  assert.match(check, /if \(!targetShell && audience !== 'member'\)/);
  assert.match(check, /evaluateProduct/); // Legacy member path remains available only outside target shell.
  const owned = [read('../app/personalize/index.tsx'), read('../app/(tabs)/my-stuff.tsx'), read('../src/presentation/personalization/gateway.ts')].join('\n');
  assert.doesNotMatch(owned, /deriveClient|scan-evaluator|skin_profiles|AsyncStorage|supabase|ai-workflows/);
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
