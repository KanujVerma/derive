/** Synchronous gate: React rendering must not be the lock for camera/network work. */
export function createCaptureOperationGate() {
  let active: object | null = null;
  return {
    isBusy: () => active !== null,
    whenIdle(action: () => void): void {
      if (active === null) action();
    },
    cancel(): void { active = null; },
    async run<T>(work: (isCurrent: () => boolean) => Promise<T>): Promise<T | undefined> {
      if (active !== null) return undefined;
      const token = {};
      active = token;
      try { return await work(() => active === token); }
      finally { if (active === token) active = null; }
    },
  };
}
