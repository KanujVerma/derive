import type { CatalogProductSummary } from '../../contracts/ProductCatalog.ts';
import type { ExperienceDraft, ExperienceKind } from './experience.ts';
import { createExperienceDraft } from './experience.ts';
import type { RoutineItemDraft, RoutineReference } from './draft.ts';

/** Customer words for a product that did not agree with their skin. Not new storage kinds. */
export type SetupNotice = 'irritated' | 'broke_out' | 'too_drying' | 'didnt_help' | 'liked';

export type ProductOutcome = 'helpful' | 'not_helping' | 'too_heavy' | 'stung' | 'broke_out' | 'too_drying' | 'not_sure';
export const productOutcomeLabels: Record<ProductOutcome, string> = {
  helpful: 'Helping', not_helping: 'Not helping', too_heavy: 'Too heavy', stung: 'Stung',
  broke_out: 'Broke out', too_drying: 'Too drying', not_sure: 'Not sure',
};
export type CurrentProductFeedback = ProductOutcome | 'still_dry' | 'comfortable';
export const currentFeedbackLabels: Record<CurrentProductFeedback, string> = { ...productOutcomeLabels, helpful: 'Works well', still_dry: 'Still feels dry', comfortable:'Feels comfortable' };
/** Category comes from an explicit catalog fact, never a product name or manual label. */
export function currentFeedbackChoices(category?: string): Array<[CurrentProductFeedback, string]> {
  const values: CurrentProductFeedback[] = category === 'moisturizer'
    ? ['helpful', 'still_dry', 'too_heavy', 'comfortable', 'stung', 'broke_out', 'too_drying', 'not_sure']
    : ['helpful', 'not_helping', 'too_heavy', 'comfortable', 'stung', 'broke_out', 'too_drying', 'not_sure'];
  return values.map(value => [value, currentFeedbackLabels[value]]);
}
export type SetupAnswerState = 'unanswered' | 'none' | 'unknown' | 'reported';
/** Local collection only. These extra words have no persistence/evaluator contract yet. */
export interface SetupPreviewContext {
  currentProducts: SetupAnswerState;
  pastProducts: SetupAnswerState;
  currentOutcomes: Record<string, ProductOutcome>;
  /** Optional multi-fact feedback; old single outcomes remain readable without reinterpretation. */
  currentFeedback?: Record<string, CurrentProductFeedback[]>;
  catalogCategories?: Record<string, string>;
  pastReports: Array<{ id: string; reference: RoutineReference; outcome: ProductOutcome }>;
}
export interface SetupBundle {
  ownerId: string | null;
  products: RoutineItemDraft[];
  reportedUse?: Record<string, Pick<import('../../contracts/PersonalContextV2.ts').ReportedUseContextV2, 'reportedPurpose' | 'applicationSite' | 'useForm'>>;
  experiences: ExperienceDraft[];
  /** Explicitly confirmed choices; never inferred from feedback or raw notes. */
  preferences?: import('../../contracts/PersonalContextV2.ts').ConfirmedPreference[];
  /** User-reported raw context. Not a profile, allergy, diagnosis, or product fact. */
  additionalNote: string | null;
  previewOnly: SetupPreviewContext;
}

export function createSetupBundle(ownerId: string | null = null): SetupBundle {
  return { ownerId, products: [], experiences: [], additionalNote: null, previewOnly: { currentProducts: 'unanswered', pastProducts: 'unanswered', currentOutcomes: {}, pastReports: [] } };
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

export function addCurrentProduct(bundle: SetupBundle, item: RoutineItemDraft, catalog?: CatalogProductSummary): SetupBundle {
  if (!item.reference.label.trim() || item.status !== 'current') return bundle;
  if (bundle.products.some(product => product.id === item.id || sameReference(product.reference, item.reference))) return bundle;
  const category = item.reference.kind === 'catalog' && catalog?.isCatalogStandard === true && catalog.productId === item.reference.productId ? catalog.category : undefined;
  return { ...bundle, products: [...bundle.products, item], previewOnly: { ...bundle.previewOnly, currentProducts: 'reported', catalogCategories: { ...bundle.previewOnly.catalogCategories, ...(category ? { [item.id]: category } : {}) } } };
}

export function removeSetupProduct(bundle: SetupBundle, id: string): SetupBundle {
  const currentOutcomes = { ...bundle.previewOnly.currentOutcomes }; delete currentOutcomes[id];
  const currentFeedback = { ...bundle.previewOnly.currentFeedback }; delete currentFeedback[id];
  const catalogCategories = { ...bundle.previewOnly.catalogCategories }; delete catalogCategories[id];
  const products = bundle.products.filter(product => product.id !== id);
  return { ...bundle, products, previewOnly: { ...bundle.previewOnly, currentOutcomes, currentFeedback, catalogCategories, currentProducts: products.length ? 'reported' : 'unanswered' } };
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
  if (left.kind === 'catalog' && right.kind === 'catalog') return left.productId === right.productId && left.variantId === right.variantId && left.formulaVersionId === right.formulaVersionId;
  if (left.kind === 'manual' && right.kind === 'manual') return left.label.trim().toLowerCase() === right.label.trim().toLowerCase();
  return false;
}

export function setCurrentOutcome(bundle: SetupBundle, id: string, outcome: ProductOutcome): SetupBundle {
  if (!bundle.products.some(item => item.id === id)) return bundle;
  return { ...bundle, previewOnly: { ...bundle.previewOnly, currentOutcomes: { ...bundle.previewOnly.currentOutcomes, [id]: outcome } } };
}
export function currentProductFeedback(bundle: SetupBundle, id: string): CurrentProductFeedback[] {
  return bundle.previewOnly.currentFeedback?.[id] ?? (bundle.previewOnly.currentOutcomes[id] ? [bundle.previewOnly.currentOutcomes[id]] : []);
}
export function toggleCurrentFeedback(bundle: SetupBundle, id: string, value: CurrentProductFeedback): SetupBundle {
  if (!bundle.products.some(item => item.id === id)) return bundle;
  const old = currentProductFeedback(bundle, id);
  // Uncertainty is an answer state; specific reports can coexist (including works well + too heavy).
  const next = old.includes(value) ? old.filter(item => item !== value) : value === 'not_sure' ? ['not_sure'] as CurrentProductFeedback[] : [...old.filter(item => item !== 'not_sure'&&!(value==='comfortable'&&item==='too_heavy')&&!(value==='too_heavy'&&item==='comfortable')), value];
  return { ...bundle, previewOnly: { ...bundle.previewOnly, currentFeedback: { ...bundle.previewOnly.currentFeedback, [id]: next } } };
}
export function clearCurrentFeedback(bundle: SetupBundle, id: string): SetupBundle {
  if (!bundle.products.some(item => item.id === id)) return bundle;
  return { ...bundle, previewOnly: { ...bundle.previewOnly, currentFeedback: { ...bundle.previewOnly.currentFeedback, [id]: [] } } };
}
export function setSetupAnswer(bundle: SetupBundle, field: 'currentProducts' | 'pastProducts', value: 'none' | 'unknown'): SetupBundle {
  // An explicit answer cannot silently erase products or reports.
  if (field === 'currentProducts' ? bundle.products.length : bundle.previewOnly.pastReports.length) return bundle;
  return { ...bundle, previewOnly: { ...bundle.previewOnly, [field]: value } };
}
export function addPastOutcome(bundle: SetupBundle, id: string, reference: RoutineReference, outcome: ProductOutcome): SetupBundle {
  if (!reference.label.trim() || bundle.previewOnly.pastReports.some(item => item.id === id)) return bundle;
  // Texture dislike and uncertainty are NOT converted into adverse experience, sensitivity or ineffective treatment.
  const notice: SetupNotice | null = outcome === 'stung' ? 'irritated' : outcome === 'broke_out' ? 'broke_out'
    : outcome === 'too_drying' ? 'too_drying' : outcome === 'not_helping' ? 'didnt_help' : outcome === 'helpful' ? 'liked' : null;
  const compatible = notice ? addSetupExperience(bundle, experienceFromNotice(id, reference, notice)) : bundle;
  return { ...compatible, previewOnly: { ...compatible.previewOnly, pastProducts: 'reported',
    pastReports: [...compatible.previewOnly.pastReports, { id, reference, outcome }] } };
}
export function removePastOutcome(bundle: SetupBundle, id: string): SetupBundle {
  const pastReports = bundle.previewOnly.pastReports.filter(item => item.id !== id);
  return { ...removeSetupExperience(bundle, id), previewOnly: { ...bundle.previewOnly, pastReports, pastProducts: pastReports.length ? 'reported' : 'unanswered' } };
}
