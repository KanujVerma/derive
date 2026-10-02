import React from 'react';
import { Text } from 'react-native';
import { ResultSheetSurface } from '../result-sheet/ResultSheetSurface';
import { Button } from '../../ui/Button';
import { PartThreeSummary } from './PartThreeSummary';
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
  <PartThreeDetails view={check.view}/><Text>Saved assessment metadata remains separate from saved product evidence. Reassessment checks the saved evidence and your current context.</Text>
 </ResultSheetSurface>;
}
