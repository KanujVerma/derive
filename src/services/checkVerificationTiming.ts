/** Opt-in local verification only: no product text, profile, credentials or
 * identifiers leave the app. These console timings are not analytics. */
type Kind = 'name' | 'barcode';
const runs = new Map<Kind, { sequence: number; started: number; seen: Set<string>; binding?: string }>();
let sequence = 0;
const enabled = () => typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_CHECK_TIMING_EVALUATION === 'true';
export function beginCheckVerificationTiming(kind: Kind, binding?: string) {
  if (!enabled()) return;
  const run = { sequence: ++sequence, started: performance.now(), seen: new Set<string>(), binding: binding ?? String(sequence) };
  runs.set(kind, run);
  console.info('CHECK_VERIFICATION_TIMING', JSON.stringify({ sequence: run.sequence, kind, stage: 'submit', elapsedMs: 0 }));
  return run.binding;
}
export function markCheckVerificationTiming(kind: Kind, stage: string, binding: string = '') {
  if (!enabled()) return;
  const run = runs.get(kind), key = `${stage}:${binding}`;
  if (!run || run.binding && run.binding !== binding || run.seen.has(key)) return;
  run.seen.add(key);
  console.info('CHECK_VERIFICATION_TIMING', JSON.stringify({ sequence: run.sequence, kind, stage, elapsedMs: Math.round(performance.now() - run.started) }));
}

/** Retire measurements when their UI intent or owner is no longer current. */
export function endCheckVerificationTiming(kind?: Kind) {
  if (kind) runs.delete(kind); else runs.clear();
}
