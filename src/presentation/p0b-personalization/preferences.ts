import type { ConfirmedPreference, PersonalContextV2, PreferenceTarget, SetupPayloadV2 } from '../../contracts/PersonalContextV2.ts';
import type { ContextProductReference } from '../../contracts/PersonalContext.ts';
import { preferenceSchema, setupV2Schema } from '../../contracts/PersonalContextV2Schema.ts';
import { profileToStorage, catalogReferenceKey } from './storageAdapter.ts';
import { createContextDraft } from './draft.ts';
import { LOCAL_DICTIONARY_RELEASE } from '../../domain/part-two/dictionary.ts';
import { canonicalJson } from '../../domain/part-two/hash.ts';
export const preferenceIngredientChoices = LOCAL_DICTIONARY_RELEASE.identities.filter(i => i.status === 'active').map(i => ({ id: i.ingredientId, label: i.preferredName }));
export interface PreferenceProductChoice {
    key: string;
    label: string;
    reference: ContextProductReference;
    selectable?: boolean;
}
export function preferenceProductChoices(context: PersonalContextV2, labels: Record<string, string> = {}): PreferenceProductChoice[] {
    const refs = [...(context.routine?.data.items.map(i => i.reference) ?? []), ...context.experiences.map(i => i.data.reference), ...context.assessments.map(i => i.data.reference)];
    return [...new Map(refs.map(reference => [canonicalJson(reference), reference])).entries()].map(([key, reference], index) => ({ key, reference, selectable: reference.kind === 'manual' || Boolean(labels[catalogReferenceKey(reference)]), label: reference.kind === 'manual' ? `${reference.name} · manual report, unverified` : `${labels[catalogReferenceKey(reference)] ?? `Recorded catalog product ${index + 1} (name unavailable)`} · exact selected reference` }));
}
export function confirmedPreference({ id, existing, kind, target, strength, confirmed, confirmedAt, independent = false }: {
    id: string;
    existing?: ConfirmedPreference;
    kind: ConfirmedPreference['kind'];
    target: PreferenceTarget | null;
    strength: ConfirmedPreference['strength'];
    confirmed: boolean;
    confirmedAt: string;
    independent?: boolean;
}): ConfirmedPreference {
    if (!confirmed)
        throw Error('Confirm this preference before adding it.');
    if (!target)
        throw Error('Choose the exact ingredient or recorded product, or enter an unresolved term.');
    if (target.kind === 'ingredient' && target.identity.kind === 'resolved') {
        const ingredientId = target.identity.ingredientId;
        if (!preferenceIngredientChoices.some(i => i.id === ingredientId))
            throw Error('Choose a reviewed exact ingredient identity.');
    }
    const value = { id, revision: existing ? existing.revision + 1 : 1, kind, target, strength, status: 'confirmed', confirmedAt, source: existing?.source.kind === 'note' && !independent ? existing.source : { kind: 'structured' } };
    const parsed = preferenceSchema.safeParse(value);
    if (!parsed.success)
        throw Error('Review this preference. Ingredient terms are limited to 100 characters.');
    return parsed.data;
}
/** Full active snapshot projection: uncertain dates, private notes and reports retain their exact meanings. */
export function preferenceSetup(context: PersonalContextV2, preferences: ConfirmedPreference[]): SetupPayloadV2 {
    if (context.historyTruncated)
        throw Error('Your history is incomplete. Preferences were not saved; no other context was removed.');
    const value: SetupPayloadV2 = { profile: context.profile?.data ?? { ...profileToStorage(createContextDraft()), primaryGoal: { state: 'unanswered' } }, routine: context.routine?.data ?? { completeness: 'unknown', items: [] }, experiences: context.experiences.map(i => i.data), preferences, assessments: context.assessments.map(i => i.data), notes: context.notes.map(i => i.data), setupAnswers: context.setupAnswers ?? { currentProducts: context.routine?.data.items.length ? 'reported' : 'unanswered', pastProducts: context.experiences.length ? 'reported' : 'unanswered' } };
    const parsed = setupV2Schema.safeParse(value);
    if (!parsed.success)
        throw Error('This context exceeds the atomic editor limits or has an unavailable dependency. No records were dropped. Keep up to 20 entries in each section.');
    return parsed.data;
}
