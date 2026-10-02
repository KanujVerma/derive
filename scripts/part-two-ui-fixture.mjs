import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const path=process.env.PART_TWO_UI_BOOTSTRAP;
if(!path)throw Error('Explicit synthetic fixture bootstrap required');
const fixture=JSON.parse(readFileSync(path,'utf8'));
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(fixture.apiOrigin!=='http://127.0.0.1:59421'||!fixture.observationId||!serviceKey)throw Error('Isolated local fixture binding required');
const client=createClient(fixture.apiOrigin,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const display={ownerId:fixture.ownerId,token:fixture.token,apiKey:fixture.apiKey,apiOrigin:fixture.apiOrigin,result:fixture.result,captureSessionId:fixture.captureSessionId??null};
const server=createServer(async(request,response)=>{
 response.setHeader('content-type','application/json');response.setHeader('cache-control','no-store');
 try {
  if(request.method==='GET'&&request.url==='/bootstrap'){response.end(JSON.stringify(display));return;}
  if(request.method==='POST'&&request.url==='/withdraw'){
   const {error}=await client.rpc('part_one_worker',{p_action:'revoke',p_payload:{recordId:fixture.observationId,status:'retracted',reason:'Synthetic Part 2 simulator withdrawal'}});
   if(error)throw Error('Fixture withdrawal failed');response.end('{"withdrawn":true}');return;
  }
  response.statusCode=404;response.end('{"code":"not_found"}');
 }catch{response.statusCode=503;response.end('{"code":"fixture_unavailable"}');}
});
server.listen(8138,'127.0.0.1',()=>console.log('Synthetic Part 2 fixture UI ready on loopback port 8138'));
process.on('SIGINT',()=>server.close());process.on('SIGTERM',()=>server.close());
