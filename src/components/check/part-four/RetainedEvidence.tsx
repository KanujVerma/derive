import React from 'react';
import { Text, View } from 'react-native';
import type { RetainedEvidence as SavedEvidence } from '../../../contracts/RetainedEvidence';
import { reprojectRetainedEvidence } from '../../../domain/part-four/retainedEvidence';
import { partFourDisplayText } from '../../../presentation/part-four/sections';

/** Historical evidence is projected again at display time. Missing fields remain
 * missing; this view cannot refill them from a current offer or research brief. */
export function RetainedEvidence({evidence,now=Date.now(),withdrawnDependencies=[]}:{evidence?:SavedEvidence;now?:number;withdrawnDependencies?:readonly string[]}) {
 if(!evidence||!evidence.fields.length||!Number.isFinite(now))return null;
 const projected=reprojectRetainedEvidence(evidence,{now:new Date(now).toISOString(),purpose:'display',withdrawnDependencies});
 const observations=projected.fields.filter(row=>row.kind==='brief_observation'&&row.value!==null);
 const prices=projected.fields.filter(row=>row.kind==='offer_price'&&row.value!==null);
 const omitted=projected.fields.filter(row=>row.state!=='retained');
 if(!observations.length&&!prices.length&&!omitted.length)return null;
 return <View style={{gap:8}}>
  <Text accessibilityRole="header">Evidence saved with this check</Text>
  {observations.map(row=>row.kind==='brief_observation'&&row.value&&<Text key={row.recordId}>{partFourDisplayText(row.value.text)}</Text>)}
  {prices.map(row=>row.kind==='offer_price'&&row.value&&<Text key={row.recordId}>{`Saved product price: ${partFourDisplayText(row.value.amount)} ${partFourDisplayText(row.value.currency)}. Current price and offer eligibility require a fresh check.`}</Text>)}
  {omitted.length>0&&<Text>Some evidence shown when this check was saved is now omitted, expired, withdrawn or restricted. Its protected contents are unavailable.</Text>}
  {observations.length>0&&<Text>Based on selected sources when saved. These observations do not establish review consensus or clinical benefit.</Text>}
 </View>;
}

export function RetainedEvidenceSources({evidence,now=Date.now(),withdrawnDependencies=[]}:{evidence?:SavedEvidence;now?:number;withdrawnDependencies?:readonly string[]}) {
 if(!evidence||!Number.isFinite(now))return null;
 const projected=reprojectRetainedEvidence(evidence,{now:new Date(now).toISOString(),purpose:'display',withdrawnDependencies});
 return <View>{projected.fields.map(row=>row.kind==='brief_source'&&row.value&&<View key={row.recordId}>
  <Text>{partFourDisplayText(row.value.title)}</Text><Text selectable>{partFourDisplayText(row.value.url)}</Text>
  <Text>{`Retrieved ${row.value.retrievedAt.slice(0,10)} · ${row.value.kind.replaceAll('_',' ')}`}</Text>
  <Text>{partFourDisplayText(row.value.coverageLimit)}</Text>
 </View>)}</View>;
}
