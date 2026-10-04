import test from 'node:test';
import assert from 'node:assert/strict';
const moduleUrl=new URL('../supabase/functions/_shared/part-one-pinned-transport.ts',import.meta.url);
async function transport(){try{return (await import(moduleUrl.href)).createOpenBeautyFactsTransport();}catch(e){if((e as {code?:string}).code==='ERR_MODULE_NOT_FOUND')return null;throw e;}}
test('ordinary OBF transport rejects rebinding and unapproved destinations before opening a socket',async()=>{
 const t=await transport();assert.ok(t);
 const options={method:'GET' as const,headers:{Accept:'application/json','User-Agent':'Synthetic'},redirect:'manual' as const,signal:new AbortController().signal,resolvedAddresses:['93.184.216.34']};
 for(const url of ['http://world.openbeautyfacts.org/cgi/search.pl','https://world.openbeautyfacts.org.evil.test/','https://user:secret@world.openbeautyfacts.org/','https://world.openbeautyfacts.org:444/','https://world.openbeautyfacts.org/#fragment'])await assert.rejects(t.fetch(url,options));
 for(const resolvedAddresses of [[],['127.0.0.1'],['::1'],['93.184.216.34','10.0.0.1']])await assert.rejects(t.fetch('https://world.openbeautyfacts.org/cgi/search.pl',{...options,resolvedAddresses}));
 await assert.rejects(t.resolve('metadata.internal',options.signal));
});
