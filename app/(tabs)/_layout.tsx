import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, radii, spacing } from '@/src/constants/theme';
import { GlassContainer } from '@/src/components/ui/GlassContainer';

import { Icon, IconName } from '@/src/components/ui/Icon';

const TAB_BAR_HEIGHT = 56;

function TabIcon({ label, icon, focused }: { label: string; icon: IconName; focused: boolean }) {
  const iconColor = focused ? colors.brand : colors.inkMuted;
  return (
    <View style={styles.iconContainer}>
      <Icon name={icon} size={20} color={iconColor} />
      <Text style={[styles.labelText, focused && styles.labelFocused]}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomOffset = Math.max(insets.bottom, 12);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: [styles.tabBar, { bottom: bottomOffset }],
        tabBarItemStyle: styles.tabBarItem,
        tabBarIconStyle: styles.tabBarIcon,
        tabBarButton: ({
          children,
          onPress,
          onLongPress,
          style,
          accessibilityLabel,
          testID,
        }) => (
          <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            style={[style, styles.tabBarButton]}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            testID={testID}
          >
            {children}
          </Pressable>
        ),
        tabBarBackground: () => (
          <GlassContainer
            isFloating={true}
            style={StyleSheet.absoluteFill}
            glassEffectStyle="regular"
            tintColor={colors.glass.tintLight}
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
        name="shop"
        options={{
          title: 'Shop',
          tabBarIcon: ({ focused }) => (
            <TabIcon label="Shop" icon="shop" focused={focused} />
          ),
        }}
      />
      {/* scan is hidden from tab bar — it redirects to /(tabs)/shop */}
      <Tabs.Screen
        name="scan"
        options={{
          href: null, // hide from tab bar
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
    // React Navigation's default bar uses `start`/`end: 0`, which wins over
    // `left`/`right` and kept the capsule full-bleed. Match tab screen gutters.
    start: spacing.lg,
    end: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    height: TAB_BAR_HEIGHT,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    borderRadius: radii.xl,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    elevation: 0,
    overflow: 'visible',
  },
  tabBarItem: {
    height: TAB_BAR_HEIGHT,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  tabBarIcon: {
    width: '100%',
    height: '100%',
  },
  tabBarButton: {
    flex: 1,
    padding: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
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
