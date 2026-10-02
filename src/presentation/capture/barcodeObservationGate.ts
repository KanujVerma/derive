/** Expo has observations, not a barcode-left event. A quiet interval permits a new observation. */
export function createBarcodeObservationGate(now: () => number = Date.now, absenceMs = 1400) {
  let accepted: string | null = null;
  let seen: string | null = null;
  let seenAt = 0;
  let blocked = false;
  return {
    observe(value: string, paused: boolean): boolean {
      const time = now();
      const previousSeenAt = seen === value ? seenAt : null;
      seen = value; seenAt = time;
      if (paused || blocked) return false;
      if (value === accepted && previousSeenAt !== null && time - previousSeenAt < absenceMs) return false;
      accepted = value; blocked = true;
      return true;
    },
    resume() {
      blocked = false;
      // Closing after a long result is not evidence that the barcode left the camera.
      if (seen === accepted) seenAt = now();
    },
    retry() { blocked = false; accepted = null; },
  };
}
