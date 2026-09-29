import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { managedOffer } from '../../presentation/managed-waitlist/offer.ts';
import {
  acceptOwnerResult,
  createManagedWaitlistController,
  type WaitlistRecord,
} from '../../presentation/managed-waitlist/store.ts';
import { createProductAnalytics } from '../../presentation/product-analytics/index.ts';
import { createLiveWaitlistStore } from '../../services/managedWaitlistStore.ts';
import { useAuthStore } from '../../stores/authStore.ts';
import { colors, layout, spacing, typography } from '../../constants/theme';
import { RootShellHeader } from '../shell/RootShellHeader';
import { GroupedSection } from '../ui/GroupedSection';
import { Button } from '../ui/Button';

/** Free Plan offer. Active managed routines stay on the legacy Plan screen. */
export function PreviewPlanShell() {
  const insets = useSafeAreaInsets();
  const ownerId = useAuthStore((state) => state.sessionUserId);
  const controller = useRef(createManagedWaitlistController({
    store: createLiveWaitlistStore(),
    track(event) {
      createProductAnalytics().track(event, { source: 'plan' });
    },
  })).current;
  const [record, setRecord] = useState<WaitlistRecord>({ status: 'none' });
  const [working, setWorking] = useState<'join' | 'leave' | null>(null);
  const [failed, setFailed] = useState(false);
  const ticket = useRef(0);
  const ownerRef = useRef(ownerId);
  ownerRef.current = ownerId;

  useEffect(() => {
    const currentTicket = ++ticket.current;
    const expectedOwner = ownerId;
    setRecord({ status: 'none' });
    setFailed(false);
    setWorking(null);
    void controller.show(expectedOwner).then((next) => {
      const accepted = acceptOwnerResult({
        ticket: currentTicket,
        currentTicket: ticket.current,
        expectedOwner,
        currentOwner: ownerRef.current,
        value: next,
      });
      if (accepted) setRecord(accepted);
    }).catch(() => {
      if (currentTicket === ticket.current) setFailed(true);
    });
  }, [controller, ownerId]);

  const run = (action: 'join' | 'leave') => {
    const currentTicket = ticket.current;
    const expectedOwner = ownerId;
    setWorking(action);
    setFailed(false);
    const request = action === 'join' ? controller.join(expectedOwner) : controller.leave(expectedOwner);
    void request.then((next) => {
      const accepted = acceptOwnerResult({
        ticket: currentTicket,
        currentTicket: ticket.current,
        expectedOwner,
        currentOwner: ownerRef.current,
        value: next,
      });
      if (!accepted) return;
      setRecord(accepted);
      setWorking(null);
    }).catch(() => {
      if (currentTicket !== ticket.current) return;
      setWorking(null);
      setFailed(true);
    });
  };

  const joined = record.status === 'joined';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <RootShellHeader title="Plan" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 110 }]}>
        <Text style={styles.name}>{managedOffer.name}</Text>
        <Text style={styles.tagline}>{managedOffer.tagline}</Text>
        <Text style={styles.price}>{managedOffer.price}</Text>
        <Text style={styles.commercial}>{managedOffer.commercialTerm}</Text>
        <Text style={styles.explanation}>{managedOffer.explanation}</Text>
        <GroupedSection>
          {managedOffer.benefits.map((benefit) => (
            <View key={benefit} style={styles.row}>
              <Text style={styles.rowText}>{benefit}</Text>
            </View>
          ))}
        </GroupedSection>
        {joined ? (
          <View style={styles.action}>
            <Text style={styles.joinedTitle}>{managedOffer.joinedTitle}</Text>
            <Text style={styles.note}>{managedOffer.joinedNote}</Text>
            <Button
              label={managedOffer.leaveLabel}
              variant="ghost"
              size="medium"
              loading={working === 'leave'}
              disabled={working !== null}
              onPress={() => run('leave')}
            />
          </View>
        ) : (
          <View style={styles.action}>
            <Button
              label={managedOffer.joinLabel}
              variant="brand"
              loading={working === 'join'}
              disabled={working !== null}
              onPress={() => run('join')}
            />
            <Text style={styles.note}>{managedOffer.joinNote}</Text>
          </View>
        )}
        {failed ? <Text style={styles.error}>{managedOffer.error}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: layout.gutter, paddingTop: spacing.lg },
  name: { color: colors.ink, fontSize: typography.sizes.sectionTitle, fontWeight: typography.weights.semibold },
  tagline: { color: colors.ink, fontSize: typography.sizes.bodyLarge, marginTop: spacing.xxs },
  price: { color: colors.brand, fontSize: typography.sizes.bodyLarge, fontWeight: typography.weights.semibold, marginTop: spacing.md },
  commercial: { color: colors.inkMuted, fontSize: typography.sizes.caption, marginTop: spacing.xxs },
  explanation: {
    color: colors.inkMuted,
    fontSize: typography.sizes.bodyRegular,
    lineHeight: typography.lineHeights.bodyRegular,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  row: { minHeight: 54, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  rowText: { color: colors.ink, fontSize: typography.sizes.bodyRegular, lineHeight: typography.lineHeights.bodyRegular },
  action: { marginTop: spacing.xl, gap: spacing.sm },
  joinedTitle: { color: colors.ink, fontSize: typography.sizes.bodyLarge, fontWeight: typography.weights.semibold },
  note: { color: colors.inkMuted, fontSize: typography.sizes.caption, lineHeight: typography.lineHeights.caption },
  error: { color: colors.inkMuted, fontSize: typography.sizes.caption, marginTop: spacing.sm },
});
