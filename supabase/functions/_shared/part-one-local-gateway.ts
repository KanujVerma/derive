/** Origin-form requests only: credentials must never be proxied off loopback. */
export function localProductProxyDestination(target: string, backend: URL): URL {
  if (!target.startsWith('/') || target.startsWith('//') || target.includes('\\')) throw Error('invalid_local_target');
  const url = new URL(target, backend);
  if (url.origin !== backend.origin || url.username || url.password || !/^\/(auth|rest|functions|storage)\/v1\//.test(url.pathname)) throw Error('invalid_local_target');
  return url;
}
