// DERIVE I1-B4 Local Integration Harness
// Exercises price-neutral membership identity plus owner-scoped structured check-in context.

import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
// Supabase local defaults. Environment variables override these in CI.
const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const FALLBACK_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const anonKey = process.env.SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || FALLBACK_SERVICE_KEY;

const admin = createClient(SUPABASE_URL, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createMember(email, password) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ok(!error && data.user, `Failed to create member: ${error?.message}`);

  const client = createClient(SUPABASE_URL, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signIn = await client.auth.signInWithPassword({ email, password });
  assert.ok(!signIn.error && signIn.data.session, `Failed to sign in member: ${signIn.error?.message}`);
  return { user: data.user, client };
}

async function run() {
  console.log('=== DERIVE I1-B4 Local Membership & Check-In Integration ===\n');
  const runId = Date.now();
  const password = 'TestPassword123!';
  const owner = await createMember(`i1b4_owner_${runId}@example.test`, password);
  const other = await createMember(`i1b4_other_${runId}@example.test`, password);

  console.log('1. Verifying price-neutral membership identity...');
  const membership = await admin
    .from('memberships')
    .insert({ user_id: owner.user.id })
    .select('tier')
    .single();
  assert.equal(membership.error, null, membership.error?.message);
  assert.equal(membership.data.tier, 'founding_beta');
  console.log('   ✓ New membership persists founding_beta without price coupling');

  console.log('2. Persisting optional multi-select check-in context...');
  const inserted = await owner.client
    .from('check_ins')
    .insert({
      user_id: owner.user.id,
      primary_goal: 'breakouts',
      skin_state: 'same',
      irritation: 'none',
      adherence: 'mostly',
      context_tags: ['diet', 'alcohol', 'sleep'],
      context_note: 'Ate differently, drank Friday, and barely slept.',
    })
    .select('id, context_tags, context_note')
    .single();
  assert.equal(inserted.error, null, inserted.error?.message);
  assert.deepEqual(inserted.data.context_tags, ['diet', 'alcohol', 'sleep']);
  console.log('   ✓ Structured tags and one explanation persisted');

  console.log('3. Rehydrating through a fresh authenticated client...');
  const freshOwner = createClient(SUPABASE_URL, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const freshSignIn = await freshOwner.auth.signInWithPassword({
    email: `i1b4_owner_${runId}@example.test`,
    password,
  });
  assert.equal(freshSignIn.error, null, freshSignIn.error?.message);
  const reloaded = await freshOwner
    .from('check_ins')
    .select('context_tags, context_note')
    .eq('id', inserted.data.id)
    .single();
  assert.equal(reloaded.error, null, reloaded.error?.message);
  assert.deepEqual(reloaded.data.context_tags, ['diet', 'alcohol', 'sleep']);
  assert.equal(reloaded.data.context_note, 'Ate differently, drank Friday, and barely slept.');
  console.log('   ✓ Context survives session restart and Remote-style reads');

  console.log('4. Enforcing owner isolation and canonical tags...');
  const crossRead = await other.client.from('check_ins').select('id').eq('id', inserted.data.id);
  assert.equal(crossRead.error, null, crossRead.error?.message);
  assert.deepEqual(crossRead.data, []);

  const invalid = await owner.client.from('check_ins').insert({
    user_id: owner.user.id,
    skin_state: 'same',
    irritation: 'none',
    context_tags: ['claimed_cause'],
  });
  assert.ok(invalid.error, 'Invalid context tag must fail');
  console.log('   ✓ Cross-member reads are empty and invalid tags fail closed');

  console.log('\n=== ALL DERIVE I1-B4 LOCAL INTEGRATION CHECKS PASSED ===');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
