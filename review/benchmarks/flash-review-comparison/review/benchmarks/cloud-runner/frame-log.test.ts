import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,readFileSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createFrameWriter} from './frame-log.ts';
test('full large frame is durable before clipped display',()=>{const root=mkdtempSync(join(tmpdir(),'frame-test-'));let seen='';let writer:ReturnType<typeof createFrameWriter>;writer=createFrameWriter(root,line=>{assert.equal(readFileSync(join(writer.path,'000001.json'),'utf8'),line);seen=line.slice(-1000);});const value={session:'fixture',id:3,result:'x'.repeat(100000)};writer.write(value);assert.equal(seen.length,1000);assert.deepEqual(JSON.parse(readFileSync(join(writer.path,'000001.json'),'utf8')),value);assert.equal(statSync(writer.path).mode&0o777,0o700);assert.equal(statSync(join(writer.path,'000001.json')).mode&0o777,0o600);});
test('separate writers never overwrite and ordered frames remain distinct',()=>{const root=mkdtempSync(join(tmpdir(),'frame-test-'));const a=createFrameWriter(root,()=>{}),b=createFrameWriter(root,()=>{});assert.notEqual(a.path,b.path);a.write({id:1});a.write({id:2});assert.equal(readdirSync(a.path).length,2);});
test('oversized or unserializable frame does not emit',()=>{const root=mkdtempSync(join(tmpdir(),'frame-test-'));let count=0;const w=createFrameWriter(root,()=>count++);assert.throws(()=>w.write({body:'x'.repeat(2*1024*1024)}));assert.throws(()=>w.write({bad:1n}));assert.equal(count,0);assert.equal(readdirSync(w.path).length,0);});
