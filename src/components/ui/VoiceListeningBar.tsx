import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { colors, spacing } from '@/src/constants/theme';
import { Icon } from '@/src/components/ui/Icon';

const BAR_COUNT = 16;

export const VoiceListeningBar: React.FC<{
  onStop: () => void;
}> = ({ onStop }) => {
  const bars = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.25))
  ).current;

  useEffect(() => {
    const animations = bars.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 0.4 + ((index * 17) % 7) * 0.08,
            duration: 180 + (index % 5) * 35,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.18 + ((index * 11) % 4) * 0.06,
            duration: 180 + (index % 4) * 30,
            useNativeDriver: true,
          }),
        ])
      )
    );
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [bars]);

  return (
    <View style={styles.row}>
      <View style={styles.wave} accessibilityLabel="Listening">
        {bars.map((value, index) => (
          <Animated.View
            key={index}
            style={[
              styles.bar,
              { transform: [{ scaleY: value }] },
            ]}
          />
        ))}
      </View>
      <TouchableOpacity
        onPress={onStop}
        activeOpacity={0.8}
        style={styles.stopButton}
        accessibilityRole="button"
        accessibilityLabel="Stop dictation"
      >
        <Icon name="stop" size={14} color={colors.inkInverse} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    gap: spacing.sm,
  },
  wave: {
    flex: 1,
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  bar: {
    width: 3,
    height: 28,
    borderRadius: 2,
    backgroundColor: colors.brand,
  },
  stopButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
