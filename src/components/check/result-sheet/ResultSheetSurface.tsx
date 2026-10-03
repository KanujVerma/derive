import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Keyboard, Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions, type View as NativeView } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ReduceMotion } from 'react-native-reanimated';
import BottomSheet, { BottomSheetBackdrop, BottomSheetScrollView, type BottomSheetBackdropProps, type BottomSheetHandleProps } from '@gorhom/bottom-sheet';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, radii, spacing } from '../../../constants/theme';
import { Icon } from '../../ui/Icon';
import { resultSheetGeometry } from '../../../presentation/check/result-sheet/geometry';

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
  onExpandedChange?: (expanded: boolean) => void;
  onScrollOffset?: (offset: number) => void;
  /** User interaction, excluding programmatic layout scroll. */
  onInteraction?: () => void;
  dismissLabel?: string;
  initialDetent?: 0 | 1;
  bottomInset?: number;
  /** Only identity and verdict appear in the collapsed fold. Findings appear on the first upward swipe. */
  summary?: React.ReactNode;
  /** Recovery is part of the measured compact fold. */
  compactActions?: React.ReactNode;
  /** Search replaces content within the same gesture surface. */
  replacement?: React.ReactNode;
  /** Search has one measured detent; keyboard lift must not select a full-result detent. */
  contentSized?: boolean;
  contentSizeResetKey?: string;
  /** Capture presents from the current native result modal, independently of sheet detents. */
  overlay?: React.ReactNode;
  children: React.ReactNode;
}

export function ResultSheetSurface({ visible = true, inline = false, presentationKey, overlay, ...props }: Props) {
  // Cancelling replacement search returns to an open result with a fresh guard.
  // Keep the native Modal and capture overlay mounted across this body lifetime.
  const bodyKey = `${presentationKey}:${props.replacement ? 'search' : 'result'}`;
  const currentKey = useRef<string | null>(null);
  currentKey.current = visible ? bodyKey : null;
  const readCurrentKey = useCallback(() => currentKey.current, []);
  const requestClose = useRef<(() => void) | null>(null);
  if (!visible) return null;
  const body = <SheetBody key={bodyKey} {...props} presentationKey={bodyKey}
    readCurrentKey={readCurrentKey} requestClose={requestClose} />;
  return inline ? <>{body}{overlay}</> : <Modal visible transparent animationType="none" onRequestClose={() => requestClose.current?.()}>
    <SafeAreaProvider>{body}{overlay}</SafeAreaProvider>
  </Modal>;
}

interface SheetHandleState {
  handle: React.RefObject<NativeView | null>;
  sheet: React.RefObject<BottomSheet | null>;
  closing: React.RefObject<boolean>;
  contentSized: boolean;
  index: number;
  close: () => void;
  dismissLabel: string;
  guard: ReturnType<typeof createSheetDismissGuard>;
  onInteraction?: () => void;
}
const SheetHandleContext = createContext<SheetHandleState | null>(null);

/** BottomSheet renders this as a component type. Keep the type stable during a
 * native touch; context updates its current detent, guard and callbacks. */
function SheetHandle(_props: BottomSheetHandleProps) {
  const state = useContext(SheetHandleContext);
  if (!state) return null;
  const { handle, sheet, closing, contentSized, index, close, dismissLabel, guard, onInteraction } = state;
  return <View style={styles.handleRow}>
    <Pressable ref={handle} style={styles.dragTarget} accessibilityRole="adjustable" accessibilityLabel="Product result"
      accessibilityHint={contentSized ? 'Swipe down to return. Search results expand this sheet.' : 'Swipe up for findings. Swipe down to return. Double tap to expand or collapse.'}
      accessibilityValue={{ min: 0, max: contentSized ? 0 : 2, now: Math.max(index, 0), text: index === 0 ? 'Compact' : 'Expanded' }}
      accessibilityActions={[{ name: 'increment', label: 'Expand result' }, { name: 'decrement', label: 'Collapse result' }, { name: 'escape', label: dismissLabel }]}
      onAccessibilityEscape={close}
      onAccessibilityAction={({ nativeEvent }) => {
        if (!guard.isCurrent() || closing.current) return;
        onInteraction?.();
        if (nativeEvent.actionName === 'increment') sheet.current?.snapToIndex(Math.min(index + 1, contentSized ? 0 : 2));
        if (nativeEvent.actionName === 'decrement') { if (index > 0) sheet.current?.snapToIndex(index - 1); else close(); }
        if (nativeEvent.actionName === 'escape') close();
      }}
      onPress={() => { if (guard.isCurrent() && !closing.current) { onInteraction?.(); sheet.current?.snapToIndex(contentSized ? 0 : index === 0 ? 1 : 0); } }}>
      <View style={styles.indicator} />
    </Pressable>
    <Pressable style={styles.close} onPress={close} accessibilityRole="button" accessibilityLabel={dismissLabel}>
      <Icon name="close" size={20} color={colors.inkMuted} />
    </Pressable>
  </View>;
}

function SheetBody({ presentationKey, readCurrentKey, requestClose, onClose, dismissLabel = 'Close result',
  initialDetent = 0, bottomInset = 0, summary, compactActions, replacement, children, contentSized = false, contentSizeResetKey, onExpandedChange, onScrollOffset, onInteraction }: Omit<Props, 'visible' | 'inline' | 'overlay'> & {
    readCurrentKey: () => string | null; requestClose: React.RefObject<(() => void) | null>;
  }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [summaryHeight, setSummaryHeight] = useState(0);
  useLayoutEffect(() => { if (contentSized) setSummaryHeight(0); }, [contentSized, contentSizeResetKey]);
  const geometry = resultSheetGeometry({ height: height - bottomInset, topInset: insets.top, bottomPadding: Math.max(insets.bottom, spacing.lg), summaryHeight, contentSized });
  const sheet = useRef<BottomSheet>(null);
  const outerHeight = useRef(height);
  const sheetTopInset = insets.top + spacing.xs;
  // Native close is asynchronous. Late personal/layout updates must not reopen it.
  const closing = useRef(false);
  const explicitlyClosing = useRef(false);
  const handle = useRef<NativeView>(null);
  const [index, setIndex] = useState<number>(initialDetent);
  useEffect(() => { onExpandedChange?.(index > 0 && !replacement); }, [index, replacement, onExpandedChange]);
  const closeAction = useRef(onClose);
  closeAction.current = onClose;
  // The guard owns this body lifetime; callback updates cannot cross its key fence.
  const [guard] = useState(() => createSheetDismissGuard(presentationKey, () => closeAction.current(), readCurrentKey));
  const close = useCallback(() => {
    if (!guard.isCurrent()) return;
    closing.current = true;
    explicitlyClosing.current = true;
    Keyboard.dismiss();
    // The library can reevaluate detents independently of our layout effect.
    // Its forced close fences that native reevaluation until acknowledgment.
    if (sheet.current) sheet.current.forceClose(); else guard.dismiss();
  }, [guard]);
  requestClose.current = close;
  useEffect(() => {
    if ((summary || compactActions) && summaryHeight && !contentSized && geometry.needsFullHeight && guard.isCurrent() && !closing.current) sheet.current?.snapToIndex(2);
  }, [summaryHeight, geometry.needsFullHeight, guard, summary, compactActions, contentSized]);
  useLayoutEffect(() => {
    guard.activate();
    return () => guard.deactivate();
  }, [guard]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!guard.isCurrent() || Platform.OS === 'web') return;
      const node = findNodeHandle(handle.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    });
    return () => cancelAnimationFrame(frame);
  }, [guard]);
  const backdrop = useCallback((props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props}
    appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.18} pressBehavior="close" />, []);
  return <GestureHandlerRootView style={styles.root} onLayout={event => { outerHeight.current = event.nativeEvent.layout.height; }} onTouchStart={onInteraction} pointerEvents="box-none" accessibilityViewIsModal>
    <SheetHandleContext.Provider value={{ handle, sheet, closing, contentSized, index, close, dismissLabel, guard, onInteraction }}><BottomSheet ref={sheet} accessible={false} index={initialDetent} snapPoints={summary || compactActions ? geometry.snapPoints : ['44%', '70%', '94%']} enableDynamicSizing={false}
      topInset={sheetTopInset} bottomInset={bottomInset} enablePanDownToClose keyboardBehavior="interactive" keyboardBlurBehavior="restore" enableBlurKeyboardOnGesture overrideReduceMotion={ReduceMotion.System}
      // -1 also means an off-detent keyboard/layout position in this library.
      // This nonmodal, nondetached sheet's hosting container excludes BOTH
      // insets. Its native close position is not the outer gesture-root height.
      // Require the actual boundary; keyboard/off-detent -1 stays interactive.
      onAnimate={(_from, next, _fromPosition, nextPosition) => { if (guard.isCurrent() && next === -1 && Math.abs(nextPosition - (outerHeight.current - sheetTopInset - bottomInset)) <= 1) closing.current = true; }}
      onChange={next => { if (guard.isCurrent()) {
        // A gesture close may be interrupted by keyboard/layout reevaluation.
        // A visibly reopened detent restores interaction; forceClose stays fenced.
        if (next >= 0 && !explicitlyClosing.current) closing.current = false;
        setIndex(next);
      } }} onClose={() => { if (guard.isCurrent()) { Keyboard.dismiss(); guard.dismiss(); } }}
      handleComponent={SheetHandle} backdropComponent={backdrop} backgroundStyle={styles.background}>
      <BottomSheetScrollView testID="result-sheet-scroll" onScrollBeginDrag={onInteraction} onAccessibilityEscape={close} onScroll={event => onScrollOffset?.(event.nativeEvent.contentOffset.y)}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {/* Keep search height stable as loading/helper rows disappear; explicit empty input resets it. */}
        {(summary || compactActions || replacement) && <View onLayout={event => { const measured = event.nativeEvent.layout.height; if (contentSized ? measured > summaryHeight : Math.abs(measured - summaryHeight) >= 1) setSummaryHeight(previous => contentSized ? Math.max(previous, measured) : measured); }}>{replacement ?? <>{summary}{compactActions}</>}</View>}
        {!replacement && (!summary || index > 0) && children}
      </BottomSheetScrollView>
    </BottomSheet></SheetHandleContext.Provider>
  </GestureHandlerRootView>;
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, flex: 1, zIndex: 30 },
  background: { backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl },
  handleRow: { minHeight: layout.minTouchTarget, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.md },
  dragTarget: { flex: 1, minHeight: layout.minTouchTarget, alignItems: 'center', justifyContent: 'center', marginLeft: layout.minTouchTarget },
  indicator: { width: 36, height: 5, borderRadius: radii.full, backgroundColor: colors.borderStrong },
  close: { width: layout.minTouchTarget, height: layout.minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
});
