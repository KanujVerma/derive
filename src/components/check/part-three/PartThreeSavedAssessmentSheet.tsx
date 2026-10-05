import React, { useEffect, useState } from 'react';
import { Image } from 'react-native';
import type { ScanResult } from '../../../contracts/PartOne';
import { partOneTransport } from '../../../services/partOne';
import { savedCheckIdentity } from '../../../presentation/part-three/savedIdentity';
import { researchSubjectFor } from '../../../presentation/part-four/researchSubject';
import { CheckResultView } from '../result-sheet/CheckResultContent';
import { ResultSheetSurface } from '../result-sheet/ResultSheetSurface';
import { PartThreeSummary } from './PartThreeSummary';
import { PartFourSections } from '../part-four/PartFourSections';
import { PartThreeDetails } from './PartThreeDetails';
import { usePartThreeCheck } from './usePartThreeCheck';
import { colors } from '../../../constants/theme';

/** Saved answer and basis are independently reauthorized. Current computation
 * remains internal and must not silently replace this historical answer. */
export function PartThreeSavedAssessmentSheet({ ownerId, savedAssessmentId, onClose, readScan = partOneTransport.read }: {
    ownerId: string; savedAssessmentId: string; onClose: () => void;
    readScan?: (id: string) => Promise<ScanResult>;
}) {
    const check = usePartThreeCheck({ ownerId, details: null, savedAssessmentId });
    const savedAnswer = check.view.historical?.assessmentWhenSaved;
    const displayedResult = savedAnswer?.binding.ownerId===ownerId ? savedAnswer : null;
    const basis = check.ingredientDetails?.result ?? null;
    const headerKey = `${ownerId}:${savedAssessmentId}:${basis?.bindingKey ?? ''}`;
    const [header,setHeader] = useState<{key:string;scan:ScanResult}|null>(null);
    const [failedImage,setFailedImage] = useState<string|null>(null);
    const [clock,setClock] = useState(Date.now);
    const now = Math.max(clock,Date.now());
    const identity = savedCheckIdentity(header?.key===headerKey?header.scan:null,basis,displayedResult,now);
    const name = identity?.name ?? displayedResult?.summary?.namedDecision.name ?? 'Saved product Check';
    useEffect(()=>{
        if (basis?.state!=='ready' || !readScan) return;
        let active=true,sequence=0;
        const refresh=()=>{const attempt=++sequence;void readScan(basis.scanId).then(scan=>{if(active&&attempt===sequence)setHeader({key:headerKey,scan});}).catch(()=>{if(active&&attempt===sequence)setHeader(null);});};
        refresh();const timer=setInterval(refresh,10000);
        return ()=>{active=false;clearInterval(timer);};
    },[headerKey,basis?.scanId,readScan]);
    const expiry = basis ? Math.min(Date.parse(basis.expiresAt),...(basis.state==='ready'?basis.output.reading.dependencyManifest.sourceRefs.map(ref=>Date.parse(ref.expiresAt)):[]),identity?Date.parse(identity.expiresAt):Infinity) : null;
    useEffect(()=>{
        if (expiry===null || !Number.isFinite(expiry) || expiry<=now) return;
        const timer=setTimeout(()=>setClock(Date.now()),Math.min(60000,expiry-now));
        return ()=>clearTimeout(timer);
    },[expiry,clock,now]);
    return <ResultSheetSurface inline={false} presentationKey={`saved-assessment:${savedAssessmentId}`} onClose={onClose} onInteraction={check.interact} onExpandedChange={()=>{}}
      summary={<CheckResultView section="summary" facts={{brand:identity?.brand??'',name,categoryLabel:identity?.variantText??'',formula:null,source:null}}
        identityImage={identity?.image && failedImage!==identity.image.url ? <Image accessibilityLabel={`${name} package`} source={{uri:identity.image.url}} resizeMode="contain" style={{width:68,height:82,borderRadius:12,backgroundColor:colors.canvas}} onError={()=>setFailedImage(identity.image!.url)}/> : undefined}
        verdict={{state:'unknown',label:'',reason:'',findings:[]}} personalSummary={<PartThreeSummary view={{...check.view,result:displayedResult}} identityName={name}/>}/> }>
      <PartThreeDetails view={{...check.view,result:displayedResult}}/>
      {displayedResult?.partFour && <PartFourSections packet={displayedResult.partFour} researchSubject={researchSubjectFor(displayedResult.binding.subject)} now={now}/>}
    </ResultSheetSurface>;
}
