/** Presentation state only. The caller requests camera permission after a tap. */
export type CheckPermissionState = 'granted' | 'undetermined' | 'denied' | 'unknown';
export type CheckEntryState = 'camera' | 'landing' | 'denied' | 'search';

export function resolveCheckEntryState(input: {
  preview: boolean;
  searching: boolean;
  permission: CheckPermissionState;
}): CheckEntryState {
  if (input.searching) return 'search';
  if (input.preview) {
    if (input.permission === 'granted') return 'camera';
    return input.permission === 'denied' ? 'denied' : 'landing';
  }
  return input.permission === 'denied' ? 'denied' : 'camera';
}
