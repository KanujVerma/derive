import React from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { SymbolView, SFSymbol } from 'expo-symbols';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/src/constants/theme';

export type IconName =
  | 'today'
  | 'plan'
  | 'ask'
  | 'progress'
  | 'check'
  | 'checkCircle'
  | 'close'
  | 'back'
  | 'forward'
  | 'camera'
  | 'lock'
  | 'shield'
  | 'info'
  | 'warning'
  | 'bell'
  | 'shipping'
  | 'sparkle'
  | 'flashlight'
  | 'person'
  | 'trash'
  | 'plus'
  | 'search'
  | 'bottle'
  | 'scan'
  | 'mic'
  | 'stop'
  | 'down'
  | 'up';

interface IconConfig {
  sfSymbol: SFSymbol;
  ionicon: keyof typeof Ionicons.glyphMap;
}

const ICON_MAP: Record<IconName, IconConfig> = {
  today: { sfSymbol: 'sun.max', ionicon: 'sunny-outline' },
  plan: { sfSymbol: 'list.bullet.rectangle', ionicon: 'list-outline' },
  ask: { sfSymbol: 'bubble.left.and.bubble.right', ionicon: 'chatbubbles-outline' },
  progress: { sfSymbol: 'clock.arrow.circlepath', ionicon: 'time-outline' },
  check: { sfSymbol: 'checkmark', ionicon: 'checkmark' },
  checkCircle: { sfSymbol: 'checkmark.circle.fill', ionicon: 'checkmark-circle' },
  close: { sfSymbol: 'xmark', ionicon: 'close' },
  back: { sfSymbol: 'chevron.left', ionicon: 'chevron-back' },
  forward: { sfSymbol: 'chevron.right', ionicon: 'chevron-forward' },
  camera: { sfSymbol: 'camera', ionicon: 'camera-outline' },
  lock: { sfSymbol: 'lock.fill', ionicon: 'lock-closed' },
  shield: { sfSymbol: 'shield.fill', ionicon: 'shield' },
  info: { sfSymbol: 'info.circle', ionicon: 'information-circle-outline' },
  warning: { sfSymbol: 'exclamationmark.triangle.fill', ionicon: 'warning-outline' },
  bell: { sfSymbol: 'bell', ionicon: 'notifications-outline' },
  shipping: { sfSymbol: 'shippingbox', ionicon: 'cube-outline' },
  sparkle: { sfSymbol: 'sparkles', ionicon: 'sparkles-outline' },
  flashlight: { sfSymbol: 'flashlight.on.fill', ionicon: 'flashlight' },
  person: { sfSymbol: 'person.fill', ionicon: 'person' },
  trash: { sfSymbol: 'trash', ionicon: 'trash-outline' },
  plus: { sfSymbol: 'plus', ionicon: 'add' },
  search: { sfSymbol: 'magnifyingglass', ionicon: 'search-outline' },
  bottle: { sfSymbol: 'cross.vial', ionicon: 'flask-outline' },
  scan: { sfSymbol: 'viewfinder', ionicon: 'scan-outline' },
  mic: { sfSymbol: 'mic.fill', ionicon: 'mic-outline' },
  stop: { sfSymbol: 'stop.fill', ionicon: 'stop' },
  down: { sfSymbol: 'chevron.down', ionicon: 'chevron-down' },
  up: { sfSymbol: 'chevron.up', ionicon: 'chevron-up' },
};

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: ViewStyle;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  color = colors.ink,
  style,
}) => {
  const config = ICON_MAP[name] || ICON_MAP.info;

  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.container, { width: size, height: size }, style]}>
        <SymbolView
          name={config.sfSymbol}
          size={size}
          tintColor={color}
          resizeMode="scaleAspectFit"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Ionicons name={config.ionicon} size={size} color={color} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
