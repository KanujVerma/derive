import { supabase } from './supabase.ts';
import { resetCustomerSessionData } from './sessionReset.ts';
import { getCustomerErrorMessage } from '../utils/customerErrors.ts';

export const ACCOUNT_DELETION_FUNCTION = 'delete-customer-account';
export const ACCOUNT_DELETION_CONFIRMATION = 'DELETE_MY_DERIVE_ACCOUNT';

export interface AccountDeletionInvoker {
  functions: {
    invoke(
      name: string,
      options: { body: { confirmation: string } },
    ): Promise<{ data: unknown; error: { message?: string; name?: string } | null }>;
  };
  auth: {
    signOut(options?: { scope?: 'local' | 'global' | 'others' }): Promise<{ error: unknown }>;
  };
}

function deletionFailed(): { success: false; error: string } {
  return {
    success: false,
    error: getCustomerErrorMessage('auth_delete_account'),
  };
}

/**
 * Deletes the authenticated customer through the existing server contract,
 * then clears the local session only after the server confirms deletion.
 */
export async function deleteCurrentAccount(
  client: AccountDeletionInvoker | null = supabase,
): Promise<{ success: boolean; error?: string }> {
  if (!client) return deletionFailed();

  let data: unknown;
  let error: { message?: string; name?: string } | null = null;
  try {
    const result = await client.functions.invoke(ACCOUNT_DELETION_FUNCTION, {
      body: { confirmation: ACCOUNT_DELETION_CONFIRMATION },
    });
    data = result.data;
    error = result.error;
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : 'unknown_error';
    console.warn('deleteCurrentAccount exception:', name);
    return deletionFailed();
  }

  const deleted = Boolean(
    data && typeof data === 'object' && (data as { deleted?: unknown }).deleted === true,
  );
  if (error || !deleted) {
    console.warn('deleteCurrentAccount backend error:', error?.name || 'deletion_unconfirmed');
    return deletionFailed();
  }

  try {
    await client.auth.signOut({ scope: 'local' });
  } catch (err: unknown) {
    const name = err instanceof Error ? err.name : 'unknown_error';
    console.warn('deleteCurrentAccount local sign-out exception:', name);
  }

  resetCustomerSessionData();
  return { success: true };
}
