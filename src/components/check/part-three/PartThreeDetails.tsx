import React from 'react';
import { Text, View } from 'react-native';
import type { PartThreeView } from '../../../presentation/part-three/controller';
import { findingCopy,reportQualifierCopy } from '../../../presentation/part-three/copy';
import { spacing } from '../../../constants/theme';
/** Optional selection stays below deciding and mandatory information. */
export function PartThreeDetails({view}:{view:PartThreeView}) {
 const result=view.result;
 const finding=result?.state==='ready' ? result.findings.find(f=>f.id===result.selectedTradeoffId&&!f.mandatoryVisibility) : null;
 const reports=result?.state==='ready'?result.findings.filter(f=>f.kind==='experience'):[];
 if(!finding&&!reports.length)return null;
 const scope=finding?{published_version:'Published list · Package not confirmed',confirmed_package:'Confirmed package evidence',source_reading:'Photo reading · Product presence unconfirmed',report:'Based on your report',comparison:'Comparison with one selected current item'}[finding.arguments.scope]:null;
 return <View style={{gap:spacing.xs}}>{finding&&<><Text accessibilityRole="header">Other considerations</Text><Text>{findingCopy(finding)}</Text><Text>{scope}</Text></>}{reports.map(f=><View key={f.id} style={{gap:spacing.xs}}><Text accessibilityRole="header">Your reported experience</Text><Text>{findingCopy(f)}</Text>{reportQualifierCopy(f).map((copy,i)=><Text key={i}>{copy}</Text>)}</View>)}</View>;
}
