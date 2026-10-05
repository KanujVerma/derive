import { researchSubjectFor } from '../../../presentation/part-four/researchSubject';
import React from 'react';
import { Text } from 'react-native';
import { ResultSheetSurface } from '../result-sheet/ResultSheetSurface';
import { Button } from '../../ui/Button';
import { PartThreeSummary } from './PartThreeSummary';
import { PartFourSections } from '../part-four/PartFourSections';
import { PartThreeDetails } from './PartThreeDetails';
import { PartThreeControls } from './PartThreeControls';
import { usePartThreeCheck } from './usePartThreeCheck';
/** Assessment-only saves reopen on the same canonical sheet surface. Bodies are live reads. */
export function PartThreeSavedAssessmentSheet({ ownerId, savedAssessmentId, onClose }: {
    ownerId: string;
    savedAssessmentId: string;
    onClose: () => void;
}) {
    const check = usePartThreeCheck({ ownerId, details: null, savedAssessmentId });
    return <ResultSheetSurface inline={false} presentationKey={`saved-assessment:${savedAssessmentId}`} onClose={onClose} onInteraction={check.interact} onExpandedChange={() => { }} summary={<PartThreeSummary view={check.view}/>} compactActions={<><PartThreeControls check={check}/><Button label="Refresh saved assessment" variant="ghost" onPress={check.refresh}/></>}>
  {check.view.historical?.assessmentWhenSaved?.partFour && <>
    <Text accessibilityRole="header">Supporting details when saved</Text>
    <PartThreeDetails view={{...check.view,result:check.view.historical.assessmentWhenSaved}}/>
    <PartFourSections packet={check.view.historical.assessmentWhenSaved.partFour} researchSubject={researchSubjectFor(check.view.historical.assessmentWhenSaved.binding.subject)}/>
  </>}
  {check.view.result?.partFour && check.view.historical && <Text accessibilityRole="header">Current supporting details</Text>}
  <PartThreeDetails view={check.view}/>
  {check.view.result?.partFour && <PartFourSections packet={check.view.result.partFour} researchSubject={researchSubjectFor(check.view.result.binding.subject)} withdrawn={Date.parse(check.view.result.validUntil)<=Date.now()}/>}
  <Text>Saved assessment metadata remains separate from saved product evidence. Reassessment checks the saved evidence and your current context.</Text>
 </ResultSheetSurface>;
}
