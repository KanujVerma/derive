import React from 'react';
import { Text } from 'react-native';
import type { PrivateIngredientQuery } from '@/src/contracts/PrivateIngredientSearch';
import { colors, typography } from '@/src/constants/theme';

/** Grounding suggestions are rendered in an isolated native view for this private phone test only. */
export function PrivateIngredientSearch(_props: { query: PrivateIngredientQuery; ownerId: string }) {
  return <Text style={{ color: colors.inkMuted, fontSize: typography.sizes.caption }}>
    Published ingredient search is available in the private iPhone test build.
  </Text>;
}
