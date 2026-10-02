import type { PersonalContextSnapshot, PersonalExperienceInput, PersonalRoutineInput } from '../../contracts/PersonalContext.ts';
import type { CustomerWrite } from '../personal-decision/customerController.ts';
import type { ContextDraft } from './draft.ts';
import { validateContextDraft } from './draft.ts';
import type { SetupBundle, CurrentProductFeedback } from './setup.ts';
import { createSetupBundle, currentProductFeedback, experienceFromNotice } from './setup.ts';
import { experienceToStorage, profileToStorage, routineFromStorage, routineToStorage, type CustomerDisplayLabels } from './storageAdapter.ts';

export interface SetupPersistenceHost {
  getState(): { ownerId: string | null; context: PersonalContextSnapshot | null };
  save(input: CustomerWrite): Promise<boolean>;
}
export type SetupSaveResult = 'saved' | 'failed' | 'owner_changed' | 'invalid' | 'busy';

/** Reopen current routine products as owned reports. Existing history is kept, not re-collected or deleted. */
export function setupBundleFromContext(ownerId: string, context: PersonalContextSnapshot, labels: CustomerDisplayLabels = {}): SetupBundle {
  const bundle = createSetupBundle(ownerId);
  if (context.ownerId !== ownerId || context.routine && context.routine.ownerId !== ownerId) return bundle;
  const routine = context.routine ? routineFromStorage(context.routine.data, labels) : null;
  const products = routine?.items.filter(item => item.status === 'current' || item.status === 'occasional') ?? [];
  return { ...bundle, products, previewOnly: { ...bundle.previewOnly,
    currentProducts: products.length ? 'reported' : routine?.completeness === 'complete' ? 'none' : 'unanswered' } };
}

function referenceKey(reference: PersonalRoutineInput['items'][number]['reference']): string {
  return reference.kind === 'catalog' ? JSON.stringify([reference.productId, reference.variantId, reference.formulaVersionId])
    : JSON.stringify(['manual', reference.name.trim().toLowerCase(), reference.brand?.trim().toLowerCase() ?? '']);
}

/** User-reported outcomes retain their ordinary meaning, never an inferred allergy or formula fact. */
function feedbackExperience(product: SetupBundle['products'][number], value: CurrentProductFeedback, id: string): PersonalExperienceInput | null {
  const notice = value === 'helpful' ? 'liked' : value === 'not_helping' || value === 'still_dry' ? 'didnt_help'
    : value === 'stung' ? 'irritated' : value === 'broke_out' ? 'broke_out' : value === 'too_drying' ? 'too_drying' : null;
  if (!notice) return null;
  const draft = experienceFromNotice(id, product.reference, notice);
  // Exact customer wording is retained as reported context. It is not used to infer the cause.
  if (value === 'stung') draft.symptoms = ['Stinging'];
  if (value === 'still_dry') draft.note = 'Still feels dry';
  return experienceToStorage({ ...draft, useContext: {
    timing: product.timing, frequency: { ...product.frequency }, startedOn: product.startedOn ?? null,
    stoppedOn: product.stoppedOn ?? null, duration: product.duration ?? null,
  } });
}

/** Build once per submitted draft so retries retain stable experience IDs and confirmed progress. */
export function setupWrites(ownerId: string, draft: ContextDraft, bundle: SetupBundle, context: PersonalContextSnapshot, createId: () => string): CustomerWrite[] | null {
  if (bundle.ownerId !== ownerId || context.ownerId !== ownerId
    || context.profile && context.profile.ownerId !== ownerId
    || context.routine && context.routine.ownerId !== ownerId
    || context.experiences.some(item => item.ownerId !== ownerId) || validateContextDraft(draft)) return null;
  const writes: CustomerWrite[] = [{ operation: 'save_profile', profile: profileToStorage(draft) }];
  const answer = bundle.previewOnly.currentProducts;
  if (bundle.products.length || answer === 'none' || answer === 'unknown') {
    const collected = routineToStorage({ completeness: bundle.products.length ? 'partial' : answer === 'none' ? 'complete' : 'unknown', items: bundle.products });
    // Fresh setup must not discard an existing routine collected elsewhere.
    const existing = context.routine?.data;
    const items = [...(existing?.items ?? [])];
    for (const item of collected.items) if (!items.some(saved => saved.id === item.id || referenceKey(saved.reference) === referenceKey(item.reference))) items.push(item);
    writes.push({ operation: 'save_routine', routine: {
      completeness: existing?.items.length ? existing.completeness : collected.completeness, items,
    } });
  }
  const reports = bundle.experiences.map(experience => {
    const notice = bundle.previewOnly.pastReports.find(item => item.id === experience.id);
    return experienceToStorage(notice?.outcome === 'stung' ? { ...experience, symptoms: ['Stinging', ...experience.symptoms.filter(symptom => symptom !== 'Stinging')] } : experience);
  });
  for (const product of bundle.products) for (const feedback of currentProductFeedback(bundle, product.id)) {
    const report = feedbackExperience(product, feedback, createId());
    if (report) reports.push(report);
  }
  const savedIds = new Set(context.experiences.map(item => item.data.id));
  for (const report of reports) if (!savedIds.has(report.id)) {
    savedIds.add(report.id);
    writes.push({ operation: 'append_experience', experience: report, supersedesRevisionId: null });
  }
  // A general optional note has no storage contract. Never silently store it as a sensitivity/report.
  return writes;
}

/** Sequential existing APIs, not an atomic database transaction. Confirmed steps are never replayed on retry. */
export function createSetupPersistence(host: SetupPersistenceHost, createId: () => string) {
  let pending: { key: string; writes: CustomerWrite[]; next: number } | null = null;
  let busy = false;
  const feedbackIds = new Map<string, string>();
  return {
    async save(ownerId: string, draft: ContextDraft, bundle: SetupBundle, isCurrent: () => boolean): Promise<SetupSaveResult> {
      if (busy) return 'busy';
      const current = () => isCurrent() && host.getState().ownerId === ownerId && host.getState().context?.ownerId === ownerId;
      if (!current()) return 'owner_changed';
      const key = JSON.stringify([ownerId, draft, bundle]);
      if (!pending || pending.key !== key) {
        let writes: CustomerWrite[] | null;
        let feedbackIndex = 0;
        const feedbackKey = bundle.products.flatMap(product => currentProductFeedback(bundle, product.id).map(value => JSON.stringify([ownerId, product.id, value])));
        const stableFeedbackId = () => {
          const idKey = feedbackKey[feedbackIndex++];
          if (!feedbackIds.has(idKey)) feedbackIds.set(idKey, createId());
          return feedbackIds.get(idKey)!;
        };
        try { writes = setupWrites(ownerId, draft, bundle, host.getState().context!, stableFeedbackId); } catch { return 'invalid'; }
        if (!writes) return 'invalid';
        pending = { key, writes, next: 0 };
      }
      const run = pending;
      busy = true;
      try {
        while (run.next < run.writes.length) {
          if (!current()) return 'owner_changed';
          const confirmed = await host.save(run.writes[run.next]).catch(() => false);
          if (!isCurrent() || host.getState().ownerId !== ownerId) return 'owner_changed';
          if (!confirmed) return 'failed';
          run.next++;
          // Save must be followed by owner-bound readback before later writes or navigation.
          if (!current()) return 'failed';
        }
        pending = null;
        return 'saved';
      } finally { busy = false; }
    },
  };
}
