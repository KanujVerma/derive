export interface P0dCleanupResult { error: unknown; data?: Array<{ id: string }> | null }
export interface P0dCleanupClient {
 auth: { admin: { deleteUser(id: string): Promise<{ error: unknown }>; getUserById(id: string): Promise<{ error: unknown }> } };
 from(table: string): { delete(): { eq(column: string, id: string): PromiseLike<P0dCleanupResult> }; select(columns: string): { eq(column: string, id: string): PromiseLike<P0dCleanupResult> } };
}
export interface P0dOwnedFixtures { product: string | null; variant: string | null; formula: string | null; identifier: string | null }
/** Cleanup is owned-only and best effort across all targets; any uncertainty prevents a success receipt. */
export async function cleanupP0dFixtures(admin: P0dCleanupClient, users: readonly (string | null)[], fixtures: P0dOwnedFixtures): Promise<void> {
 const owners = [...new Set(users.filter((id): id is string => Boolean(id)))];
 const catalog = ([['identifier', 'product_identifiers'], ['formula', 'product_formula_versions'], ['variant', 'product_variants'], ['product', 'products']] as const)
  .flatMap(([key, table]) => fixtures[key] ? [{ table, id: fixtures[key]! }] : []);
 const failures: string[] = [];
 const attempt = async (label: string, operation: () => Promise<boolean>) => {
  try { if (!await operation()) failures.push(label); } catch { failures.push(label); }
 };
 for (const id of owners) await attempt('user deletion', async () => !(await admin.auth.admin.deleteUser(id)).error);
 for (const { table, id } of catalog) await attempt(`${table} deletion`, async () => !(await admin.from(table).delete().eq('id', id)).error);
 for (const id of owners) await attempt('user absence', async () => {
  const { error } = await admin.auth.admin.getUserById(id);
  return Boolean(error && typeof error === 'object' && 'status' in error && error.status === 404);
 });
 for (const { table, id } of catalog) await attempt(`${table} absence`, async () => {
  const remaining = await admin.from(table).select('id').eq('id', id);
  return !remaining.error && Array.isArray(remaining.data) && remaining.data.length === 0;
 });
 if (failures.length) throw new Error(`P0-D cleanup could not be confirmed: ${failures.join(', ')}. No receipt written.`);
}
