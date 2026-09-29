import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as presentation from '../src/presentation/my-stuff/myStuffPresentation.ts';
import type { PersonalContextSnapshot } from '../src/contracts/PersonalContext.ts';
const empty = { profile: null, products: [], checks: [], experiences: [] };

test('mixed saved states are described as your products in every shell', () => {
  assert.equal(presentation.myStuffCopy(false).productHeader, 'Your products');
  assert.equal(presentation.myStuffCopy(true).productHeader, 'Your products');
});

test('canonical and earlier reports remain separate even with identical names or IDs', () => {
  const canonical: presentation.CanonicalExperienceView[] = [{ id: 'same', revisionId: 'revision', productName: 'Cream', kind: 'no_reaction_reported', source: 'user_reported', formulaContext: 'manual' }];
  const view = presentation.buildMyStuffPresentation({ ...empty, experiences: [{ id: 'same', productName: 'Cream', kind: 'tolerated' }] }, canonical);
  assert.equal(view.experienceRows.length, 2);
  assert.deepEqual(view.experienceRows.map(row => row.kind), ['no_reaction_reported', 'tolerated']);
  assert.deepEqual(view.experienceRows.map(row => row.origin), ['personal_context', 'legacy_free_context']);
  assert.notEqual(view.experienceRows[0].key, view.experienceRows[1].key);
});

test('canonical report projection preserves manual unknown and all six observations', () => {
  const kinds = ['reacted', 'tolerated', 'no_reaction_reported', 'liked', 'finished', 'ineffective'] as const;
  const context: PersonalContextSnapshot = { version: 'personal-context-v1', ownerId: 'A', revision: 6, profile: null, routine: null, historyRevision: 'revision-6', historyTruncated: false, legacy: { source: 'legacy_free_context', profile: null, products: [], experiences: [], truncated: false }, experiences: kinds.map((kind, index) => ({ id: `revision-${index}`, ownerId: 'A', revision: index + 1, recordedAt: '2026-09-29T00:00:00Z', provenance: 'self_report', supersedesRevisionId: null, data: { id: `report-${index}`, reference: { kind: 'manual', name: 'My cream' }, kind, occurred: { start: null, end: null }, useContext: null, symptoms: [], note: null } })) };
  const rows = presentation.mapCanonicalExperiences(context, {});
  assert.deepEqual(rows.map(row => row.kind), ['reacted', 'tolerated', 'no_reaction_reported', 'liked', 'finished', 'ineffective']);
  assert.equal(rows[0].notedAt, undefined);
  assert.equal(rows[0].formulaContext, 'manual');
  assert.equal(rows[0].productName, 'My cream');
  context.experiences[0].ownerId = 'B';
  assert.equal(presentation.mapCanonicalExperiences(context, {}).length, 5);
});

test('reported occurrence interval is distinct from recording time', () => {
  const context: PersonalContextSnapshot = { version: 'personal-context-v1', ownerId: 'A', revision: 1, profile: null, routine: null, historyRevision: 'revision', historyTruncated: false, legacy: { source: 'legacy_free_context', profile: null, products: [], experiences: [], truncated: false }, experiences: [{ id: 'revision', ownerId: 'A', revision: 1, recordedAt: '2026-09-29T00:00:00Z', provenance: 'self_report', supersedesRevisionId: null, data: { id: 'report', reference: { kind: 'catalog', productId: 'p', variantId: null, formulaVersionId: null }, kind: 'reacted', occurred: { start: '2026-09-01', end: '2026-09-08' }, useContext: null, symptoms: ['Stinging'], note: 'Noticed after use' } }] };
  const rows = presentation.mapCanonicalExperiences(context, {});
  assert.deepEqual(rows[0].occurred, { start: '2026-09-01', end: '2026-09-08' });
  assert.equal(rows[0].formulaContext, 'unconfirmed');
  assert.equal(rows[0].note, 'Noticed after use');
});
