import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

// Disposable local stack only. Never accepts hosted URLs or prints credentials.
const env = JSON.parse(execFileSync('npx',['supabase','status','--output','json'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}));
const base = env.API_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base ?? '')) throw new Error('Local Supabase required');
const users = [];
async function request(path,body,token=env.SERVICE_ROLE_KEY,method='POST') {
  const response = await fetch(`${base}${path}`,{method,headers:{apikey:env.ANON_KEY,Authorization:`Bearer ${token}`,
    'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,data:await response.json()};
}
try {
  for (let i=0;i<2;i++) {
    const result=await request('/auth/v1/signup',{data:{},email:`facts-${randomUUID()}@example.test`,password:randomUUID()},env.ANON_KEY);
    assert.equal(result.status,200);
    users.push({id:result.data.user.id,token:result.data.access_token});
  }
  const caseId=randomUUID(),evidenceId=randomUUID();
  assert.equal((await request('/rest/v1/product_resolution_cases',{id:caseId,user_id:users[0].id,request_id:randomUUID(),
    consumer:'scan',resolution_state:'insufficient_evidence',next_action:'manual_review'})).status,201);
  assert.equal((await request('/rest/v1/product_resolution_evidence',{id:evidenceId,case_id:caseId,user_id:users[0].id,
    evidence_type:'front_label',source_type:'member_input',extracted_text:'Broad Spectrum SPF 50 Water Resistant (80 minutes)'})).status,201);
  const sealed=await request('/rest/v1/rpc/seal_product_truth_snapshot',{p_user_id:users[0].id,p_case_id:caseId});
  assert.equal(sealed.status,200);
  const payload={caseId,snapshotId:sealed.data.snapshotId};
  const first=await request('/functions/v1/product-check-facts',payload,users[0].token);
  assert.equal(first.status,200,JSON.stringify(first.data));
  const packet=first.data.facts;
  assert.equal(packet.category,'unknown');
  assert.equal(packet.facts.find(f=>f.code==='spf_statement').value,'50');
  assert.deepEqual(packet.facts.find(f=>f.code==='spf_statement').basis,
    {kind:'submitted_label',evidenceId,extraction:'member_input'});
  assert(!packet.facts.some(f=>f.certainty==='accepted'));
  assert(packet.missing.includes('ingredient_list'));
  assert(packet.missing.includes('drug_facts'));
  assert.deepEqual((await request('/functions/v1/product-check-facts',payload,users[0].token)).data.facts,packet);
  assert.equal((await request('/functions/v1/product-check-facts',payload,users[1].token)).status,404);
  assert.equal((await request('/functions/v1/product-check-facts',{...payload,snapshotId:randomUUID()},users[0].token)).status,404);
  assert.equal((await request('/functions/v1/product-check-facts',{...payload,unexpected:true},users[0].token)).status,400);
  const read=await request(`/rest/v1/product_check_fact_assessments?case_id=eq.${caseId}`,undefined,users[1].token,'GET');
  assert.deepEqual(read.data,[]);
  console.log('Product facts Edge smoke passed: bound observations, exact replay, owner isolation, missing snapshot and malformed request.');
} finally {
  for (const user of users) await request(`/auth/v1/admin/users/${user.id}`,undefined,env.SERVICE_ROLE_KEY,'DELETE');
}
