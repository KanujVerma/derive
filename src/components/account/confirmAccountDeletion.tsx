import { Alert, Platform } from 'react-native';
import { deleteCurrentAccount } from '../../services/accountDeletion';
import { getCustomerErrorMessage } from '../../utils/customerErrors';

const CONFIRM_TITLE = 'Delete your account?';
const CONFIRM_BODY = "This permanently deletes your Derive account, onboarding information, stored photos, routine history, and other account data. This can't be undone.";

export async function confirmAndDeleteAccount(): Promise<boolean> {
  const confirmed = await new Promise<boolean>((resolve) => {
    if (Platform.OS === 'web') {
      resolve(window.confirm(`${CONFIRM_TITLE}\n\n${CONFIRM_BODY}`));
      return;
    }
    Alert.alert(CONFIRM_TITLE, CONFIRM_BODY, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Delete Account', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
  if (!confirmed) return false;
  const result = await deleteCurrentAccount();
  if (result.success) return true;
  const message = result.error || getCustomerErrorMessage('auth_delete_account');
  if (Platform.OS === 'web') window.alert(message);
  else Alert.alert('Delete Account', message, [{ text: 'OK' }]);
  return false;
}
