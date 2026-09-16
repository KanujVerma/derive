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
import { ChatMessage } from '@/src/types/schema';
import { useRoutineStore } from '@/src/stores/routineStore';
import { askDeriveAdvisor } from '@/src/services/ai-workflows/chat-advisor';
import { ChatBubble } from '@/src/components/chat/ChatBubble';
import { GlassComposer } from '@/src/components/chat/GlassComposer';
import { Icon } from '@/src/components/ui/Icon';
import { analytics } from '@/src/services/analytics';
import { useRouter, useLocalSearchParams } from 'expo-router';

const STARTER_PROMPTS = [
  'Do I use Differin tonight?',
  'Can I add this vitamin C?',
  'Why this moisturizer?',
  'My cheeks feel dry.',
  'Scan a product',
];

export default function AskScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    initialQuery?: string;
    productName?: string;
    verdict?: string;
    reason?: string;
    whatItWouldChangeOrReplace?: string;
  }>();
  const { routine } = useRoutineStore();
  const flatListRef = useRef<FlatList>(null);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeScanContext, setActiveScanContext] = useState<{
    productName: string;
    verdict: string;
    reason?: string;
  } | null>(null);
  const handledInitialQueryRef = useRef<string | null>(null);

  const hasInteracted = messages.length > 0;

  React.useEffect(() => {
    if (params?.productName && params?.verdict) {
      setActiveScanContext({
        productName: params.productName,
        verdict: params.verdict,
        reason: params.reason,
      });
    }
    if (params?.initialQuery && handledInitialQueryRef.current !== params.initialQuery) {
      handledInitialQueryRef.current = params.initialQuery;
      handleSendMessage(params.initialQuery);
    }
  }, [params?.initialQuery, params?.productName, params?.verdict]);

  const handleSendMessage = async (text: string, imageUri?: string) => {
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
      const response = await askDeriveAdvisor(
        userMsg.text,
        routine,
        userMsg.attachmentUri
      );

      const deriveMsg: ChatMessage = {
        id: `drv_${Date.now()}`,
        conversationId: 'conv_1',
        sender: 'derive',
        text: response.directAnswer,
        directAnswer: response.directAnswer,
        whyExplanation: response.whyExplanation,
        recommendedAction: response.recommendedAction,
        isSafetyEscalation: response.isSafetyEscalation,
        productScan: response.productScan,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, deriveMsg]);
      try {
        await Haptics.notificationAsync(
          response.isSafetyEscalation
            ? Haptics.NotificationFeedbackType.Warning
            : Haptics.NotificationFeedbackType.Success
        );
      } catch {}
    } catch (e) {
      console.warn('Failed to get advisor response:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleStarterPress = (prompt: string) => {
    Haptics.selectionAsync();
    if (prompt === 'Scan a product') {
      analytics.track('product_scan_started', { entryPoint: 'starter_pill' });
      router.push('/(tabs)/scan');
    } else {
      handleSendMessage(prompt);
    }
  };

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
                  setActiveScanContext(null);
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

      {/* Active Scan Context Banner (if handed off from Scan tab) */}
      {activeScanContext && (
        <View style={styles.scanBanner}>
          <View style={styles.scanBannerTextCol}>
            <Text style={styles.scanBannerLabel}>
              DISCUSSING SCANNED PRODUCT
            </Text>
            <Text style={styles.scanBannerTitle} numberOfLines={1}>
              {activeScanContext.productName} • {activeScanContext.verdict.toUpperCase().replace(/_/g, ' ')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setActiveScanContext(null)}
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
              {STARTER_PROMPTS.map((prompt) => (
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
