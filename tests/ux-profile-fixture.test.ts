import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, control, press, textContent } from './ux-profile-render.ts';

function fixture(params: Record<string, string>, developmentRuntime = true, buildFlavor = 'development', shell = 'free') {
  let exits = 0;
  const harness = componentHarness('app/personalize/fixture.tsx', 'default', {}, {
    developmentRuntime,
    modules: {
      'expo-router': { useRouter: () => ({ back() { exits++; } }), useLocalSearchParams: () => params },
      '@/src/config/environment': { publicEnvironment: { buildFlavor, supabaseUrl: '' } },
      '@/src/services/DeriveService': { isRemoteServiceEnabled: () => false },
      '@/src/utils/shellPresentation': { resolveShellPresentation: () => shell },
      '@/src/services/productCatalog': { createCatalogRequestId: () => '00000000-0000-4000-8000-000000000001' },
    },
  });
  return { harness, exits: () => exits };
}

test('focused fresh phone preview opens unanswered setup and returns without persisting answers', () => {
  const preview = fixture({ mode: 'profile', fresh: '1', focused: '1' });
  let nodes = preview.harness.render();
  assert.ok(textContent(nodes).includes('Preview · answers are not saved'));
  assert.ok(!nodes.some(node => node.props.label === 'decision'));
  assert.ok(!nodes.some(node => node.props.label === 'What are you deciding?'));
  assert.equal(control(nodes, 'Redness & sensitivity').props.selected, false);
  assert.ok(nodes.some(node => node.props.label === 'Continue'));
  press(control(nodes, 'Dryness'));
  press(control(preview.harness.render(), 'Continue'));
  nodes = preview.harness.render();
  press(control(nodes, 'Done'));
  assert.equal(preview.exits(), 1);
  assert.ok(!textContent(preview.harness.render()).includes('applied locally'));
});

test('focused skip and Back return to the originating page', () => {
  const skip = fixture({ mode: 'profile', fresh: '1', focused: '1' });
  press(control(skip.harness.render(), 'Skip personalization'));
  assert.equal(skip.exits(), 1);
  const back = fixture({ mode: 'profile', fresh: '1', focused: '1' });
  press(control(back.harness.render(), 'Back'));
  assert.equal(back.exits(), 1);
});

test('nonfresh fixture still previews editing existing sample answers with truthful Done label', () => {
  const preview = fixture({ mode: 'profile' });
  const nodes = preview.harness.render();
  assert.equal(control(nodes, 'Redness & sensitivity').props.selected, true);
  assert.ok(nodes.some(node => node.props.label === 'Done'));
});

test('fixture stays unavailable outside development and in legacy shell', () => {
  for (const preview of [fixture({ mode: 'profile' }, false), fixture({ mode: 'profile' }, true, 'production'), fixture({ mode: 'profile' }, true, 'development', 'legacy')]) {
    const nodes = preview.harness.render();
    assert.ok(textContent(nodes).includes('Fixture preview unavailable.'));
    assert.ok(!nodes.some(node => node.props.label === 'Continue'));
  }
});
