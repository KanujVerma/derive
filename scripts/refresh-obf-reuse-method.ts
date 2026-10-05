/** Refresh the reviewed US-search dependencies and their advertised digests. */
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {canonicalJson,sha256} from '../src/domain/part-two/hash.ts';
const root=new URL('../',import.meta.url),target=new URL('supabase/functions/_shared/obf-reuse-method.ts',root);
const source=fs.readFileSync(target,'utf8'),start=source.indexOf('= ')+2,end=source.lastIndexOf(' as const');
const asset=JSON.parse(source.slice(start,end));
for(const name of ['src/domain/part-one/evidence.ts','supabase/functions/_shared/part-one-search.ts']){
 const entry=asset.methods.find((file:{path:string})=>file.path===name);
 if(!entry)throw Error(`Offered dependency missing: ${name}`);
 entry.content=fs.readFileSync(new URL(name,root),'utf8');entry.sha256=sha256(entry.content);
}
const {contentHash,...body}=asset;asset.contentHash=sha256(canonicalJson(body));
// Encoded keywords keep embedded source data outside Supabase's module graph.
const data=JSON.stringify(asset).replace(/import/g,'\\u0069mport').replace(/export/g,'\\u0065xport');
fs.writeFileSync(target,source.slice(0,start)+data+' as const;\n');
console.log(JSON.stringify({path:fileURLToPath(target),contentHash:asset.contentHash}));
