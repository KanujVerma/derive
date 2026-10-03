import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, control, press } from './ux-profile-render.ts';

const mounted = (impactAsync: () => Promise<void>, onPress: () => void) => componentHarness(
  'src/components/ui/Button.tsx', 'Button', { label: 'Save product', onPress },
  { modules: { 'expo-haptics': { impactAsync, ImpactFeedbackStyle: { Light: 'Light' } } } });

test('actual Button invokes the product action immediately while native feedback never settles', async () => {
  let actions = 0, feedback = 0, complete!: () => void;
  const h = mounted(() => { feedback++; return new Promise(resolve => { complete = resolve; }); }, () => { actions++; });
  press(control(h.render(), 'Save product'));
  assert.equal(actions, 1, 'product action cannot wait for optional native feedback');
  assert.equal(feedback, 1);
  complete(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(actions, 1, 'late feedback completion cannot repeat the action');
});

test('actual Button keeps the action immediate when native feedback rejects or throws', async () => {
  for (const synchronous of [false, true]) {
    let actions = 0;
    const h = mounted(() => {
      if (synchronous) throw Error('Synthetic unavailable native module');
      return Promise.reject(Error('Synthetic feedback rejection'));
    }, () => { actions++; });
    press(control(h.render({ label: 'Scan ingredients' }), 'Scan ingredients'));
    assert.equal(actions, 1);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(actions, 1, 'feedback failure does not rerun or suppress the product action');
  }
});

test('actual Button blocks both feedback and actions while disabled or loading', () => {
  let actions = 0, feedback = 0;
  const h = mounted(async () => { feedback++; }, () => { actions++; });
  for (const props of [{ disabled: true, loading: false }, { disabled: false, loading: true }]) {
    const button = control(h.render(props), 'Save product');
    assert.equal(button.props.disabled, true);
    assert.equal(button.props.accessibilityState.disabled, true);
    press(button);
  }
  assert.equal(actions, 0); assert.equal(feedback, 0);
});
