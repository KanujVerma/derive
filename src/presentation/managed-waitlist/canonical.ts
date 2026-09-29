import type { WaitlistRecord, WaitlistStore } from './store.ts';

export class WaitlistUnavailable extends Error {
  constructor() {
    super('waitlist unavailable');
    this.name = 'WaitlistUnavailable';
  }
}

export function parseWaitlistRecord(value: unknown): WaitlistRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new WaitlistUnavailable();
  }
  const status = Reflect.get(value, 'status');
  if (status === 'none') return { status: 'none' };
  if (status !== 'joined' && status !== 'withdrawn') throw new WaitlistUnavailable();
  const joinedAt = Reflect.get(value, 'joinedAt');
  const offerVersion = Reflect.get(value, 'offerVersion');
  if (typeof joinedAt !== 'string' || typeof offerVersion !== 'string') throw new WaitlistUnavailable();
  return { status, joinedAt, offerVersion };
}

/**
 * Canonical waitlist access. The RPC runs only when the live Supabase session
 * user is exactly the owner the screen is showing.
 */
export function createCanonicalWaitlistStore(deps: {
  getSession(): Promise<{ userId: string } | null>;
  read(): Promise<unknown>;
  join(): Promise<unknown>;
  withdraw(): Promise<unknown>;
}): WaitlistStore {
  async function requireSession(ownerKey: string): Promise<void> {
    const session = await deps.getSession();
    if (!session || session.userId !== ownerKey) throw new WaitlistUnavailable();
  }

  return {
    async read(ownerKey) {
      const session = await deps.getSession();
      if (!session) return { status: 'none' };
      if (session.userId !== ownerKey) throw new WaitlistUnavailable();
      return parseWaitlistRecord(await deps.read());
    },
    async join(ownerKey) {
      await requireSession(ownerKey);
      return parseWaitlistRecord(await deps.join());
    },
    async withdraw(ownerKey) {
      await requireSession(ownerKey);
      return parseWaitlistRecord(await deps.withdraw());
    },
  };
}
