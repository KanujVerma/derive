import assert from 'node:assert/strict';
import test from 'node:test';
import { componentHarness, control, press } from './ux-profile-render.ts';

test('A24 late pre-delete read cannot reopen a tombstoned saved record', async () => {
  let focus!: () => () => void; let finishRead!: (record: unknown) => void; let deleted = false;
  const record = { saveId: 'saved', snapshotAtSaveId: 'snapshot', createdAt: '2026-10-02T00:00:00Z',
    result: { resultRevision: 1, declarationState: 'none', display: { selectedIdentity: { name: 'Synthetic Lotion' } } } };
  const h = componentHarness('src/components/my-stuff/PartOneSavedProducts.tsx', 'PartOneSavedProducts', { ownerId: 'owner' }, { modules: {
    'expo-router': { useFocusEffect: (callback: () => () => void) => { focus = callback; } },
    '../ui/Button': { Button: 'Button' },
    '../../stores/authStore': { useAuthStore: { getState: () => ({ sessionUserId: 'owner' }) } },
    '../../services/partOne': { listPartOneSaves: async () => deleted ? [] : [record],
      readPartOneSave: () => new Promise(resolve => { finishRead = resolve; }), deletePartOneSave: async () => { deleted = true; } },
  } });
  h.render(); const cleanup = focus();
  try {
    await new Promise(resolve => setImmediate(resolve));
    const nodes = h.render(); press(control(nodes, 'Open Synthetic Lotion')); press(control(nodes, 'Remove Synthetic Lotion'));
    await new Promise(resolve => setImmediate(resolve)); finishRead(record);
    await new Promise(resolve => setImmediate(resolve));
    const final = h.render(); assert(!final.some(node => node.type === 'PartOneResultSheet'));
    assert(!final.some(node => node.props.label === 'Open Synthetic Lotion'));
  } finally { cleanup(); }
});
