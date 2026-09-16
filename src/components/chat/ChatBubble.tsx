import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { ChatMessage } from '@/src/types/schema';
import { colors, radii, typography, spacing, shadows } from '@/src/constants/theme';
import { Badge } from '@/src/components/ui/Badge';
import { Icon } from '@/src/components/ui/Icon';

interface ChatBubbleProps {
  message: ChatMessage;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.sender === 'user';

  if (isUser) {
    return (
      <View style={[styles.container, styles.userContainer]}>
        {message.attachmentUri && (
          <Image
            source={{ uri: message.attachmentUri }}
            style={styles.attachedImage}
          />
        )}
        <View style={styles.userBubble}>
          <Text style={styles.userText}>{message.text}</Text>
        </View>
      </View>
    );
  }

  // Derive Response
  return (
    <View style={[styles.container, styles.deriveContainer]}>
      <View
        style={[
          styles.deriveCard,
          message.isSafetyEscalation && styles.safetyCard,
        ]}
      >
        {message.isSafetyEscalation && (
          <View style={styles.safetyHeader}>
            <Icon name="warning" size={16} color={colors.safetyAlert.text} />
            <Text style={styles.safetyHeaderText}>Medical Safety Guidance</Text>
          </View>
        )}

        {/* PRODUCT SCAN VERDICT BOX */}
        {message.productScan && (
          <View style={styles.scanBox}>
            <View style={styles.scanHeader}>
              <Badge
                label={message.productScan.verdictLabel}
                variant={
                  message.productScan.verdict === 'fits_plan'
                    ? 'keep'
                    : message.productScan.verdict === 'use_with_caution'
                    ? 'pause'
                    : 'replace'
                }
                size="small"
              />
              <Text style={styles.scannedProductName}>
                {message.productScan.brand} {message.productScan.productName}
              </Text>
            </View>

            {message.productScan.factsUsedToDecide &&
              message.productScan.factsUsedToDecide.length > 0 && (
                <View style={styles.decideFactors}>
                  <Text style={styles.decideFactorsTitle}>WHAT I USED TO DECIDE</Text>
                  {message.productScan.factsUsedToDecide.map((fact, i) => (
                    <View key={i} style={styles.factorRow}>
                      <Text style={styles.factorBullet}>·</Text>
                      <Text style={styles.factorText}>{fact}</Text>
                    </View>
                  ))}
                </View>
              )}
          </View>
        )}

        {/* DIRECT ANSWER FIRST */}
        {message.directAnswer ? (
          <Text style={styles.directAnswerText}>{message.directAnswer}</Text>
        ) : (
          <Text style={styles.deriveText}>{message.text}</Text>
        )}

        {/* EXPLANATION */}
        {message.whyExplanation && (
          <Text style={styles.explanationText}>{message.whyExplanation}</Text>
        )}

        {/* ACTION PILL */}
        {message.recommendedAction && (
          <View style={styles.actionRow}>
            <View style={styles.actionPill}>
              <Icon name="check" size={12} color={colors.brand} />
              <Text style={styles.actionPillText}>{message.recommendedAction}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  userBubble: {
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    maxWidth: '82%',
    ...shadows.subtle,
  },
  userText: {
    color: colors.inkInverse,
    fontSize: typography.sizes.bodyRegular,
    lineHeight: typography.lineHeights.bodyRegular,
  },
  attachedImage: {
    width: 140,
    height: 140,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  deriveContainer: {
    alignItems: 'flex-start',
  },
  deriveCard: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    maxWidth: '92%',
    gap: spacing.xs,
    ...shadows.subtle,
  },
  safetyCard: {
    borderColor: colors.safetyAlert.border,
    backgroundColor: colors.safetyAlert.bg,
  },
  safetyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  safetyHeaderText: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.bold,
    color: colors.safetyAlert.text,
  },
  directAnswerText: {
    fontSize: typography.sizes.bodyRegular,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    lineHeight: 22,
  },
  explanationText: {
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    lineHeight: 20,
  },
  deriveText: {
    fontSize: typography.sizes.bodyRegular,
    color: colors.ink,
    lineHeight: 22,
  },
  actionRow: {
    marginTop: 4,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.brandLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
  actionPillText: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.semibold,
    color: colors.brand,
  },
  scanBox: {
    backgroundColor: colors.canvas,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  scanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  scannedProductName: {
    fontSize: typography.sizes.caption,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  decideFactors: {
    marginTop: spacing.xxs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  decideFactorsTitle: {
    fontSize: typography.sizes.micro,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.8,
    color: colors.brand,
    marginBottom: 4,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 2,
  },
  factorBullet: {
    fontSize: 14,
    color: colors.brand,
    lineHeight: 18,
  },
  factorText: {
    flex: 1,
    fontSize: typography.sizes.caption,
    color: colors.inkMuted,
    lineHeight: 18,
  },
});
