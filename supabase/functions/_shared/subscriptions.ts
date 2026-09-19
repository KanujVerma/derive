/** Current Stripe truth for one customer's Founding Beta subscription. */
export interface MembershipSubscriptionSnapshot {
  id: string;
  created: number;
  status: string;
  items: { data: Array<{ price: { id: string } }> };
}

export function selectCurrentMembershipSubscription<T extends MembershipSubscriptionSnapshot>(
  subscriptions: T[],
  priceId: string,
): T | null {
  const matches = subscriptions.filter((subscription) =>
    subscription.items.data.some((item) => item.price.id === priceId)
  );
  const entitled = matches.filter((subscription) =>
    subscription.status === 'active' || subscription.status === 'trialing'
  );
  const candidates = entitled.length > 0 ? entitled : matches;
  return [...candidates].sort((a, b) =>
    b.created - a.created || b.id.localeCompare(a.id)
  )[0] ?? null;
}
