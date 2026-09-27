export interface OwnedCleanupStep { label: string; run: () => Promise<void> }
/** Attempt all owned cleanup and independent verification, then fail safely. */
export async function attemptOwnedCleanup(deletions: readonly OwnedCleanupStep[], checks: readonly OwnedCleanupStep[]): Promise<void> {
  const failed: string[] = [];
  for (const step of [...deletions, ...checks]) {
    try { await step.run(); } catch { failed.push(step.label); }
  }
  if (failed.length) throw new Error(`Owned acceptance cleanup failed: ${failed.join('; ')}`);
}
