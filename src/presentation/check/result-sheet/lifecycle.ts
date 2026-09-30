export type CheckResultOrigin =
  | { kind: 'search'; query: string; scrollOffset: number; selectedProductId: string | null }
  | { kind: 'link'; value: string; scrollOffset: number }
  | { kind: 'camera'; sessionId: string }
  | { kind: 'history'; recordId: string };
export interface CheckResultOperation { readonly generation: number; readonly ownerId: string | null; readonly requestId: string }
export interface CheckResultActionBinding { snapshotId: string; caseRevision: number; formulaVersionId: string | null; contextRevision: number | null }

/** Host-owned transient lifecycle only. It does not save history, control detection or navigate. */
export function createCheckResultLifecycle() {
  let generation = 0;
  let current: { operation: CheckResultOperation; origin: CheckResultOrigin; binding: CheckResultActionBinding | null } | null = null;
  const canPublish = (operation: CheckResultOperation, ownerId: string | null): boolean => Boolean(current
    && current.operation.generation === operation.generation && generation === operation.generation
    && current.operation.ownerId === ownerId && operation.ownerId === ownerId
    && operation.requestId.length > 0 && current.operation.requestId === operation.requestId);
  return {
    begin(ownerId: string | null, origin: CheckResultOrigin, requestId: string): CheckResultOperation {
      const operation = Object.freeze({ generation: ++generation, ownerId, requestId });
      current = { operation, origin: { ...origin }, binding: null };
      return operation;
    },
    canPublish,
    bind(operation: CheckResultOperation, ownerId: string | null, binding: CheckResultActionBinding): boolean {
      if (!canPublish(operation, ownerId) || !current) return false;
      current.binding = { ...binding };
      return true;
    },
    canAct(operation: CheckResultOperation, ownerId: string | null, binding: CheckResultActionBinding): boolean {
      if (!canPublish(operation, ownerId) || !current?.binding) return false;
      const expected = current.binding;
      return expected.snapshotId === binding.snapshotId && expected.caseRevision === binding.caseRevision
        && expected.formulaVersionId === binding.formulaVersionId && expected.contextRevision === binding.contextRevision;
    },
    dismiss(operation: CheckResultOperation, ownerId: string | null): CheckResultOrigin | null {
      if (!canPublish(operation, ownerId) || !current) return null;
      const origin = { ...current.origin };
      generation++;
      current = null;
      return origin;
    },
    invalidate() { generation++; current = null; },
  };
}
