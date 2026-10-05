/** Server SDK transport only. A deadline covers headers AND body consumption.
 * Bounded response bytes stay in memory and are never logged. */
export function createPartOneBoundedFetch(transport:typeof fetch=fetch,deadlineMs=20000,maximumBytes=4*1024*1024):typeof fetch {
 return async(input,init)=>{
  const controller=new AbortController(),source=init?.signal??(input instanceof Request?input.signal:undefined);
  if(source?.aborted)throw new Error('part_one_server_transport_deadline');
  const abort=()=>controller.abort();
  source?.addEventListener('abort',abort,{once:true});
  const timeout=setTimeout(abort,deadlineMs);
  let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
  const aborted=new Promise<never>((_,reject)=>{const fail=()=>reject(new Error('part_one_server_transport_deadline'));
    if(controller.signal.aborted)fail();else controller.signal.addEventListener('abort',fail,{once:true});});
  try{
   if(controller.signal.aborted)throw new Error('part_one_server_transport_deadline');
   const response=await Promise.race([transport(input,{...init,signal:controller.signal}),aborted]);
   if(!response.body)return response;
   reader=response.body.getReader();const chunks:Uint8Array[]=[];let total=0;
   while(true){const {done,value}=await Promise.race([reader.read(),aborted]);if(done)break;
    total+=value.byteLength;if(total>maximumBytes)throw new Error('part_one_server_response_too_large');chunks.push(value);}
   const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
   return new Response(bytes,{status:response.status,statusText:response.statusText,headers:response.headers});
  }catch(error){controller.abort();void reader?.cancel().catch(()=>{});throw error;}
  finally{clearTimeout(timeout);source?.removeEventListener('abort',abort);reader?.releaseLock();}
 };
}
