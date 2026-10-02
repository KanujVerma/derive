import React,{useMemo,useRef,useState} from 'react';
import {Text,View} from 'react-native';
import {Redirect} from 'expo-router';
import {z} from 'zod';
import {PartOneResultSheet} from '@/src/components/check/part-one/PartOneResultSheet';
import {ContextFlow} from '@/src/components/p0b-personalization/ContextFlow';
import {setupToStorageV2} from '@/src/presentation/p0b-personalization/setupStorageV2';
import type {SetupBundle} from '@/src/presentation/p0b-personalization/setup';
import type {ContextDraft} from '@/src/presentation/p0b-personalization/draft';
import {PreferenceContext} from '@/src/components/p0b-personalization/PreferenceContext';
import {Button} from '@/src/components/ui/Button';
import {PartOneIdSchema,ScanResultSchema} from '@/src/contracts/PartOne';
import {personalContextV2Schema,setupWriteResultSchema,contextDeleteResultSchema} from '@/src/contracts/PersonalContextV2Schema';
import {createPartThreeTransport} from '@/src/services/partThreeClient';
import {createPartTwoTransport} from '@/src/services/partTwoClient';
import {createCatalogRequestId} from '@/src/services/productCatalog';
import type {PartThreePorts} from '@/src/components/check/part-three/usePartThreeCheck';
const CONTROL='http://127.0.0.1:8353';
const Bootstrap=z.strictObject({ownerId:PartOneIdSchema,token:z.string(),apiKey:z.string(),apiOrigin:z.literal('http://127.0.0.1:59521'),result:ScanResultSchema,encounterId:PartOneIdSchema});
type Fixture=z.infer<typeof Bootstrap>;
/** Loopback-only synthetic Auth/Edge/SQL harness using the production sheet and
 * preference controller. Never available in release builds. */
export default function PartThreePreview(){
 const enabled=__DEV__&&process.env.EXPO_PUBLIC_PART_THREE_FIXTURE_UI==='true';
 const [fixture,setFixture]=useState<Fixture|null>(null),[visible,setVisible]=useState(true),[tick,setTick]=useState(0),[savedId,setSavedId]=useState<string|null>(null),[preference,setPreference]=useState(false),[status,setStatus]=useState('Synthetic fixture not loaded'),[offline,setOffline]=useState(false),[setupMode,setSetupMode]=useState(false),[setupSaving,setSetupSaving]=useState(false),[setupError,setSetupError]=useState<string|null>(null);
 const setupAttempt=useRef<{signature:string;request:any}|null>(null);
 const owner=useRef<string|null>(null),generation=useRef(1),online=useRef(true),encounters=useRef(new Map<string,string>());
 async function load(){if(!enabled)return;const next=Bootstrap.parse(await (await fetch(CONTROL+'/bootstrap')).json());owner.current=next.ownerId;online.current=true;generation.current++;encounters.current.clear();setFixture(next);setVisible(true);setSavedId(null);setOffline(false);setStatus('Actual local Part3 fixture loaded');}
 const invoke=useMemo(()=>async(path:string,body:string,signal?:AbortSignal)=>{if(!fixture||owner.current!==fixture.ownerId||!online.current)throw Error('Synthetic account offline or changed');const r=await fetch(`${fixture.apiOrigin}/functions/v1/${path}`,{method:'POST',headers:{apikey:fixture.apiKey,Authorization:`Bearer ${fixture.token}`,'content-type':'application/json'},body,signal});return {data:await r.json(),error:r.ok?null:Error('Synthetic local request refused')};},[fixture]);
 const personalPorts=useMemo<PartThreePorts>(()=>({transport:createPartThreeTransport({enabled:()=>enabled,invoke}),context:async expected=>{if(expected!==owner.current)throw Error('Owner changed');const r=await invoke('personal-context',JSON.stringify({operation:'read_context_v2'}));if(r.error)throw r.error;return personalContextV2Schema.parse(r.data);},session:(expected,scan)=>{if(!fixture||expected!==owner.current)return null;if(!encounters.current.has(scan))encounters.current.set(scan,scan===fixture.result.scanId?fixture.encounterId:createCatalogRequestId());return {ownerId:expected,accountGeneration:generation.current,encounterId:encounters.current.get(scan)!};},online:()=>online.current,createId:createCatalogRequestId}),[enabled,fixture,invoke]);
 const ingredients=useMemo(()=>createPartTwoTransport({enabled:()=>enabled,invoke}),[enabled,invoke]);
 const preferencePorts=useMemo(()=>({owner:()=>owner.current,read:personalPorts.context,createId:createCatalogRequestId,write:async(expected:string,request:any)=>{if(expected!==owner.current)throw Error('Owner changed');const r=await invoke('personal-context',JSON.stringify(request));if(r.error)throw r.error;return request.operation==='save_setup'?setupWriteResultSchema.parse(r.data):contextDeleteResultSchema.parse(r.data);}}),[personalPorts,invoke]);
 async function reopen(){if(!online.current){setStatus('Offline: current personal assessment unavailable');return;}const r=await personalPorts.transport.request({operation:'list_saved'});if(r.kind!=='saved_list'||!r.items.length){setStatus('No saved assessment');return;}setSavedId(r.items[0].savedAssessmentId);setVisible(true);setTick(n=>n+1);setStatus('Reopened exact saved assessment');}
 if(!enabled)return <Redirect href="/(tabs)/check"/>;
 if(preference&&fixture)return <PreferenceContext ownerId={fixture.ownerId} ports={preferencePorts} onSaved={()=>{setPreference(false);setVisible(true);setTick(n=>n+1);setStatus('Confirmed preferences committed');}} onClose={()=>setPreference(false)}/>;
 async function openSetup(){const next=Bootstrap.parse(await (await fetch(CONTROL+'/setup-bootstrap')).json());owner.current=next.ownerId;online.current=true;generation.current++;encounters.current.clear();setFixture(next);setVisible(false);setSavedId(null);setupAttempt.current=null;setSetupError(null);setSetupMode(true);}
 async function saveSetup(bundle:SetupBundle,draft:ContextDraft){if(setupSaving||!fixture||bundle.ownerId!==owner.current)return;try{const signature=JSON.stringify({bundle,draft});if(setupAttempt.current?.signature!==signature)setupAttempt.current={signature,request:{operation:'save_setup',requestId:createCatalogRequestId(),baseContextRevision:0,setup:setupToStorageV2(draft,bundle,createCatalogRequestId,new Date().toISOString())}};setSetupSaving(true);const r=await invoke('personal-context',JSON.stringify(setupAttempt.current.request));if(r.error)throw r.error;const ack=setupWriteResultSchema.parse(r.data);const read=await personalPorts.context(fixture.ownerId);if(read.revision!==ack.contextRevision)throw Error('Acknowledged context changed');setSetupMode(false);setStatus('Atomic five-step setup saved and reopened from SQL');}catch{setSetupError('Setup was not saved. Your entries remain here for retry.');}finally{setSetupSaving(false);}}
 if(setupMode&&fixture)return <ContextFlow setup durableSetup ownerId={fixture.ownerId} createId={createCatalogRequestId} catalogSearch={async()=>[]} collectIntent={false} completionLabel="Save skin setup" onSetup={(bundle,draft)=>void saveSetup(bundle,draft)} onApply={()=>{}} onSkip={()=>setSetupMode(false)} loading={setupSaving} error={setupError}/>;
 const result=fixture?.result,display=result&&(savedId||tick>0)?{...result,display:{...result.display,sections:[],sources:[]}}:result;
 return <View style={{flex:1,paddingTop:60,paddingHorizontal:20,backgroundColor:'#FAFAF7'}}><Text accessibilityRole="header">Part3 local runtime verification</Text><Text accessibilityLiveRegion="polite">{status}</Text>
 <Button label="Open five-step setup" onPress={()=>void openSetup()}/><Button label="Load Part3 local fixture" onPress={()=>void load()}/><Button label="Reopen Part3 saved assessment" onPress={()=>void reopen()}/><Button label="Open confirmed preferences" onPress={()=>{setVisible(false);setPreference(true);}}/>
 <Button label={offline?'Reconnect synthetic client':'Take synthetic client offline'} onPress={()=>{online.current=!online.current;setOffline(!online.current);setStatus(online.current?'Synthetic client connected; authority will be checked':'Synthetic client offline; current personal assessment unavailable');}}/>
 <Button label="Withdraw Part3 purpose field" onPress={()=>void fetch(CONTROL+'/withdraw-purpose',{method:'POST'}).then(()=>setStatus('Synthetic purpose field withdrawn'))}/><Button label="Switch Part3 fixture account" onPress={()=>{owner.current=null;generation.current++;setFixture(null);setSavedId(null);setStatus('Synthetic owner cleared');}}/>
 {fixture&&result&&display&&visible&&<PartOneResultSheet key={`${fixture.ownerId}:${tick}:${savedId??'scan'}`} view={{owner:fixture.ownerId,result:display,loading:false,error:null,saved:false,scrollOffset:0}} ingredientEnabled ingredientTransport={ingredients} personalEnabled personalPorts={personalPorts} savedAssessmentId={savedId} onClose={()=>setVisible(false)} onSelect={()=>{}} onSearch={()=>setVisible(false)} onRefresh={()=>setTick(n=>n+1)} onFullChange={()=>{}} onSave={()=>void invoke('part-one/saves',JSON.stringify({idempotencyKey:createCatalogRequestId(),scanId:result.scanId,expectedGeneration:result.generation,expectedResultRevision:result.resultRevision,selectedSnapshotId:result.snapshotId,selectedDeclarationId:result.declarationId})).then(r=>setStatus(r.error?'Synthetic product save refused':'Synthetic product and evidence saved independently'))}/>
 }</View>;
}
