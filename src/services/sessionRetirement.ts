/** Awaitable local cleanup hooks; registrations must revoke in-memory authority
 * synchronously before any durable cleanup begins. No session or user data lives
 * in this registry. Auth and account deletion keep their existing server gates. */
const retirements = new Set<() => Promise<void>>();
export function registerSessionRetirement(retire: () => Promise<void>): () => void {
  retirements.add(retire);
  return () => { retirements.delete(retire); };
}
export async function awaitSessionRetirement(): Promise<void> {
  const results = await Promise.allSettled([...retirements].map(retire => retire()));
  if (results.some(result => result.status === 'rejected')) throw Error('Local session cleanup incomplete');
}
