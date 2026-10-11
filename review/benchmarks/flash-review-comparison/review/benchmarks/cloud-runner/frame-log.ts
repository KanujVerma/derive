import {mkdtempSync,chmodSync,openSync,writeFileSync,fsyncSync,closeSync} from 'node:fs';
import {join} from 'node:path';
/** Persist complete credential-free ledger frames before any display can clip them.
 * A write failure aborts emission. Files preserve evidence, never authorize replay. */
function syncDirectory(path:string){const fd=openSync(path,'r');try{fsyncSync(fd);}finally{closeSync(fd);}}
export function createFrameWriter(directory:string,emit:(line:string)=>void){
 const path=mkdtempSync(join(directory,'.benchmark-frames-'));chmodSync(path,0o700);syncDirectory(path);syncDirectory(directory);
 let sequence=0;
 return {path,write(value:unknown){
  const line=JSON.stringify(value)+'\n';
  if(Buffer.byteLength(line)>2*1024*1024)throw Error('frame_evidence_too_large');
  const file=join(path,String(++sequence).padStart(6,'0')+'.json');
  const fd=openSync(file,'wx',0o600);
  try{writeFileSync(fd,line);fsyncSync(fd);}finally{closeSync(fd);}
  syncDirectory(path);
  emit(line);
 }};
}
