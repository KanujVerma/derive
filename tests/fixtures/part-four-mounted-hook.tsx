import React from 'react';
import {usePartThreeCheck} from '../../src/components/check/part-three/usePartThreeCheck';
import {PartFourSections} from '../../src/components/check/part-four/PartFourSections';
import {PartThreeSummary} from '../../src/components/check/part-three/PartThreeSummary';
export function MountedPartFour(props:any){const check=usePartThreeCheck(props);return <><PartThreeSummary view={check.view}/><PartFourSections packet={check.view.result?.partFour??check.view.historical?.assessmentWhenSaved.partFour} onInteract={()=>{}}/><button label="Exact Save" onPress={()=>check.save()}/><button label="Choose test use" onPress={()=>check.update({intent:'replace',comparatorId:null,candidateRoutineItemId:null,selectedManualReportIds:[],use:{purpose:'moisturizing',site:'face',useForm:'leave_on'}})}/><span check={check}/></>;}
