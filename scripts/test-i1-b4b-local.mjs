// scripts/test-i1-b4b-local.mjs
// DERIVE I1-B4B Local E2E: authenticated submit-checkin, context persistence,
// fail-closed validation, and RLS-backed Remote progress reads.

import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function mapDbCheckIn(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    primaryGoal: row.primary_goal || undefined,
    skinState: row.skin_state,
    irritation: row.irritation,
    adherence: row.adherence || undefined,
    notes: row.notes || undefined,
    contextTags: row.context_tags || [],
    contextNote: row.context_note || undefined,
    aiAnalysisSentence: row.ai_analysis_sentence || undefined,
    adjustmentProposed: row.irritation !== 'none',
    createdAt: row.created_at,
  };
}

async function remoteGetProgress(userClient, userId) {
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();
  assert.ok(!authError && user, 'Remote getProgress requires an authenticated session');
  assert.equal(user.id, userId, 'Remote getProgress uses authenticated identity');

  const { data, error } = await userClient
    .from('check_ins')
    .select(
      'id, user_id, skin_state, irritation, notes, context_tags, context_note, adherence, primary_goal, ai_analysis_sentence, created_at'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  assert.ok(!error, `Remote getProgress failed: ${error?.message}`);

  const { data: publishedRoutine } = await userClient
    .from('routines')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'published')
    .limit(1)
    .maybeSingle();

  return {
    checkIns: (data || []).map(mapDbCheckIn),
    learnedInsights: [],
    recentPhotos: [],
    routineHistorySummary: publishedRoutine
      ? 'A published managed routine is in place.'
      : 'No published routine yet.',
    isCheckInDue: true,
  };
}

async function countCheckIns(userId) {
  const { data, error } = await adminClient
    .from('check_ins')
    .select('id')
    .eq('user_id', userId);
  assert.ok(!error, `count failed: ${error?.message}`);
  return data.length;
}

async function run() {
  console.log('=== DERIVE I1-B4B Local Full-Stack E2E Test Harness ===\n');

  console.log('1. Testing submit-checkin gateway JWT gate...');
  {
    const resNoAuth = await fetch(`${SUPABASE_URL}/functions/v1/submit-checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skinState: 'same', irritation: 'none' }),
    });
    assert.equal(resNoAuth.status, 401, 'submit-checkin without auth must return 401');

    const resBadAuth = await fetch(`${SUPABASE_URL}/functions/v1/submit-checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid.token.value',
      },
      body: JSON.stringify({ skinState: 'same', irritation: 'none' }),
    });
    assert.equal(resBadAuth.status, 401, 'submit-checkin with invalid token must return 401');
    console.log('   ✓ submit-checkin gateway rejects unauthenticated requests (401)');
  }

  console.log('2. Creating synthetic test users...');
  const runId = Date.now();
  const testPassword = 'TestPassword123!';
  const user1Email = `member_b4b_e2e_${runId}_1@example.test`;
  const user2Email = `member_b4b_e2e_${runId}_2@example.test`;

  const { data: u1Create, error: u1Err } = await adminClient.auth.admin.createUser({
    email: user1Email,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Member B4B Synthetic One' },
  });
  assert.ok(!u1Err && u1Create?.user, `Failed creating user 1: ${u1Err?.message}`);
  const user1 = u1Create.user;

  const { data: u2Create, error: u2Err } = await adminClient.auth.admin.createUser({
    email: user2Email,
    password: testPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Member B4B Synthetic Two' },
  });
  assert.ok(!u2Err && u2Create?.user, `Failed creating user 2: ${u2Err?.message}`);
  const user2 = u2Create.user;

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: uSign, error: uSignErr } = await userClient.auth.signInWithPassword({
    email: user1Email,
    password: testPassword,
  });
  assert.ok(!uSignErr && uSign.session, `User 1 sign in failed: ${uSignErr?.message}`);
  const userJwt = uSign.session.access_token;
  console.log(`   ✓ Authenticated owner ${user1.id} and peer ${user2.id}`);

  console.log('3. Submitting authenticated check-in with multiple tags and a context note...');
  const submitBody = {
    userId: user1.id,
    primaryGoal: 'breakouts',
    skinState: 'same',
    irritation: 'none',
    adherence: 'mostly',
    contextTags: ['sleep', 'stress', 'travel_weather'],
    contextNote: 'Slept less during a work trip. Useful context only.',
  };
  const submitRes = await fetch(`${SUPABASE_URL}/functions/v1/submit-checkin`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userJwt}`,
    },
    body: JSON.stringify(submitBody),
  });
  assert.equal(submitRes.status, 200, `submit-checkin should succeed, got ${submitRes.status}`);
  const submitJson = await submitRes.json();
  assert.ok(submitJson.checkIn?.id, 'canonical CheckIn must round-trip from persistence');
  assert.deepEqual(submitJson.checkIn.contextTags, ['sleep', 'stress', 'travel_weather']);
  assert.equal(submitJson.checkIn.contextNote, submitBody.contextNote);
  assert.equal(submitJson.checkIn.adherence, 'mostly');
  assert.equal(submitJson.checkIn.primaryGoal, 'breakouts');
  assert.equal(submitJson.checkIn.userId, user1.id);
  assert.match(submitJson.aiAnalysisSentence, /Check-in recorded/);
  assert.doesNotMatch(submitJson.aiAnalysisSentence, /caused|stop medication|ovulation|fertility/i);
  console.log('   ✓ submit-checkin persisted canonical context without causal claims');

  console.log('4. Verifying DB persistence, ownership, and server-authored analysis...');
  const { data: dbRow, error: dbErr } = await adminClient
    .from('check_ins')
    .select('*')
    .eq('id', submitJson.checkIn.id)
    .single();
  assert.ok(!dbErr && dbRow, `persisted row missing: ${dbErr?.message}`);
  assert.equal(dbRow.user_id, user1.id);
  assert.deepEqual(dbRow.context_tags, ['sleep', 'stress', 'travel_weather']);
  assert.equal(dbRow.context_note, submitBody.contextNote);
  assert.equal(dbRow.ai_analysis_sentence, submitJson.aiAnalysisSentence);
  assert.notEqual(dbRow.ai_analysis_sentence, submitBody.contextNote);
  const afterSubmitCount = await countCheckIns(user1.id);
  assert.equal(afterSubmitCount, 1);
  console.log('   ✓ DB row is owner-scoped and analysis is server-authored');

  console.log('5. Invalid tag must fail closed without inserting a row...');
  {
    const invalidRes = await fetch(`${SUPABASE_URL}/functions/v1/submit-checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userJwt}`,
      },
      body: JSON.stringify({
        skinState: 'same',
        irritation: 'none',
        contextTags: ['sleep', 'hormonal_imbalance'],
      }),
    });
    assert.equal(invalidRes.status, 400, 'unknown tag must return 400');
    const invalidBody = await invalidRes.json();
    assert.equal(invalidBody.code, 'INVALID_PAYLOAD');
    assert.equal(await countCheckIns(user1.id), afterSubmitCount, 'failed validation must not insert');
    console.log('   ✓ unknown tag rejected with no extra row');
  }

  console.log('6. Spoofed userId must fail closed...');
  {
    const spoofRes = await fetch(`${SUPABASE_URL}/functions/v1/submit-checkin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userJwt}`,
      },
      body: JSON.stringify({
        userId: user2.id,
        skinState: 'same',
        irritation: 'none',
        contextTags: ['diet'],
      }),
    });
    assert.equal(spoofRes.status, 403, 'spoofed userId must return 403');
    const spoofBody = await spoofRes.json();
    assert.equal(spoofBody.code, 'UNAUTHORIZED');
    assert.equal(await countCheckIns(user1.id), afterSubmitCount);
    assert.equal(await countCheckIns(user2.id), 0);
    console.log('   ✓ spoofed userId rejected; no rows for either user');
  }

  console.log('7. Remote getProgress RLS read round-trips tags/note...');
  {
    const progress = await remoteGetProgress(userClient, user1.id);
    assert.equal(progress.learnedInsights.length, 0, 'Remote must not invent learned insights');
    assert.equal(progress.recentPhotos.length, 0, 'Remote must not leak unsigned private photos');
    assert.equal(progress.checkIns.length, 1);
    assert.deepEqual(progress.checkIns[0].contextTags, ['sleep', 'stress', 'travel_weather']);
    assert.equal(progress.checkIns[0].contextNote, submitBody.contextNote);
    assert.equal(progress.checkIns[0].adherence, 'mostly');
    console.log('   ✓ Remote progress reads persisted context without get-progress');
  }

  console.log('8. Legacy row without tags maps to []...');
  {
    const { data: legacyRow, error: legacyErr } = await adminClient
      .from('check_ins')
      .insert({
        user_id: user1.id,
        skin_state: 'better',
        irritation: 'none',
        notes: 'historical note only',
      })
      .select('id, context_tags, context_note, notes')
      .single();
    assert.ok(!legacyErr && legacyRow, `legacy insert failed: ${legacyErr?.message}`);
    assert.deepEqual(legacyRow.context_tags, []);
    assert.equal(legacyRow.context_note, null);

    const progress = await remoteGetProgress(userClient, user1.id);
    const mappedLegacy = progress.checkIns.find((row) => row.id === legacyRow.id);
    assert.ok(mappedLegacy);
    assert.deepEqual(mappedLegacy.contextTags, []);
    assert.equal(mappedLegacy.contextNote, undefined);
    assert.equal(mappedLegacy.notes, 'historical note only');
    console.log('   ✓ legacy check-in maps missing tags to [] and preserves notes');
  }

  console.log('\n=== ALL DERIVE I1-B4B LOCAL E2E VERIFICATION CHECKS PASSED ===\n');
}

run().catch((err) => {
  console.error('\n❌ B4B E2E TEST FAILED:', err);
  process.exit(1);
});
