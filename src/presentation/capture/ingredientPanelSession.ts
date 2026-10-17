import type { IngredientPanelAttemptReceipt, IngredientPanelFailure } from '../../contracts/IngredientPanelAttempt.ts';
export type { IngredientPanelFailure } from '../../contracts/IngredientPanelAttempt.ts';
export type IngredientPanelState = Readonly<{
  attempts: number;
  phase: 'ready' | 'processing' | 'retake' | 'verified' | 'fallback';
  reason: IngredientPanelFailure | null;
}>;
export type IngredientPanelTicket = Readonly<{ attempt: number }>;

function scanUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, value => {
    const n = Math.floor(Math.random() * 16); return (value === 'x' ? n : (n & 3) | 8).toString(16);
  });
}
/** In-memory UX budget and stable server scope. Durable enforcement lives on the server. */
export function createIngredientPanelSession(createId: () => string = scanUuid) {
  let scanSessionId = createId();
  let state: IngredientPanelState = Object.freeze({ attempts: 0, phase: 'ready', reason: null });
  let generation = 0;
  let active: IngredientPanelTicket | null = null;
  let activeEvidenceKey: string | null = null;
  const submitted = new Set<string>();
  const listeners = new Set<() => void>();
  const update = (next: IngredientPanelState) => {
    state = Object.freeze(next);
    for (const listener of [...listeners]) listener();
  };
  const settle = (ticket: IngredientPanelTicket, reason: IngredientPanelFailure | null) => {
    if (ticket !== active) return false;
    active = null;
    activeEvidenceKey = null;
    update({ attempts: state.attempts, phase: reason === null ? 'verified' : state.attempts >= 2 ? 'fallback' : 'retake', reason });
    return true;
  };
  return {
    getState: () => state,
    getGeneration: () => generation,
    getScanSessionId: () => scanSessionId,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    begin(evidenceKey: string): IngredientPanelTicket {
      if (!evidenceKey.trim() || active || submitted.has(evidenceKey) || state.attempts >= 2 || state.phase === 'verified') {
        throw new IngredientPanelAttemptError();
      }
      submitted.add(evidenceKey);
      activeEvidenceKey = evidenceKey;
      active = Object.freeze({ attempt: state.attempts + 1 });
      const ticket = active;
      update({ attempts: ticket.attempt, phase: 'processing', reason: null });
      return ticket;
    },
    isCurrent: (ticket: IngredientPanelTicket) => ticket === active,
    settle,
    settleFromServer(ticket: IngredientPanelTicket, receipt: IngredientPanelAttemptReceipt) {
      if (ticket !== active || receipt.scanSessionId !== scanSessionId) return false;
      // A strict server receipt replaces the tentative local reservation. Busy
      // and duplicate replies did not charge this submission; allow its retry.
      if (activeEvidenceKey) submitted.delete(activeEvidenceKey);
      active = null; activeEvidenceKey = null;
      const attempts = receipt.attemptsUsed;
      update({ attempts, phase: attempts >= 2 ? 'fallback' : 'retake', reason: receipt.reason });
      return true;
    },
    cancel(ticket: IngredientPanelTicket) { return settle(ticket, 'unavailable'); },
    /** Only the owner of a deliberately new scan/account session calls this. Never on retake/remount. */
    startNewSession() {
      generation++;
      scanSessionId = createId();
      active = null; activeEvidenceKey = null;
      submitted.clear();
      update({ attempts: 0, phase: 'ready', reason: null });
    },
  };
}
export type IngredientPanelSession = ReturnType<typeof createIngredientPanelSession>;

/** No underlying provider errors or photo identifiers cross this boundary. */
export class IngredientPanelAttemptError extends Error {
  constructor() { super('ingredient_panel_not_ready'); this.name = 'IngredientPanelAttemptError'; }
}

/** Reasons must be observations; the generic branch never invents an optical defect. */
export function ingredientPanelGuidance(reason: IngredientPanelFailure | null): string {
  switch (reason) {
    case 'unreadable': return 'The ingredient text was not readable. Move closer, keep the text in focus and avoid glare.';
    case 'conflicting_evidence': return 'The photos disagree. Retake the ingredient panel on this same package from another angle.';
    case 'no_product_evidence': return 'The ingredient panel was not visible. Turn the package to its ingredient list.';
    case 'incomplete_panel': return 'Part of the panel is missing. Include the first and last lines and all ingredient sections.';
    case 'unavailable': return 'This attempt could not be completed. You can try one new photo of the full ingredient panel.';
    default: return 'We could not confirm the ingredients. Include the full ingredient panel, with its first and last lines in focus.';
  }
}
