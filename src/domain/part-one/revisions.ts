import { DeclarationSchema, ItemSnapshotSchema } from '../../contracts/PartOne.ts';
import type { Declaration, ItemSnapshot } from '../../contracts/PartOne.ts';

type ImmutableRecord = Declaration | ItemSnapshot;
function immutable<T>(input: T): T {
  const copied = structuredClone(input);
  const freeze = (value: unknown): void => { if (value && typeof value === 'object') { for (const member of Object.values(value)) freeze(member); Object.freeze(value); } };
  freeze(copied);
  return copied;
}
/** Immutable history is independent of current result pointers and asset freshness. */
export function createEvidenceRevisionLedger() {
  const declarations = new Map<string, Declaration>(), snapshots = new Map<string, ItemSnapshot>();
  const append = <T extends ImmutableRecord>(record: T, map: Map<string, T>, key: string, group: (candidate: T) => boolean): T => {
    const previous = map.get(key);
    if (previous) { if (JSON.stringify(previous) !== JSON.stringify(record)) throw new Error('immutable_revision_conflict'); return previous; }
    const related = [...map.values()].filter(group);
    if (related.some(old => old.revision >= record.revision)) throw new Error('non_monotonic_revision');
    if (record.supersedesId) { const predecessor = map.get(record.supersedesId); if (!predecessor || !group(predecessor)) throw new Error('unknown_superseded_revision'); }
    const saved = immutable(record); map.set(key, saved); return saved;
  };
  return {
    appendDeclaration(input: Declaration): Declaration {
      const record = DeclarationSchema.parse(input);
      return append(record, declarations, record.declarationId, old => old.itemId === record.itemId && old.scope === record.scope && old.ownerId === record.ownerId && old.packageObservationId === record.packageObservationId);
    },
    appendSnapshot(input: ItemSnapshot): ItemSnapshot {
      const record = ItemSnapshotSchema.parse(input);
      return append(record, snapshots, record.snapshotId, old => old.itemId === record.itemId && old.scope === record.scope);
    },
    getDeclaration(id: string): Declaration | null { return declarations.get(id) ?? null; },
    getSnapshot(id: string): ItemSnapshot | null { return snapshots.get(id) ?? null; },
    /** A save records exact existing IDs. A new observation cannot replace these IDs. */
    snapshotAtSave(snapshotId: string, declarationId: string | null, ownerId: string): { snapshotAtSaveId: string; selectedDeclarationId: string | null; snapshot: ItemSnapshot; declaration: Declaration | null } {
      const snapshot = snapshots.get(snapshotId), declaration = declarationId === null ? null : declarations.get(declarationId);
      if (!snapshot || declarationId !== null && !declaration) throw new Error('unknown_saved_revision');
      if (declaration && (declaration.snapshotId !== snapshot.snapshotId || declaration.itemId !== snapshot.itemId || declaration.scope === 'private_package' && declaration.ownerId !== ownerId)) throw new Error('saved_binding_conflict');
      return immutable({ snapshotAtSaveId: snapshotId, selectedDeclarationId: declarationId, snapshot, declaration: declaration ?? null });
    },
  };
}
export type IndependentImageObservation = { evidenceId: string; role: 'front' | 'ingredients'; sourceRevision: number; observedAt: string; language: string | null; crop: number[]; rotation: number };
/** Deliberately no declaration write: a new front photo establishes only image freshness. */
export function appendImageObservation(history: readonly IndependentImageObservation[], next: IndependentImageObservation): readonly IndependentImageObservation[] {
  if (history.some(old => old.evidenceId === next.evidenceId && JSON.stringify(old) !== JSON.stringify(next))) throw new Error('immutable_image_conflict');
  if (history.some(old => old.evidenceId === next.evidenceId)) return history;
  return immutable([...history, next]);
}
