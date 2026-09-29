import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { rhythm, textStyles } from '../../constants/theme';

export function QuestionGroup({ label, support, children, style }: {
  label: string; support?: string; children: React.ReactNode; style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.group, style]}>
    <Text style={textStyles.question} accessibilityRole="header">{label}</Text>
    {support ? <Text style={textStyles.supporting}>{support}</Text> : null}
    {children}
  </View>;
}
const styles = StyleSheet.create({ group: { gap: rhythm.labelToContent } });
