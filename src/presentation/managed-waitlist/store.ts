import { MANAGED_WAITLIST_OFFER_VERSION } from './offer.ts';

export type WaitlistStatus = 'joined' | 'withdrawn' | 'none';

export interface WaitlistRecord {
  status: WaitlistStatus;
  joinedAt?: string;
  offerVersion?: string;
}

export interface WaitlistStore {
  read(ownerKey: string): Promise<WaitlistRecord>;
  join(ownerKey: string): Promise<WaitlistRecord>;
  withdraw(ownerKey: string): Promise<WaitlistRecord>;
}

interface MemoryRow {
  status: 'joined' | 'withdrawn';
  joinedAt: string;
  offerVersion: string;
}

/** Explicit test fixture. The customer Plan screen must not use this as a live join. */
export function createMemoryWaitlistStore(now: () => string = () => new Date().toISOString()): WaitlistStore {
  const rows = new Map<string, MemoryRow>();
  const present = (row: MemoryRow | undefined): WaitlistRecord => row
    ? { status: row.status, joinedAt: row.joinedAt, offerVersion: row.offerVersion }
    : { status: 'none' };

  return {
    async read(ownerKey) {
      return present(rows.get(ownerKey));
    },
    async join(ownerKey) {
      const existing = rows.get(ownerKey);
      if (existing?.status === 'joined') return present(existing);
      const row: MemoryRow = {
        status: 'joined',
        joinedAt: now(),
        offerVersion: MANAGED_WAITLIST_OFFER_VERSION,
      };
      rows.set(ownerKey, row);
      return present(row);
    },
    async withdraw(ownerKey) {
      const existing = rows.get(ownerKey);
      if (!existing || existing.status === 'withdrawn') return present(existing);
      const row: MemoryRow = { ...existing, status: 'withdrawn' };
      rows.set(ownerKey, row);
      return present(row);
    },
  };
}

export function createManagedWaitlistController(deps: {
  store: WaitlistStore;
  track(event: 'managed_viewed' | 'managed_interest'): void;
}) {
  let viewedFor: string | undefined;

  return {
    async show(ownerId: string | null): Promise<WaitlistRecord> {
      const viewKey = ownerId ?? 'signed-out';
      if (viewedFor !== viewKey) {
        viewedFor = viewKey;
        try { deps.track('managed_viewed'); } catch { /* Measurement never blocks the offer. */ }
      }
      if (!ownerId) return { status: 'none' };
      return deps.store.read(ownerId);
    },
    async join(ownerId: string | null): Promise<WaitlistRecord> {
      if (!ownerId) throw new Error('waitlist unavailable');
      const next = await deps.store.join(ownerId);
      if (next.status === 'joined') {
        try { deps.track('managed_interest'); } catch { /* A failed measurement still leaves the join in place. */ }
      }
      return next;
    },
    async leave(ownerId: string | null): Promise<WaitlistRecord> {
      if (!ownerId) throw new Error('waitlist unavailable');
      return deps.store.withdraw(ownerId);
    },
  };
}

/** Drop a late read or join when the customer owner or request ticket has moved. */
export function acceptOwnerResult<T>(input: {
  ticket: number;
  currentTicket: number;
  expectedOwner: string | null;
  currentOwner: string | null;
  value: T;
}): T | null {
  if (input.ticket !== input.currentTicket || input.expectedOwner !== input.currentOwner) return null;
  return input.value;
}
