import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness } from './ux-profile-render.ts';

for (const kind of ['ChoiceChip', 'Button'] as const) {
  test(`${kind}: a pending or unavailable haptic cannot defer the user action`, async () => {
    for (const mode of ['pending', 'rejected', 'throws'] as const) {
      let actions = 0, feedback = 0;
      const haptic = () => {
        feedback++;
        if (mode === 'throws') throw Error('Synthetic native feedback unavailable');
        if (mode === 'rejected') return Promise.reject(Error('Synthetic feedback rejected'));
        return new Promise<void>(() => {});
      };
      const props = { label: 'Face', ...(kind === 'ChoiceChip' ? { onSelect: () => actions++ } : { onPress: () => actions++ }) };
      const h = componentHarness(`src/components/ui/${kind}.tsx`, kind, props, {
        modules: { 'expo-haptics': { selectionAsync: haptic, impactAsync: haptic, ImpactFeedbackStyle: { Light: 'Light' } } },
      });
      try {
        const touch = () => h.render().find(node => node.type === 'TouchableOpacity')!;
        touch().props.onPress();
        assert.equal(actions, 1, 'The actual shared control dispatches without a native feedback acknowledgment');
        assert.equal(feedback, 1);
        const disabled = h.render({ ...props, disabled: true }).find(node => node.type === 'TouchableOpacity')!;
        disabled.props.onPress();
        assert.equal(actions, 1);
        assert.equal(feedback, 1, 'Disabled controls dispatch neither action nor feedback');
        if (kind === 'Button') {
          const busy = h.render({ ...props, loading: true }).find(node => node.type === 'TouchableOpacity')!;
          busy.props.onPress();
          assert.equal(actions, 1);
          assert.equal(feedback, 1, 'Pending saves remain protected from repeated actions');
        }
        await new Promise<void>(resolve => setImmediate(resolve));
      } finally { h.dispose(); }
    }
  });
}
