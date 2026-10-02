import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { z } from 'zod';
import { Button } from '@/src/components/ui/Button';
import { PartOnePrivateCapturePanel } from '@/src/components/check/part-one/PartOnePrivateCapturePanel';
import { CaptureSessionSchema, PartOneIdSchema, ScanResultSchema } from '@/src/contracts/PartOne';
import { MemoryLabelDraft, type CaptureBinding } from '@/src/presentation/part-one/capture';
import { createPrivateCaptureController, type PrivateCaptureController } from '@/src/presentation/part-one/privateCaptureController';
import { createPartOnePrivateTransport } from '@/src/services/partOnePrivateClient';
import { createPrivateLabelSanitizer } from '@/src/services/partOneUpload';
import { createCatalogRequestId } from '@/src/services/productCatalog';

const LOCAL_FIXTURE_ORIGIN='http://127.0.0.1:8127';
const Bootstrap=z.strictObject({ownerId:PartOneIdSchema,token:z.string(),capture:CaptureSessionSchema,result:ScanResultSchema,
 reviewId:PartOneIdSchema.nullable(),photos:z.array(z.strictObject({evidenceId:PartOneIdSchema,base64:z.string().max(3_000_000),text:z.string().max(50_000),
 role:z.enum(['ingredients','package']),width:z.number().int().positive().max(4096),height:z.number().int().positive().max(4096),
 sanitizedAssetHash:z.string().regex(/^[a-f0-9]{64}$/),byteLength:z.number().int().positive().max(2097152)})).max(6)});
/** Explicit loopback synthetic UI harness. Never imported by production composition.
 * Gold JPEG/OCR adapters exercise the actual private panel/controller; native OCR,
 * native sanitization and physical source accuracy have separate acceptance gates. */
export default function PartOnePrivatePreview(){
 const router=useRouter(),ownerRef=useRef<string|null>(null),bindingRef=useRef<CaptureBinding|null>(null);
 const [draft]=useState(()=>new MemoryLabelDraft()),[controller,setController]=useState<PrivateCaptureController|null>(null);
 const [owner,setOwner]=useState<string|null>(null),[binding,setBinding]=useState<CaptureBinding|null>(null),[error,setError]=useState<string|null>(null);
 const savedId=useRef<string|null>(null),[show,setShow]=useState(true),[ready,setReady]=useState(false);
 const fixtureReviewId=useRef<string|null>(null);
 const enabled=__DEV__&&process.env.EXPO_PUBLIC_PART_ONE_FIXTURE_UI==='true';
 useEffect(()=>()=>{draft.endSheet();ownerRef.current=null;},[draft]);
 async function load(resume=false){
  if(!enabled)return;controller?.close();draft.endSheet();setError(null);setReady(false);
  try{
   const response=await fetch(`${LOCAL_FIXTURE_ORIGIN}/bootstrap?owner=0${resume?'&resume=1':''}`);if(!response.ok)throw Error();
   const fixture=Bootstrap.parse(await response.json());ownerRef.current=fixture.ownerId;setOwner(fixture.ownerId);savedId.current=fixture.capture.captureSessionId;fixtureReviewId.current=fixture.reviewId;
   const value:CaptureBinding={...fixture.capture,ownerId:fixture.ownerId,sheetSessionId:fixture.capture.scanId};bindingRef.current=value;setBinding(value);
   const transport=createPartOnePrivateTransport({enabled:()=>enabled,invoke:async(path,options)=>{
    const reply=await fetch(`${LOCAL_FIXTURE_ORIGIN}/${path}`,{method:options.method,body:options.body,signal:options.signal,
     headers:{...options.headers,authorization:`Bearer ${fixture.token}`}});
    if(!reply.ok)return{data:null,error:{context:reply}};return{data:await reply.json(),error:null};
   }});
   const sanitize=createPrivateLabelSanitizer({prepareUpload:async(input)=>{
    const {uri,cropRegion}=input;
    const photo=fixture.photos.find(item=>uri===`file:///synthetic-gold/${item.evidenceId}.jpg`);if(!photo)throw Error();
    return{status:'prepared',base64:photo.base64,mimeType:'image/jpeg',width:photo.width,height:photo.height,sourceWidth:photo.width,sourceHeight:photo.height,
     orientationTransform:[1,0,0,0,1,0,0,0,1],cropRegion,recipeVersion:'derive-private-jpeg-v1',
     derivativeObservation:{evidenceId:input.evidenceId,captureSessionId:input.captureSessionId,generation:input.generation,
      recognizer:'synthetic_fixture',recognizerVersion:'private-gold-v1',languageConfig:['en'],correctionEnabled:false,
      sourceWidth:photo.width,sourceHeight:photo.height,orientationTransform:[1,0,0,0,1,0,0,0,1],status:'recognized',
      lines:photo.text.split('\n').map((text,index)=>({text,region:[.1,index/20,.8,.04],confidence:.99,alternatives:[]}))}};
   }});
   const next=createPrivateCaptureController({enabled,transport,sanitize,currentOwner:()=>ownerRef.current,currentDraft:()=>bindingRef.current?draft.read(bindingRef.current):null,
    createId:createCatalogRequestId,reviewId:()=>fixtureReviewId.current,onSaved:()=>{draft.endSheet();bindingRef.current=null;setBinding(null);}});
   next.setOwner(fixture.ownerId);next.bind(fixture.ownerId,fixture.capture,fixture.result);
   if(resume){bindingRef.current=null;setBinding(null);setController(next);setShow(true);if(!await next.recover(fixture.ownerId,fixture.capture.captureSessionId))throw Error();setReady(true);return;}
   draft.begin(value,0);
   for(const photo of fixture.photos){
    const ticket=draft.addPhoto(value,photo.evidenceId,`file:///synthetic-gold/${photo.evidenceId}.jpg`);if(ticket==='cap_reached')throw Error();
    await draft.recognize(ticket,{recognize:async input=>({evidenceId:input.evidenceId,captureSessionId:input.captureSessionId,generation:input.generation,
     recognizer:'synthetic_fixture',recognizerVersion:'private-gold-v1',languageConfig:['en'],correctionEnabled:false,sourceWidth:photo.width,sourceHeight:photo.height,
     orientationTransform:[1,0,0,0,1,0,0,0,1],status:'recognized',lines:photo.text.split('\n').map((text,index)=>({text,region:[.1,index/20,.8,.04],confidence:.99,alternatives:[]}))})},()=>bindingRef.current!,['en']);
    next.setPhotoRole(photo.evidenceId,photo.role);
   }
   setController(next);setShow(true);setReady(true);
  }catch{setError('Synthetic loopback server unavailable. No production call was made.');}
 }
 if(!enabled)return <Redirect href="/(tabs)/check"/>;
 return <View style={{flex:1,paddingTop:64,paddingHorizontal:20,backgroundColor:'#FAFAF7'}}>
  <Text accessibilityRole="header">Private workflow synthetic UI</Text>
  <Text>Isolated local SQL and Storage. Injected gold OCR and JPEG adapters.</Text>
  {error&&<Text accessibilityRole="alert">{error}</Text>}
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:4}}>
  <Button size="small" style={{width:'48%'}} label="Load isolated private fixture" onPress={()=>void load()}/>
  <Button size="small" style={{width:'48%'}} label="Hide private fixture panel" onPress={()=>setShow(false)}/>
  <Button size="small" style={{width:'48%'}} label="Reopen isolated saved evidence" onPress={()=>void load(true)}/>
  <Button size="small" style={{width:'48%'}} label="Prepare isolated corrected review" onPress={()=>void (async()=>{try{const response=await fetch(`${LOCAL_FIXTURE_ORIGIN}/review-id?owner=0`);if(!response.ok)throw Error();fixtureReviewId.current=PartOneIdSchema.parse((await response.json()).reviewId);}catch{setError('Synthetic review unavailable');}})()}/>
  <Button size="small" style={{width:'48%'}} label="Use captured-source validation" onPress={()=>{fixtureReviewId.current=null;setError('Next synthetic save uses ordinary captured-source validation.');}}/>
  <Button size="small" style={{width:'48%'}} label="Delay isolated private commit" onPress={()=>void (async()=>{try{const response=await fetch(`${LOCAL_FIXTURE_ORIGIN}/delay-next-commit`);if(!response.ok)throw Error();setError('Next synthetic commit delayed for cancellation test');}catch{setError('Synthetic delay unavailable');}})()}/>
  <Button size="small" style={{width:'48%'}} label="Switch private fixture account" onPress={()=>{draft.accountChanged();bindingRef.current=null;setBinding(null);ownerRef.current='ff000000-0000-4000-8000-000000000999';setOwner(ownerRef.current);controller?.setOwner(ownerRef.current);setShow(true);}}/>
  <Button size="small" style={{width:'48%'}} label="Back from private fixture" onPress={()=>{controller?.close();draft.endSheet();router.replace('/(tabs)/check');}}/>
  </View>
  <Text>{ready?'Synthetic fixture ready':'Synthetic fixture not loaded'}</Text>
  <ScrollView style={{flex:1}} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:40}}>{show&&controller&&owner&&<PartOnePrivateCapturePanel controller={controller} ownerId={owner} draft={draft} binding={binding}/>}</ScrollView>
 </View>;
}
