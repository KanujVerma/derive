import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { authenticate,corsHeaders,errorResponse,jsonResponse,readJsonObject,ServiceError } from '../_shared/runtime.ts';
import { parseDecisionRequest,evaluateDecisionRequest,DecisionServiceError } from './handler.ts';
import { decisionDependencies,localFixtureAllowed } from './runtime.ts';
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return jsonResponse({code:'METHOD_NOT_ALLOWED',error:'POST required'},405);
 try{const {admin,userId}=await authenticate(req);const request=parseDecisionRequest(await readJsonObject(req));const deps=decisionDependencies(admin,{localFixture:localFixtureAllowed(Deno.env.get('P0B_LOCAL_FIXTURES'),Deno.env.get('SUPABASE_URL')??'')});return jsonResponse(await evaluateDecisionRequest(userId,request,deps));}
 catch(error){if(error instanceof DecisionServiceError)return errorResponse(new ServiceError(error.code,error.code==='TRUTH_SNAPSHOT_UNAVAILABLE'?'Personal decision needs a trusted product snapshot.':error.status===409?'Your context changed. Reload before reassessing.':'Personal decision is unavailable.',error.status));return errorResponse(error);}
});
