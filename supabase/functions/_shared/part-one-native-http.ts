import {isIP} from 'node:net';

export interface NativeConnection {
 remoteAddr:{hostname:string;port:number};close():void;
 read(buffer:Uint8Array):Promise<number|null>;write(buffer:Uint8Array):Promise<number>;
}
export interface NativeTLSConnection extends NativeConnection {handshake():Promise<{alpnProtocol:string|null}>}
export interface NativeTransportRuntime {
 version?:{deno?:string};
 connect(options:{hostname:string;port:number}):Promise<NativeConnection>;
 startTls(connection:NativeConnection,options:{hostname:string;alpnProtocols:string[]}):Promise<NativeTLSConnection>;
}
const BODY_LIMIT=262144,HEADER_LIMIT=16384,TRAILER_LIMIT=8192,CHUNK_METADATA_LIMIT=16384;
const WIRE_LIMIT=BODY_LIMIT+HEADER_LIMIT+TRAILER_LIMIT+CHUNK_METADATA_LIMIT+8192;
const TOKEN=/^[!#$%&'*+.^_`|~0-9a-z-]+$/i;
function fail(code:string):never{throw Error(code);}
function canonicalIP(value:string):string {
 const family=isIP(value);if(family===4)return value;
 if(family===6)return new URL(`http://[${value}]/`).hostname;
 return fail('native_transport_invalid_ip');
}
/** One bounded response; no interim responses, upgrades, compression or chunk
 * extensions. After a complete fixed/chunked/no-body frame, discard any trailing
 * bytes by closing the socket. Never parse a second response or reuse a socket.
 * This policy is identical across read fragmentation and does not wait for EOF
 * after a complete frame; connection-close bodies must reach bounded EOF. */
class ResponseReader {
 private buffer=new Uint8Array(0);private position=0;private wireBytes=0;private ended=false;
 private readonly read:(buffer:Uint8Array)=>Promise<number|null>;
 constructor(read:(buffer:Uint8Array)=>Promise<number|null>){this.read=read;}
 get remaining(){return this.buffer.length-this.position;}
 private async fill():Promise<boolean>{
  if(this.remaining)return true;if(this.ended)return false;
  const buffer=new Uint8Array(8192);
  for(let empty=0;empty<16;empty++){
   const n=await this.read(buffer);if(n===null){this.ended=true;return false;}
   if(!Number.isInteger(n)||n<0||n>buffer.length)fail('native_http_invalid_read');if(n===0)continue;
   this.wireBytes+=n;if(this.wireBytes>WIRE_LIMIT)fail('native_http_wire_limit');
   this.buffer=buffer.subarray(0,n);this.position=0;return true;
  }
  return fail('native_http_no_read_progress');
 }
 async byte():Promise<number|null>{return await this.fill()?this.buffer[this.position++]:null;}
 async line(limit:number):Promise<string>{
  const bytes:number[]=[];
  while(true){
   const value=await this.byte();if(value===null)fail('native_http_premature_eof');
   if(value===13){if(await this.byte()!==10)fail('native_http_bad_line_ending');return String.fromCharCode(...bytes);}
   if(value===10||value!==9&&(value<32||value>126))fail('native_http_invalid_line');
   bytes.push(value);if(bytes.length>limit)fail('native_http_line_limit');
  }
 }
 async bytes(length:number):Promise<Uint8Array>{
  const result=new Uint8Array(length);let offset=0;
  while(offset<length){if(!await this.fill())fail('native_http_premature_eof');const n=Math.min(length-offset,this.remaining);result.set(this.buffer.subarray(this.position,this.position+n),offset);this.position+=n;offset+=n;}
  return result;
 }
 async toEnd():Promise<Uint8Array>{
  const parts:Uint8Array[]=[];let length=0;
  while(await this.fill()){length+=this.remaining;if(length>BODY_LIMIT)fail('native_http_body_limit');parts.push(this.buffer.slice(this.position));this.position=this.buffer.length;}
  return join(parts,length);
 }
}
function join(parts:readonly Uint8Array[],length:number):Uint8Array{
 const result=new Uint8Array(length);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}return result;
}
function field(line:string):[string,string]{
 const colon=line.indexOf(':');if(colon<1||!TOKEN.test(line.slice(0,colon)))return fail('native_http_invalid_header');
 return [line.slice(0,colon).toLowerCase(),line.slice(colon+1).replace(/^[\t ]+|[\t ]+$/g,'')];
}
export async function readBoundedHttp11Response(read:(buffer:Uint8Array)=>Promise<number|null>):Promise<Response>{
 const reader=new ResponseReader(read),statusLine=await reader.line(8192);
 const statusMatch=/^HTTP\/1\.1 ([2-5]\d\d)(?: [\x20-\x7e]*)?$/.exec(statusLine);
 if(!statusMatch)fail('native_http_unsupported_status');const status=Number(statusMatch![1]);
 const headers=new Headers();let headerBytes=statusLine.length+2,headerCount=0;
 while(true){
  const line=await reader.line(8192);headerBytes+=line.length+2;if(headerBytes>HEADER_LIMIT)fail('native_http_header_limit');if(!line)break;
  if(++headerCount>100)fail('native_http_header_limit');const [name,value]=field(line);
  if(['content-length','transfer-encoding','content-encoding'].includes(name)&&headers.has(name))fail('native_http_ambiguous_framing');headers.append(name,value);
 }
 const lengthValue=headers.get('content-length'),transfer=headers.get('transfer-encoding'),encoding=headers.get('content-encoding');
 if(encoding!==null&&encoding.toLowerCase()!=='identity')fail('native_http_unsupported_encoding');
 if(transfer!==null&&(transfer.toLowerCase()!=='chunked'||lengthValue!==null))fail('native_http_ambiguous_framing');
 let length:number|null=null;
 if(lengthValue!==null){if(!/^(0|[1-9]\d*)$/.test(lengthValue))fail('native_http_invalid_length');length=Number(lengthValue);if(!Number.isSafeInteger(length)||length>BODY_LIMIT)fail('native_http_body_limit');}
 if([204,205,304].includes(status)){
  if(transfer!==null||status!==304&&length!==null&&length!==0)fail('native_http_unexpected_body');return new Response(null,{status,headers});
 }
 let body:Uint8Array;
 if(transfer!==null){
  const parts:Uint8Array[]=[];let total=0,chunks=0,metadata=0;
  while(true){
   const line=await reader.line(128);metadata+=line.length+2;if(metadata>CHUNK_METADATA_LIMIT)fail('native_http_chunk_metadata_limit');
   if(!/^[0-9a-f]{1,8}$/i.test(line))fail('native_http_invalid_chunk');const size=Number.parseInt(line,16);
   if(!size)break;if(++chunks>1024)fail('native_http_chunk_count_limit');total+=size;if(total>BODY_LIMIT)fail('native_http_body_limit');
   parts.push(await reader.bytes(size));if(await reader.byte()!==13||await reader.byte()!==10)fail('native_http_invalid_chunk');
  }
  let trailerBytes=0,trailerCount=0;
  while(true){
   const line=await reader.line(2048);trailerBytes+=line.length+2;if(trailerBytes>TRAILER_LIMIT)fail('native_http_trailer_limit');if(!line)break;
   if(++trailerCount>32)fail('native_http_trailer_limit');const [name]=field(line);
   if(['content-length','transfer-encoding','content-encoding','content-type','host','connection','trailer','location','retry-after'].includes(name))fail('native_http_forbidden_trailer');
  }
  body=join(parts,total);
 }else body=length===null?await reader.toEnd():await reader.bytes(length);
 headers.delete('transfer-encoding');headers.delete('trailer');
 return new Response(body as BodyInit,{status,headers});
}

/** Existing all-address URL/source guards run before entry. The dial receives
 * a literal IP; startTls receives the original approved hostname and no CA override. */
export async function nativePinnedHttpGet(runtime:NativeTransportRuntime,url:URL,address:string,userAgent:string,signal:AbortSignal):Promise<Response>{
 signal.throwIfAborted();const expectedIP=canonicalIP(address);
 if(typeof runtime.connect!=='function'||typeof runtime.startTls!=='function')fail('native_transport_api_unavailable');
 if(!/^[\x20-\x7e]{1,512}$/.test(userAgent))fail('native_transport_invalid_header');
 const controller=new AbortController();let connection:NativeConnection|undefined,finished=false;
 const close=()=>{const current=connection;connection=undefined;try{current?.close();}catch{}};
 const externalAbort=()=>controller.abort();signal.addEventListener('abort',externalAbort,{once:true});const timer=setTimeout(()=>controller.abort(),10000);
 let onAbort:()=>void=()=>{};
 const cancelled=new Promise<never>((_,reject)=>{onAbort=()=>{close();reject(Error('native_transport_aborted'));};controller.signal.addEventListener('abort',onAbort,{once:true});});
 const race=<T>(operation:Promise<T>):Promise<T>=>Promise.race([operation,cancelled]);
 const own=<T extends NativeConnection>(next:T):T=>{if(finished||controller.signal.aborted){try{next.close();}catch{}return fail('native_transport_aborted');}connection=next;return next;};
 try{
  if(signal.aborted)externalAbort();controller.signal.throwIfAborted();
  const tcp=await race(runtime.connect({hostname:address,port:443}).then(own));
  const matchedAddress=canonicalIP(tcp.remoteAddr.hostname)===expectedIP,remotePortIsTLS=tcp.remoteAddr.port===443;
  if(!matchedAddress||!remotePortIsTLS)fail('native_transport_address_mismatch');
  const tls=await race(runtime.startTls(tcp,{hostname:url.hostname,alpnProtocols:['http/1.1']}).then(own));
  if(canonicalIP(tls.remoteAddr.hostname)!==expectedIP||tls.remoteAddr.port!==443)fail('native_transport_address_mismatch');
  const handshake=await race(tls.handshake());if(handshake.alpnProtocol!==null&&handshake.alpnProtocol!=='http/1.1')fail('native_transport_unsupported_protocol');
  console.info(JSON.stringify({event:'part_one_pinned_socket',transport:'native_http11',denoVersion:runtime.version?.deno??'unknown',matchedAddress,remotePortIsTLS}));
  const request=new TextEncoder().encode(`GET ${url.pathname+url.search} HTTP/1.1\r\nHost: ${url.hostname}\r\nAccept: application/json\r\nUser-Agent: ${userAgent}\r\nAccept-Encoding: identity\r\nConnection: close\r\n\r\n`);
  let offset=0;while(offset<request.length){controller.signal.throwIfAborted();const n=await race(tls.write(request.subarray(offset)));if(!Number.isInteger(n)||n<=0||n>request.length-offset)fail('native_transport_invalid_write');offset+=n;}
  return await readBoundedHttp11Response(buffer=>race(tls.read(buffer)));
 }finally{finished=true;close();clearTimeout(timer);signal.removeEventListener('abort',externalAbort);controller.signal.removeEventListener('abort',onAbort);}
}
