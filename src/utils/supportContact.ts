/** Public contact is shown only when a founder has explicitly configured it. */
export function resolveSupportEmail(raw: string | null | undefined): string | null {
  const email = raw?.trim() ?? '';
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email) ? email : null;
}
