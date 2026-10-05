import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Text} from 'react-native';
import {ContextFlow,type ContextFlowProps} from './ContextFlow';
import {Screen} from '../ui/Screen';
import {Button} from '../ui/Button';
import {initializePartThreeSession,partThreeSession} from '@/src/services/partThree';
import {setupDraftStore} from '@/src/services/setupDraft';
import type {SetupProgress} from '@/src/presentation/p0b-personalization/setupDraftStorage';
/** Only fresh setup persists. Confirmed profile edits retain their existing contracts. */
export function ResumableSetupFlow(props:ContextFlowProps & {baseRevision:number;ownerId:string}){
 const [loaded,setLoaded]=useState(false),[progress,setProgress]=useState<SetupProgress|null>(null),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true;setLoaded(false);setFailed(false);void initializePartThreeSession(props.ownerId).then(account=>setupDraftStore.read(account,props.baseRevision)).then(value=>{if(active){setProgress(value);setLoaded(true);}}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;void setupDraftStore.flush().catch(()=>undefined);};},[props.ownerId,props.baseRevision,attempt]);
 const firstProgress=useRef(true);
 const changed=useCallback((value:SetupProgress)=>{if(firstProgress.current){firstProgress.current=false;return;}const account=partThreeSession(props.ownerId);if(account)setupDraftStore.schedule(account,props.baseRevision,value);},[props.ownerId,props.baseRevision]);
 if(!loaded)return <Screen><Text>{failed?'Your setup draft could not be loaded.':'Loading your skin setup…'}</Text>{failed&&<Button label="Try again" onPress={()=>setAttempt(n=>n+1)}/>}<Button label="Back" variant="ghost" onPress={props.onSkip}/></Screen>;
 return <ContextFlow {...props} initialProgress={progress??undefined} onProgress={changed}/>;
}
