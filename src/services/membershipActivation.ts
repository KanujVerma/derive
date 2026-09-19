import type { CustomerBootstrapState } from '../domain/types.ts';

export type ActivationOutcome = 'active' | 'pending' | 'aborted';

/** Bounded reads of canonical membership truth after hosted Checkout returns. */
export async function pollForActiveMembership(options: {
  attempts: number;
  delaysMs: number[];
  read: () => Promise<CustomerBootstrapState | null>;
  wait: (milliseconds: number) => Promise<void>;
  isCurrent: () => boolean;
}): Promise<ActivationOutcome> {
  const { attempts, delaysMs, read, wait, isCurrent } = options;
  if (!Number.isInteger(attempts) || attempts < 1) throw new Error('attempts must be positive');
  for (let index = 0; index < attempts; index += 1) {
    if (!isCurrent()) return 'aborted';
    let state: CustomerBootstrapState | null = null;
    try {
      state = await read();
    } catch {
      // A transient read failure is not evidence of membership activation.
    }
    if (!isCurrent()) return 'aborted';
    if (state?.membershipStatus === 'active') return 'active';
    if (index < attempts - 1) await wait(delaysMs[index] ?? 0);
  }
  return 'pending';
}
