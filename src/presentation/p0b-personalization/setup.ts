import type { CatalogProductSummary } from '../../contracts/ProductCatalog.ts';
import type { ExperienceDraft, ExperienceKind } from './experience.ts';
import { createExperienceDraft } from './experience.ts';
import type { RoutineItemDraft, RoutineReference } from './draft.ts';

/** Customer words for a product that did not agree with their skin. Not new storage kinds. */
export type SetupNotice = 'irritated' | 'broke_out' | 'too_drying' | 'didnt_help' | 'liked';

export interface SetupBundle {
  ownerId: string | null;
  products: RoutineItemDraft[];
  experiences: ExperienceDraft[];
  /** User-reported raw context. Not a profile, allergy, diagnosis, or product fact. */
  additionalNote: string | null;
}

export function createSetupBundle(ownerId: string | null = null): SetupBundle {
  return { ownerId, products: [], experiences: [], additionalNote: null };
}

export function replaceSetupOwner(bundle: SetupBundle, ownerId: string | null): SetupBundle {
  return bundle.ownerId === ownerId ? bundle : createSetupBundle(ownerId);
}

export function catalogFamilyReference(product: Pick<CatalogProductSummary, 'productId' | 'brand' | 'name'>): Extract<RoutineReference, { kind: 'catalog' }> {
  return { kind: 'catalog', label: `${product.brand} ${product.name}`.trim(), productId: product.productId, variantId: null, formulaVersionId: null };
}

export function manualUnverifiedReference(name: string): Extract<RoutineReference, { kind: 'manual' }> {
  return { kind: 'manual', label: name.trim(), verification: 'unverified' };
}

/** Only for a product the customer added while answering what they use now. */
export function currentUseItem(id: string, reference: RoutineReference): RoutineItemDraft {
  return { id, reference, status: 'current', timing: 'unknown', frequency: { kind: 'unknown' }, startedOn: null, stoppedOn: null, duration: null };
}

export function addCurrentProduct(bundle: SetupBundle, item: RoutineItemDraft): SetupBundle {
  if (!item.reference.label.trim() || item.status !== 'current') return bundle;
  if (bundle.products.some(product => product.id === item.id || sameReference(product.reference, item.reference))) return bundle;
  return { ...bundle, products: [...bundle.products, item] };
}

export function removeSetupProduct(bundle: SetupBundle, id: string): SetupBundle {
  return { ...bundle, products: bundle.products.filter(product => product.id !== id) };
}

/**
 * Broke out and too drying stay `reacted` reports. The extra words are symptoms the customer noticed,
 * not a new outcome kind and not an ingredient cause. The current evaluator does not read those symptom strings.
 */
export function experienceFromNotice(id: string, reference: RoutineReference, notice: SetupNotice): ExperienceDraft {
  const base = createExperienceDraft(id, { ...createExperienceDraft(id), reference });
  const mapped: Record<SetupNotice, { kind: ExperienceKind; symptoms: string[] }> = {
    irritated: { kind: 'reacted', symptoms: [] },
    broke_out: { kind: 'reacted', symptoms: ['Breakouts'] },
    too_drying: { kind: 'reacted', symptoms: ['Dryness'] },
    didnt_help: { kind: 'ineffective', symptoms: [] },
    liked: { kind: 'liked', symptoms: [] },
  };
  return { ...base, kind: mapped[notice].kind, symptoms: mapped[notice].symptoms };
}

export function addSetupExperience(bundle: SetupBundle, experience: ExperienceDraft): SetupBundle {
  if (!experience.kind || !experience.reference.label.trim()) return bundle;
  if (bundle.experiences.some(item => item.id === experience.id)) return bundle;
  return { ...bundle, experiences: [...bundle.experiences, experience] };
}

export function removeSetupExperience(bundle: SetupBundle, id: string): SetupBundle {
  return { ...bundle, experiences: bundle.experiences.filter(item => item.id !== id) };
}

export function setAdditionalNote(bundle: SetupBundle, text: string): SetupBundle {
  const trimmed = text.trim();
  return { ...bundle, additionalNote: trimmed ? trimmed : null };
}

function sameReference(left: RoutineReference, right: RoutineReference): boolean {
  if (left.kind === 'catalog' && right.kind === 'catalog') return left.productId === right.productId;
  if (left.kind === 'manual' && right.kind === 'manual') return left.label.trim().toLowerCase() === right.label.trim().toLowerCase();
  return false;
}
