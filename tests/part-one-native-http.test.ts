import test from 'node:test';
import assert from 'node:assert/strict';
import {nativePinnedHttpGet,readBoundedHttp11Response,type NativeConnection,type NativeTLSConnection,type NativeTransportRuntime} from '../supabase/functions/_shared/part-one-native-http.ts';
const encoder=new TextEncoder();
function reader(raw:string|Uint8Array,fragment=8192){const bytes=typeof raw==='string'?encoder.encode(raw):raw;let offset=0;return async(buffer:Uint8Array)=>{if(offset===bytes.length)return null;const n=Math.min(fragment,buffer.length,bytes.length-offset);buffer.set(bytes.subarray(offset,offset+n));offset+=n;return n;};}
const json='{"text":"moisturizer · 水"}',jsonBytes=encoder.encode(json);
for(const fragment of [1,2,7,8192])for(const framing of ['length','chunked','close'])test(`native HTTP decodes ${framing} with fragment size ${fragment}`,async()=>{
 const head='HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n';
 const raw=framing==='length'?`${head}Content-Length: ${jsonBytes.length}\r\n\r\n${json}`:framing==='chunked'?`${head}Transfer-Encoding: chunked\r\n\r\n${jsonBytes.length.toString(16)}\r\n${json}\r\n0\r\nX-Fixture: complete\r\n\r\n`:`${head}Connection: close\r\n\r\n${json}`;
 const response=await readBoundedHttp11Response(reader(raw,fragment));assert.equal(response.status,200);assert.equal(await response.text(),json);assert.equal(response.headers.get('transfer-encoding'),null);
});
const invalid:Record<string,string>={
 'duplicate conflicting lengths':'Content-Length: 2\r\nContent-Length: 3\r\n\r\n{}',
 'duplicate identical lengths':'Content-Length: 2\r\nContent-Length: 2\r\n\r\n{}',
 'comma joined lengths':'Content-Length: 2, 2\r\n\r\n{}',
 'negative length':'Content-Length: -1\r\n\r\n',
 'noncanonical length':'Content-Length: +2\r\n\r\n{}',
 'oversized declared body':'Content-Length: 262145\r\n\r\n',
 'unsafe integer length':'Content-Length: 999999999999999999999\r\n\r\n',
 'length plus transfer coding':'Content-Length: 2\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n',
 'duplicate transfer coding':'Transfer-Encoding: chunked\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\n',
 'unsupported transfer coding':'Transfer-Encoding: gzip, chunked\r\n\r\n0\r\n\r\n',
 'unsupported compression':'Content-Encoding: gzip\r\nContent-Length: 2\r\n\r\n{}',
 'duplicate encoding':'Content-Encoding: identity\r\nContent-Encoding: identity\r\n\r\n',
 'folded header':'X-Fixture: x\r\n continuation\r\n\r\n',
 'invalid header name':'Bad Name: x\r\n\r\n',
 'header control':'X-Fixture: \u0000\r\n\r\n',
 'header limit':Array.from({length:20},(_,i)=>`X-${i}: ${'x'.repeat(1000)}\r\n`).join('')+'\r\n',
 'header count':Array.from({length:101},(_,i)=>`X-${i}: x\r\n`).join('')+'\r\n',
 'header line limit':`X: ${'x'.repeat(8192)}\r\n\r\n`,
 'truncated fixed body':'Content-Length: 3\r\n\r\n{}',
 'oversized close body':'\r\n'+'x'.repeat(262145),
 'invalid chunk size':'Transfer-Encoding: chunked\r\n\r\ng\r\nx\r\n0\r\n\r\n',
 'unsupported chunk extension':'Transfer-Encoding: chunked\r\n\r\n1;x=y\r\nx\r\n0\r\n\r\n',
 'oversized chunk':'Transfer-Encoding: chunked\r\n\r\n40001\r\n',
 'truncated chunk':'Transfer-Encoding: chunked\r\n\r\n5\r\nabc',
 'bad chunk delimiter':'Transfer-Encoding: chunked\r\n\r\n1\r\nx\n0\r\n\r\n',
 'missing final trailer terminator':'Transfer-Encoding: chunked\r\n\r\n0\r\n',
 'forged trailer framing':'Transfer-Encoding: chunked\r\n\r\n0\r\nContent-Length: 2\r\n\r\n',
 'forged trailer redirect':'Transfer-Encoding: chunked\r\n\r\n0\r\nLocation: https://private.invalid/\r\n\r\n',
 'trailer limit':'Transfer-Encoding: chunked\r\n\r\n0\r\n'+Array.from({length:30},(_,i)=>`X-${i}: ${'x'.repeat(300)}\r\n`).join('')+'\r\n',
 'trailer count':'Transfer-Encoding: chunked\r\n\r\n0\r\n'+Array.from({length:33},(_,i)=>`X-${i}: x\r\n`).join('')+'\r\n',
 'chunk count':'Transfer-Encoding: chunked\r\n\r\n'+'1\r\nx\r\n'.repeat(1025)+'0\r\n\r\n',
};
for(const [name,tail] of Object.entries(invalid))test(`native HTTP rejects ${name}`,async()=>{await assert.rejects(readBoundedHttp11Response(reader('HTTP/1.1 200 OK\r\n'+tail)),/native_http_/);});
test('malformed framing remains rejected across read boundaries',async()=>{
 for(const fragment of [1,3,8192])for(const name of ['length plus transfer coding','header control','truncated fixed body','invalid chunk size','bad chunk delimiter','forged trailer framing'])await assert.rejects(readBoundedHttp11Response(reader('HTTP/1.1 200 OK\r\n'+invalid[name],fragment)),/native_http_/);
});
for(const raw of ['HTTP/1.0 200 OK\r\n\r\n','HTTP/1.1 100 Continue\r\n\r\n','HTTP/1.1 101 Switching Protocols\r\n\r\n','HTTP/1.1 200 OK\n\n','HTTP/1.1 204 No Content\r\nContent-Length: 1\r\n\r\nx'])test(`native HTTP rejects unsupported status/framing ${JSON.stringify(raw.slice(0,22))}`,async()=>{await assert.rejects(readBoundedHttp11Response(reader(raw)),/native_http_/);});
test('complete response boundaries discard trailing bytes consistently, without a second response',async()=>{
 for(const fragment of [1,3,8192])for(const raw of ['HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\n{}','HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n2\r\n{}\r\n0\r\n\r\n','HTTP/1.1 204 No Content\r\n\r\n']){
  const response=await readBoundedHttp11Response(reader(raw+'HTTP/1.1 200 Evil\r\nContent-Length: 4\r\n\r\nevil',fragment));assert.equal(await response.text(),response.status===204?'':'{}');
 }
});
test('native HTTP accepts an exact maximum body, redirects without following, and empty no-body statuses',async()=>{
 const body='x'.repeat(262144),r=await readBoundedHttp11Response(reader(`HTTP/1.1 200 OK\r\nContent-Length: 262144\r\n\r\n${body}`));assert.equal((await r.arrayBuffer()).byteLength,262144);
 const redirect=await readBoundedHttp11Response(reader('HTTP/1.1 302 Found\r\nLocation: https://private.invalid/\r\nContent-Length: 0\r\n\r\n'));assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),'https://private.invalid/');
 for(const status of [204,205,304])assert.equal((await readBoundedHttp11Response(reader(`HTTP/1.1 ${status} Empty\r\n\r\n`))).body,null);
});
test('native HTTP bounds invalid and nonprogressing reads',async()=>{for(const value of [-1,8193,1.5,0])await assert.rejects(readBoundedHttp11Response(async()=>value),/native_http_/);});

function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}
function fixture(address='93.184.216.34'){
 const state={tcpClosed:0,tlsClosed:0,dials:[] as unknown[],starts:[] as unknown[],writes:[] as Uint8Array[]};
 const tcp:NativeConnection={remoteAddr:{hostname:address,port:443},close(){state.tcpClosed++;},read:async()=>null,write:async b=>b.length};
 const tls:NativeTLSConnection={...tcp,close(){state.tlsClosed++;},handshake:async()=>({alpnProtocol:'http/1.1'}),read:reader('HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\n{}',3),write:async b=>{const n=Math.min(b.length,7);state.writes.push(b.slice(0,n));return n;}};
 const runtime:NativeTransportRuntime={connect:async o=>{state.dials.push(o);return tcp;},startTls:async(c,o)=>{assert.equal(c,tcp);state.starts.push(o);return tls;}};
 return {state,tcp,tls,runtime};
}
const url=new URL('https://world.openbeautyfacts.org/example?x=1');
test('native transport pins IP/443, validates original TLS identity, handles partial writes, closes successful TLS',async()=>{
 const f=fixture(),r=await nativePinnedHttpGet(f.runtime,url,'93.184.216.34','Synthetic',new AbortController().signal);assert.equal(await r.text(),'{}');assert.deepEqual(f.state.dials,[{hostname:'93.184.216.34',port:443}]);assert.deepEqual(f.state.starts,[{hostname:'world.openbeautyfacts.org',alpnProtocols:['http/1.1']}]);
 const sent=Buffer.concat(f.state.writes);assert.match(sent.toString(),/^GET \/example\?x=1 HTTP\/1\.1\r\nHost: world.openbeautyfacts.org\r\n/);assert.match(sent.toString(),/Accept-Encoding: identity\r\nConnection: close\r\n\r\n$/);assert.equal(f.state.tlsClosed,1);
});
test('native transport normalizes IPv6 before strict remote-address comparison',async()=>{const f=fixture('2606:4700:0000:0000:0000:0000:0000:1111');assert.equal((await nativePinnedHttpGet(f.runtime,url,'2606:4700::1111','Synthetic',new AbortController().signal)).status,200);});
for(const change of ['address','port','TLS address','TLS port','handshake','ALPN','write progress','parser'])test(`native transport closes on ${change} failure`,async()=>{
 const f=fixture();if(change==='address')f.tcp.remoteAddr={hostname:'127.0.0.1',port:443};if(change==='port')f.tcp.remoteAddr={hostname:'93.184.216.34',port:80};if(change==='TLS address')f.tls.remoteAddr={hostname:'127.0.0.1',port:443};if(change==='ALPN')f.tls.handshake=async()=>({alpnProtocol:'h2'});if(change==='write progress')f.tls.write=async()=>0;if(change==='parser')f.tls.read=reader('HTTP/1.1 200 OK\r\nContent-Length: 3\r\n\r\n{}');
 if(change==='TLS port')f.tls.remoteAddr={hostname:'93.184.216.34',port:80};if(change==='handshake')f.tls.handshake=async()=>{throw Error('native_fixture_tls_rejected');};
 await assert.rejects(nativePinnedHttpGet(f.runtime,url,'93.184.216.34','Synthetic',new AbortController().signal),/native_/);assert.equal(f.state.tcpClosed+f.state.tlsClosed,1);if(change==='address'||change==='port')assert.equal(f.state.starts.length,0);
});
test('native transport supports TLS without negotiated ALPN using HTTP/1.1',async()=>{const f=fixture();f.tls.handshake=async()=>({alpnProtocol:null});assert.equal((await nativePinnedHttpGet(f.runtime,url,'93.184.216.34','Synthetic',new AbortController().signal)).status,200);assert.equal(f.state.tlsClosed,1);});
test('native transport closes TCP connections completing after abort and never starts TLS',async()=>{
 const f=fixture(),pending=deferred<NativeConnection>(),controller=new AbortController();f.runtime.connect=()=>pending.promise;
 const result=nativePinnedHttpGet(f.runtime,url,'93.184.216.34','Synthetic',controller.signal);controller.abort();await assert.rejects(result,/aborted/);pending.resolve(f.tcp);await new Promise(r=>setImmediate(r));assert.equal(f.state.tcpClosed,1);assert.equal(f.state.starts.length,0);
});
test('native transport closes TLS connections completing after abort',async()=>{
 const f=fixture(),pending=deferred<NativeTLSConnection>(),entered=deferred<void>(),controller=new AbortController();f.runtime.startTls=()=>{entered.resolve();return pending.promise;};
 const result=nativePinnedHttpGet(f.runtime,url,'93.184.216.34','Synthetic',controller.signal);await entered.promise;controller.abort();await assert.rejects(result,/aborted/);pending.resolve(f.tls);await new Promise(r=>setImmediate(r));assert.equal(f.state.tlsClosed,1);assert.equal(f.state.writes.length,0);
});
for(const stage of ['handshake','write','read'])test(`native transport abort closes during ${stage}`,async()=>{
 const f=fixture(),entered=deferred<void>(),controller=new AbortController();const hang=()=>{entered.resolve();return new Promise<never>(()=>{});};if(stage==='handshake')f.tls.handshake=hang;if(stage==='write')f.tls.write=hang;if(stage==='read')f.tls.read=hang;
 const result=nativePinnedHttpGet(f.runtime,url,'93.184.216.34','Synthetic',controller.signal);await entered.promise;controller.abort();await assert.rejects(result,/aborted/);assert.equal(f.state.tlsClosed,1);
});
test('native transport uses one inherited deadline across phases',async()=>{
 const f=fixture(),originalConnect=f.runtime.connect,originalStart=f.runtime.startTls,originalRead=f.tls.read;const delay=()=>new Promise(r=>setTimeout(r,40));
 f.runtime.connect=async o=>{await delay();return originalConnect(o);};f.runtime.startTls=async(c,o)=>{await delay();return originalStart(c,o);};f.tls.read=async b=>{await delay();return originalRead(b);};
 await assert.rejects(nativePinnedHttpGet(f.runtime,url,'93.184.216.34','Synthetic',AbortSignal.timeout(100)),/aborted/);assert.equal(f.state.tlsClosed,1);
});
