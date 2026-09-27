/** Explicit local-test target, never a hosted/free-access activation flag. */
export function normalizeDevelopmentLanUrl(value: string): string {
  const match = /^http:\/\/((?:[0-9]{1,3}\.){3}[0-9]{1,3}):54321\/?$/.exec(value.trim());
  if (!match) throw new Error('Development LAN testing requires a private IPv4 base URL on port 54321.');
  const host = match[1];
  const octets = host.split('.').map(Number);
  if (octets.some((octet, index) => octet > 255 || String(octet) !== host.split('.')[index])) {
    throw new Error('Development LAN testing requires a canonical private IPv4 address.');
  }
  const [first, second] = octets;
  const privateAddress = first === 10 || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168);
  if (!privateAddress) throw new Error('Development LAN testing requires a private IPv4 address.');
  return `http://${host}:54321/`;
}

export function isApprovedDevelopmentLanBackend(input: {
  supabaseUrl: string; developmentLanUrl?: string; buildFlavor: string; developmentRuntime: boolean;
}): boolean {
  if (input.buildFlavor !== 'development' || !input.developmentRuntime || !input.developmentLanUrl) return false;
  try {
    return normalizeDevelopmentLanUrl(input.supabaseUrl) === normalizeDevelopmentLanUrl(input.developmentLanUrl);
  } catch { return false; }
}
