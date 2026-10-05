import { researchSubjectFor } from '../../../presentation/part-four/researchSubject';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { CheckResultView } from '../result-sheet/CheckResultContent';
import { ResultSheetSurface } from '../result-sheet/ResultSheetSurface';
import { Button } from '../../ui/Button';
import { PartThreeSummary } from './PartThreeSummary';
import { PartFourSections } from '../part-four/PartFourSections';
import { PartThreeDetails } from './PartThreeDetails';
import { PartThreeControls } from './PartThreeControls';
import { usePartThreeCheck } from './usePartThreeCheck';
import { PartTwoSourceSummary } from '../part-two/PartTwoIngredients';
import { sourceIngredientContext } from '../../../presentation/part-four/ingredientContext';
import { ISOLATED_423_EDUCATION } from '../../../domain/part-four/knowledge423';
import { PART_FOUR_ENABLED, PART_FOUR_CLIENT_SELECTION } from '../../../services/partThree';
/** Assessment-only saves reopen on the same canonical sheet surface. Bodies are live reads. */
export function PartThreeSavedAssessmentSheet({ ownerId, savedAssessmentId, onClose }: {
    ownerId: string;
    savedAssessmentId: string;
    onClose: () => void;
}) {
    const check = usePartThreeCheck({ ownerId, details: null, savedAssessmentId });
    const [assessmentView,setAssessmentView]=useState<'current'|'saved'>('current');
    const displayedResult=assessmentView==='saved'&&check.view.historical?check.view.historical.assessmentWhenSaved:check.view.result;
    const identityName=displayedResult?.summary?.namedDecision.name ?? check.view.historical?.assessmentWhenSaved?.summary?.namedDecision.name;
    const details = check.ingredientDetails;
    const [clock, setClock] = useState(Date.now);
    const now = Math.max(clock, Date.now());
    const reading = details?.result?.state === 'ready' ? details.result.output.reading : null;
    const expiry = details?.result ? Math.min(Date.parse(details.result.expiresAt), ...(reading?.dependencyManifest.sourceRefs.map(source => Date.parse(source.expiresAt)) ?? [])) : null;
    useEffect(() => {
        if (expiry === null || !Number.isFinite(expiry) || expiry <= now) return;
        const timer = setTimeout(() => setClock(Date.now()), Math.min(60000, expiry - now));
        return () => clearTimeout(timer);
    }, [expiry, clock, now]);
    const education = check.enabled && PART_FOUR_ENABLED && PART_FOUR_CLIENT_SELECTION?.education === 'approved423' && check.context
        ? {ownerId, context: check.context, knowledge: ISOLATED_423_EDUCATION} : undefined;
    const context = education && details ? sourceIngredientContext(details.result, education, now) : null;
    const contextSummary = context?.points.length && details ? <View>
        <Text accessibilityRole="header">With your current profile</Text>
        <PartTwoSourceSummary view={details} education={education} now={now}/>
        <Text>Current profile context is separate from the assessment when saved.</Text>
    </View> : null;
    return <ResultSheetSurface inline={false} presentationKey={`saved-assessment:${savedAssessmentId}`} onClose={onClose} onInteraction={check.interact} onExpandedChange={() => { }} summary={<CheckResultView section="summary" facts={{brand:'',name:identityName ?? 'Saved product Check',categoryLabel:'',formula:null,source:null}} verdict={{state:'unknown',label:'',reason:'',findings:[]}} personalSummary={<PartThreeSummary view={check.view} identityName={identityName} assessmentView={assessmentView} onAssessmentViewChange={setAssessmentView}/>}/>}>
  {assessmentView==='current' && contextSummary}
  <PartThreeDetails view={{...check.view,result:displayedResult}}/>
  {displayedResult?.partFour && <PartFourSections packet={displayedResult.partFour} researchSubject={researchSubjectFor(displayedResult.binding.subject)} now={now} withdrawn={assessmentView==='current' && Date.parse(displayedResult.validUntil)<=now}/>}
  <PartThreeControls check={check} section="details"/>
  <Button label="Refresh current Check" variant="ghost" onPress={check.refresh}/>

 </ResultSheetSurface>;
}
