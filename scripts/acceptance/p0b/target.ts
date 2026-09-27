/** Local acceptance owns disposable writes, so target drift must fail before Auth. */
export function assertDisposableLocalTarget(apiUrl: unknown): void {
  if (apiUrl !== 'http://127.0.0.1:54321') {
    throw new Error('Refuse writes outside the disposable local Supabase target');
  }
}
