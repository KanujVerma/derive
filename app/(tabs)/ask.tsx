import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radii } from '@/src/constants/theme';
import { ChatMessage, ProductScanResult } from '@/src/types/schema';
import { useRoutineStore } from '@/src/stores/routineStore';
import { useScanContextStore } from '@/src/stores/scanContextStore';
import { getCustomerErrorMessage } from '@/src/utils/customerErrors';
import {
  resolveAskDisplayBanner,
  resolveAskServiceContext,
  type AskRouteParams,
} from '@/src/utils/scanContext';
import { askQuestion } from '@/src/services/deriveClient';
import { ChatBubble } from '@/src/components/chat/ChatBubble';
import { GlassComposer } from '@/src/components/chat/GlassComposer';
import { Icon } from '@/src/components/ui/Icon';
import { analytics } from '@/src/services/analytics';
import { useRouter, useLocalSearchParams } from 'expo-router';

export default function AskScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams() as AskRouteParams;
  const { routine } = useRoutineStore();
  const flatListRef = useRef<FlatList>(null);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRouteBannerDismissed, setIsRouteBannerDismissed] = useState(false);
  const activeScannedProduct = useScanContextStore((s) => s.activeScannedProduct);
  const handledInitialQueryRef = useRef<string | null>(null);

  const starterPrompts = React.useMemo(() => {
    const activeTreatment = routine?.pmSteps.find((s) => s.category === 'treatment');
    const tonightPrompt = activeTreatment
      ? `Do I use ${activeTreatment.productName} tonight?`
      : routine
      ? 'What is my schedule tonight?'
      : 'What should my routine look like?';

    return [
      tonightPrompt,
      'Can I add this vitamin C?',
      'Why this moisturizer?',
      'My cheeks feel dry.',
      'Scan a product',
    ];
  }, [routine]);

  const hasInteracted = messages.length > 0;

  React.useEffect(() => {
    if (!params?.productName && !params?.scannedProductName && messages.length === 0) {
      useScanContextStore.getState().clearScanContext();
    }
    if (params?.initialQuery && handledInitialQueryRef.current !== params.initialQuery) {
      handledInitialQueryRef.current = params.initialQuery;
      const currentScanContext = useScanContextStore.getState().activeScannedProduct || undefined;
      handleSendMessage(params.initialQuery, undefined, currentScanContext);
    }
  }, [params?.initialQuery, params?.productName, params?.scannedProductName]);

  const handleSendMessage = async (
    text: string,
    imageUri?: string,
    scanContextOverride?: ProductScanResult
  ) => {
    const activeProduct = resolveAskServiceContext(
      useScanContextStore.getState().activeScannedProduct,
      scanContextOverride
    );

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      conversationId: 'conv_1',
      sender: 'user',
      text: text || 'Can I add this product to my routine?',
      attachmentUri: imageUri,
      attachmentType: imageUri ? 'product' : undefined,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    analytics.track('ask_message_sent', {
      hasAttachment: !!imageUri,
      queryLengthBucket: text.length < 25 ? 'short' : text.length < 80 ? 'medium' : 'long',
    });

    try {
      const response = await askQuestion(userMsg.text, {
        scannedProduct: activeProduct,
        photoAttachmentUri: userMsg.attachmentUri,
      });

      const isEmergency = response.safety?.isMedicalEmergency || response.safety?.severity === 'emergency';

      const deriveMsg: ChatMessage = {
        id: `drv_${Date.now()}`,
        conversationId: 'conv_1',
        sender: 'derive',
        text: response.directAnswer || response.answer,
        directAnswer: response.directAnswer,
        whyExplanation: response.whyExplanation,
        recommendedAction: response.recommendedAction,
        isSafetyEscalation: isEmergency,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, deriveMsg]);
      try {
        await Haptics.notificationAsync(
          isEmergency
            ? Haptics.NotificationFeedbackType.Warning
            : Haptics.NotificationFeedbackType.Success
        );
      } catch {}
    } catch (e: any) {
      console.warn('Failed to get advisor response:', e);
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        conversationId: 'conv_1',
        sender: 'derive',
        text: getCustomerErrorMessage('ask'),
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleStarterPress = (prompt: string) => {
    Haptics.selectionAsync();
    if (prompt === 'Scan a product') {
      analytics.track('shop_scan_opened', { source: 'shop_tab', entryPoint: 'ask_starter_pill' });
      router.push('/shop/scan');
    } else {
      handleSendMessage(prompt);
    }
  };

  const displayScanBanner = resolveAskDisplayBanner(
    activeScannedProduct,
    isRouteBannerDismissed ? undefined : params
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Clean Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.screenTitle}>Ask</Text>
          <View style={styles.headerActions}>
            {hasInteracted && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  setMessages([]);
                  useScanContextStore.getState().clearScanContext();
                  setIsRouteBannerDismissed(true);
                  handledInitialQueryRef.current = null;
                }}
                style={styles.newChatButton}
                activeOpacity={0.7}
                accessibilityLabel="Start new conversation"
                accessibilityRole="button"
              >
                <Text style={styles.newChatText}>New chat</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.profileButton}
              onPress={() => router.push('/profile')}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityLabel="Account and Settings"
              accessibilityRole="button"
            >
              <Icon name="person" size={18} color={colors.inkMuted} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.screenSubtitle}>
          Answers based on your routine, skin history, and what we've learned about you.
        </Text>
      </View>

      {/* Active Scan Context Banner (Store Full Context or Route Display Fallback) */}
      {displayScanBanner && (
        <View style={styles.scanBanner}>
          <View style={styles.scanBannerTextCol}>
            <Text style={styles.scanBannerLabel}>
              DISCUSSING SCANNED PRODUCT
            </Text>
            <Text style={styles.scanBannerTitle} numberOfLines={1}>
              {displayScanBanner.productName} • {displayScanBanner.verdictLabel}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              useScanContextStore.getState().clearScanContext();
              setIsRouteBannerDismissed(true);
            }}
            style={styles.scanBannerClose}
            accessibilityLabel="Dismiss product context"
          >
            <Icon name="close" size={16} color={colors.inkMuted} />
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Messages Feed or Empty State */}
        {!hasInteracted ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Icon name="ask" size={28} color={colors.brand} />
            </View>
            <Text style={styles.emptyHeadline}>Ask Derive</Text>
            <Text style={styles.emptyPrompt}>
              Ask about your routine, a reaction, or a product you're considering.
            </Text>

            {/* Dynamic Starter Pills */}
            <View style={styles.starterContainer}>
              {starterPrompts.map((prompt) => (
                <TouchableOpacity
                  key={prompt}
                  onPress={() => handleStarterPress(prompt)}
                  style={styles.starterChip}
                  activeOpacity={0.7}
                >
                  <Text style={styles.starterText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ChatBubble message={item} />}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: spacing.xl },
            ]}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
          />
        )}

        {/* Floating Liquid Glass Message Composer */}
        <View style={{ paddingBottom: insets.bottom + 95 }}>
          <GlassComposer
            onSendMessage={handleSendMessage}
            isLoading={loading}
          />
        </View>
      </KeyboardAvoidingView>
    </View>

  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.canvas,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newChatButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(23, 26, 24, 0.05)',
  },
  newChatText: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    fontWeight: typography.weights.medium,
  },
  scanBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  scanBannerTextCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  scanBannerLabel: {
    fontSize: typography.sizes.micro,
    color: colors.brand,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  scanBannerTitle: {
    fontSize: typography.sizes.caption,
    color: colors.ink,
    fontWeight: typography.weights.medium,
  },
  scanBannerClose: {
    padding: spacing.xs,
  },
  screenTitle: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.screenTitle,
    lineHeight: typography.lineHeights.screenTitle,
    color: colors.ink,
  },
  screenSubtitle: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    marginTop: 2,
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: radii.full,
    backgroundColor: colors.brandLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyHeadline: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.sectionTitle,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  emptyPrompt: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.inkMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  starterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  starterChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  starterText: {
    fontSize: typography.sizes.caption,
    color: colors.ink,
    fontWeight: typography.weights.medium,
  },
  listContent: {
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
});
