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

/** Session-local stand-in used when no authenticated owner is available. */
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
  const ownerKey = (ownerId: string | null) => ownerId ?? 'preview';

  return {
    async show(ownerId: string | null): Promise<WaitlistRecord> {
      const key = ownerKey(ownerId);
      if (viewedFor !== key) {
        viewedFor = key;
        try { deps.track('managed_viewed'); } catch { /* Measurement never blocks the offer. */ }
      }
      return deps.store.read(key);
    },
    async join(ownerId: string | null): Promise<WaitlistRecord> {
      const next = await deps.store.join(ownerKey(ownerId));
      if (next.status === 'joined') {
        try { deps.track('managed_interest'); } catch { /* A failed measurement still leaves the join in place. */ }
      }
      return next;
    },
    async leave(ownerId: string | null): Promise<WaitlistRecord> {
      return deps.store.withdraw(ownerKey(ownerId));
    },
  };
}
