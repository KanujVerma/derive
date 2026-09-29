import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Modal, Platform, Pressable, StyleSheet, View, type View as NativeView } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ReduceMotion } from 'react-native-reanimated';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView, type BottomSheetBackdropProps, type BottomSheetHandleProps } from '@gorhom/bottom-sheet';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, radii, spacing } from '../../../constants/theme';
import { Icon } from '../../ui/Icon';

/** Guards the local animation only. Check still owns the result lifetime and close action. */
export function createSheetDismissGuard(key: string, onClose: () => void, currentKey: () => string | null) {
  let mounted = true, delivered = false;
  const isCurrent = () => mounted && currentKey() === key;
  return {
    activate: () => { mounted = true; },
    deactivate: () => { mounted = false; },
    isCurrent,
    dismiss: () => {
      if (!isCurrent() || delivered) return;
      delivered = true;
      onClose();
    },
  };
}

interface Props {
  visible?: boolean;
  presentationKey: string;
  /** Inline occupies the camera's existing companion slot. Other results use their current native Modal. */
  inline?: boolean;
  onClose: () => void;
  dismissLabel?: string;
  initialDetent?: 0 | 1;
  bottomInset?: number;
  children: React.ReactNode;
}

export function ResultSheetSurface({ visible = true, inline = false, presentationKey, ...props }: Props) {
  const currentKey = useRef<string | null>(null);
  currentKey.current = visible ? presentationKey : null;
  const readCurrentKey = useCallback(() => currentKey.current, []);
  const requestClose = useRef<(() => void) | null>(null);
  if (!visible) return null;
  const body = <SheetBody key={presentationKey} {...props} presentationKey={presentationKey}
    readCurrentKey={readCurrentKey} requestClose={requestClose} />;
  return inline ? body : <Modal visible transparent animationType="none" onRequestClose={() => requestClose.current?.()}>
    <SafeAreaProvider>{body}</SafeAreaProvider>
  </Modal>;
}

function SheetBody({ presentationKey, readCurrentKey, requestClose, onClose, dismissLabel = 'Close result',
  initialDetent = 0, bottomInset = 0, children }: Omit<Props, 'visible' | 'inline'> & {
    readCurrentKey: () => string | null; requestClose: React.RefObject<(() => void) | null>;
  }) {
  const insets = useSafeAreaInsets();
  const sheet = useRef<BottomSheet>(null);
  const handle = useRef<NativeView>(null);
  const [index, setIndex] = useState<number>(initialDetent);
  // The callback is captured for this mount, never replaced by a newer case's callback.
  const [guard] = useState(() => createSheetDismissGuard(presentationKey, onClose, readCurrentKey));
  const close = useCallback(() => {
    if (!guard.isCurrent()) return;
    if (sheet.current) sheet.current.close(); else guard.dismiss();
  }, [guard]);
  requestClose.current = close;
  useEffect(() => {
    guard.activate();
    const frame = requestAnimationFrame(() => {
      if (!guard.isCurrent() || Platform.OS === 'web') return;
      const node = findNodeHandle(handle.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    });
    return () => { cancelAnimationFrame(frame); guard.deactivate(); };
  }, [guard]);
  const backdrop = useCallback((props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props}
    appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.18} pressBehavior="close" />, []);
  const renderHandle = useCallback((_props: BottomSheetHandleProps) => <View style={styles.handleRow}>
    <Pressable ref={handle} style={styles.dragTarget} accessibilityRole="adjustable" accessibilityLabel="Product result"
      accessibilityHint="Swipe up for details. Swipe down to return. Double tap to expand or collapse."
      accessibilityValue={{ min: 0, max: 2, now: Math.max(index, 0), text: index === 0 ? 'Compact' : 'Expanded' }}
      accessibilityActions={[{ name: 'increment', label: 'Expand result' }, { name: 'decrement', label: 'Collapse result' }, { name: 'escape', label: dismissLabel }]}
      onAccessibilityEscape={close}
      onAccessibilityAction={({ nativeEvent }) => {
        if (!guard.isCurrent()) return;
        if (nativeEvent.actionName === 'increment') sheet.current?.snapToIndex(Math.min(index + 1, 2));
        if (nativeEvent.actionName === 'decrement') { if (index > 0) sheet.current?.snapToIndex(index - 1); else close(); }
        if (nativeEvent.actionName === 'escape') close();
      }}
      onPress={() => { if (guard.isCurrent()) sheet.current?.snapToIndex(index === 0 ? 1 : 0); }}>
      <View style={styles.indicator} />
    </Pressable>
    <Pressable style={styles.close} onPress={close} accessibilityRole="button" accessibilityLabel={dismissLabel}>
      <Icon name="close" size={20} color={colors.inkMuted} />
    </Pressable>
  </View>, [close, dismissLabel, guard, index]);
  return <GestureHandlerRootView style={styles.root} pointerEvents="box-none">
    <BottomSheet ref={sheet} index={initialDetent} snapPoints={['44%', '70%', '94%']} enableDynamicSizing={false}
      topInset={insets.top + spacing.xs} bottomInset={bottomInset} enablePanDownToClose overrideReduceMotion={ReduceMotion.System}
      onChange={next => { if (guard.isCurrent()) setIndex(next); }} onClose={guard.dismiss}
      handleComponent={renderHandle} backdropComponent={backdrop} backgroundStyle={styles.background}>
      <BottomSheetScrollView accessibilityViewIsModal onAccessibilityEscape={close}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {children}
      </BottomSheetScrollView>
    </BottomSheet>
  </GestureHandlerRootView>;
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, flex: 1, zIndex: 30 },
  background: { backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl },
  handleRow: { minHeight: layout.minTouchTarget, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md },
  dragTarget: { flex: 1, minHeight: layout.minTouchTarget, alignItems: 'center', justifyContent: 'center', marginLeft: layout.minTouchTarget },
  indicator: { width: 36, height: 5, borderRadius: radii.full, backgroundColor: colors.borderStrong },
  close: { width: layout.minTouchTarget, height: layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
});
