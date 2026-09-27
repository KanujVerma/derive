/** Native/browser failures stay customer-visible and retryable; raw transport details stay private. */
export async function openCustomerAccountLink(label: 'Privacy' | 'Support', url: string, links: { openURL: (url: string) => Promise<unknown> }): Promise<{ error: string | null }> {
 try {
  if (!url.trim()) throw new Error('Link unavailable');
  await links.openURL(url);
  return { error: null };
 } catch {
  return { error: `${label} could not be opened. Check your connection and try again.` };
 }
}
