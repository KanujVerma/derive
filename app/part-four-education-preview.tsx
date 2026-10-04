import React,{useMemo} from 'react';
import {ScrollView,Text,View} from 'react-native';
import {Redirect,useLocalSearchParams} from 'expo-router';
import {PartFourSections} from '@/src/components/check/part-four/PartFourSections';
import {educationPreviewPacket} from '@/src/presentation/part-four/educationPreview';
/** Unsaved original reference text. No Auth, provider or registry acquisition. */
export default function PartFourEducationPreview(){
 const {which}=useLocalSearchParams<{which?:string}>();
 const enabled=__DEV__&&process.env.EXPO_PUBLIC_PART_THREE_FIXTURE_UI==='true';
 const selected=which==='expansion'?'expansion':'revisions';
 const packet=useMemo(()=>enabled?educationPreviewPacket(selected,new Date().toISOString()):null,[enabled,selected]);
 if(!enabled)return <Redirect href="/(tabs)/check"/>;
 return <ScrollView contentContainerStyle={{paddingTop:65,paddingHorizontal:20,paddingBottom:45,backgroundColor:'#FFFFFF'}}><View>
  <Text accessibilityRole="header">Local education reference</Text>
  <Text>This synthetic text preview shows approved ingredient copy. No photo, product, account, personal decision or Save is involved.</Text>
  <PartFourSections packet={packet}/>
 </View></ScrollView>;
}
