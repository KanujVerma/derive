import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors, typography, spacing, radii } from '@/src/constants/theme';
import { GlassContainer } from '@/src/components/ui/GlassContainer';

import { Icon, IconName } from '@/src/components/ui/Icon';

function TabIcon({ label, icon, focused }: { label: string; icon: IconName; focused: boolean }) {
  const iconColor = focused ? colors.brand : colors.inkMuted;
  return (
    <View style={styles.iconContainer}>
      <Icon name={icon} size={22} color={iconColor} />
      <Text style={[styles.labelText, focused && styles.labelFocused]}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => (
          <GlassContainer
            isFloating={true}
            style={StyleSheet.absoluteFill}
            glassEffectStyle="regular"
            tintColor="rgba(255, 254, 251, 0.94)"
          />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Today',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Today" icon="today" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: 'Plan',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Plan" icon="plan" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Scan" icon="scan" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="ask"
        options={{
          title: 'Ask',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Ask" icon="ask" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Progress" icon="progress" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}


const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 20,
    right: 20,
    height: 64,
    borderRadius: radii.xl,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    elevation: 0,
    paddingTop: 8,
    paddingBottom: 8,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
    height: 48,
  },
  iconText: {
    fontSize: 20,
    color: colors.inkMuted,
    marginBottom: 2,
  },
  iconFocused: {
    color: colors.brand,
    fontWeight: typography.weights.bold,
  },
  labelText: {
    fontSize: typography.sizes.micro,
    color: colors.inkMuted,
    fontWeight: typography.weights.medium,
  },
  labelFocused: {
    color: colors.brand,
    fontWeight: typography.weights.bold,
  },
});
