import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { tierLadderFixtures } from '../src/fixtures/tier-ladder/tierLadderFixtures.ts';
import { buildTierLadderView } from '../src/presentation/tier-ladder/tierLadder.ts';

const component = readFileSync(new URL('../src/components/tier-ladder/TierLadderPresentation.tsx', import.meta.url), 'utf8');

test('tier ladder explains Free, Plus, and Managed without reducing Free Check quality', () => {
  const view = buildTierLadderView(tierLadderFixtures.preview);
  assert.deepEqual(view.tiers.map(({ id }) => id), ['derive', 'plus', 'managed']);
  assert.match(view.tiers[0].summary, /personalized product intelligence/i);
  assert.match(view.tiers[0].detail, /supported facts and guidance/i);
  assert.equal(view.tiers[0].status, 'Free');
  assert.equal(view.tiers[1].status, 'In development');
  assert.match(view.tiers[1].detail, /compare products/i);
  assert.equal(view.tiers[2].status, 'Coming later');
  assert.match(view.tiers[2].detail, /routine.*over time/i);
  assert.equal(view.managedInterestAction, null);
});

test('Managed interest is offered only with an enabled, host-owned intent path', () => {
  const preview = buildTierLadderView(tierLadderFixtures.preview);
  const open = buildTierLadderView(tierLadderFixtures.managedInterestOpen);
  assert.equal(preview.managedInterestAction, null);
  assert.equal(preview.tiers[2].status, 'Coming later');
  assert.equal(open.tiers[2].status, 'Early Access');
  assert.deepEqual(open.managedInterestAction, {
    event: 'managed_interest', properties: { source: 'plan' }, label: "I'm interested",
  });
});

test('the tier preview cannot claim pricing, active access, checkout, or a saved waitlist entry', () => {
  const files = [
    readFileSync(new URL('../src/presentation/tier-ladder/tierLadder.ts', import.meta.url), 'utf8'),
    component,
    readFileSync(new URL('../src/fixtures/tier-ladder/tierLadderFixtures.ts', import.meta.url), 'utf8'),
  ].join('\n');
  assert.doesNotMatch(files, /\$\d|first\s+250|60\s+days|unlimited|checkout|stripe|storekit|supabase|activateMembership|createSubscription/i);
  assert.doesNotMatch(files, /you're on|joined the waitlist|membership active|billing active/i);
  assert.match(component, /action && onManagedInterest/);
  assert.match(component, /minHeight: layout\.minTouchTarget/);
});
