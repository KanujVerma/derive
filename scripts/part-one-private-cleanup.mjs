#!/usr/bin/env node
/** Supervised task-local byte cleanup consumer. No hosted installation or policy
 * activation is performed. A fresh heartbeat proves a real consumer is running. */
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createPartOneBoundedFetch } from '../supabase/functions/_shared/part-one-bounded-fetch.ts';
import { consumePrivateCleanupOnce } from '../supabase/functions/_shared/part-one-private-storage.ts';
import { createPrivateStoragePorts, privateService } from '../supabase/functions/_shared/part-one-private-supabase.ts';
export async function cleanupOnce(client) {
 const service=privateService(client);
 await service('cleanup/heartbeat',{consumerVersion:'part-one-private-byte-cleanup-1'});
 return consumePrivateCleanupOnce({service,storage:createPrivateStoragePorts(client)});
}
async function main(){
 const url=new URL(process.env.SUPABASE_URL??'');
 if(url.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('Explicit isolated loopback Supabase URL required');
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw new Error('Existing local service role is required');
 const client=createClient(url.toString(),key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:createPartOneBoundedFetch()}});
 let stop=false;process.on('SIGINT',()=>{stop=true;});process.on('SIGTERM',()=>{stop=true;});
 do{const result=await cleanupOnce(client);if(!result.claimed&&process.argv.includes('--once'))return;
  if(process.argv.includes('--once'))return;
  if(!result.claimed)await new Promise(resolve=>setTimeout(resolve,10000));
 }while(!stop);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Private local cleanup failed; no credentials, locators, or payload logged');process.exitCode=1;});
