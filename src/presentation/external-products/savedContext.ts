import type { PersonalContextSnapshot } from '../../contracts/PersonalContext.ts';
import { catalogReferenceKey } from '../p0b-personalization/storageAdapter.ts';

export interface ExternalSavedContext {
  kind: 'loading' | 'unavailable' | 'ready';
  profile: string | null;
  reports: Array<{ id: string; product: string; symptoms: string[]; note: string | null }>;
  incomplete: boolean;
}
const label = (value: unknown, max = 180): string | null => typeof value === 'string' && value.trim()
  ? value.replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, max) : null;

/** Owner-bound report display only. No model call, ingredient attribution, score or inferred diagnosis. */
export function describeExternalSavedContext(ownerId: string | null, status: string,
  context: PersonalContextSnapshot | null, labels: Record<string, string> = {}): ExternalSavedContext {
  const empty = { profile: null, reports: [], incomplete: false };
  if (!ownerId || !context || context.ownerId !== ownerId) return { kind: status === 'error' ? 'unavailable' : 'loading', ...empty };
  if (status === 'error') return { kind: 'unavailable', ...empty };
  if (status !== 'ready') return { kind: 'loading', ...empty };
  if (context.profile && context.profile.ownerId !== ownerId || context.experiences.some(item => item.ownerId !== ownerId)) return { kind: 'unavailable', ...empty };
  const skin = context.profile?.data.skinBehavior;
  const skinLabels: Record<string, string> = { dry_tight: 'dry or tight', comfortable: 'comfortable', oily_shiny: 'oily or shiny', combination: 'combination', unsure: 'unsure' };
  const reactive = context.profile?.data.reactivity;
  const profile = skin && skinLabels[skin] ? `Saved skin type: ${skinLabels[skin]}.${reactive === 'reacts_easily' ? ' You reported that your skin reacts easily.' : ''}`
    : reactive === 'reacts_easily' ? 'You reported that your skin reacts easily.' : null;
  const reports: ExternalSavedContext['reports'] = context.experiences.filter(item => item.data.kind === 'reacted')
    .slice(0, 3).map(item => {
      const reference = item.data.reference;
      const key = reference.kind === 'catalog' ? catalogReferenceKey(reference) : null;
      return { id: item.id, product: reference.kind === 'manual' ? label(reference.name) ?? 'Unnamed product'
        : key && label(labels[key], 500) || 'Previously reported product (name unavailable)',
        symptoms: item.data.symptoms.slice(0, 8).map(value => label(value, 100)).filter((value): value is string => Boolean(value)),
        note: label(item.data.note, 500) };
    });
  // Existing free-context reports stay explicitly legacy observations, not invented modern revisions.
  if (reports.length < 3) for (const legacy of context.legacy.experiences) {
    if (legacy.kind !== 'reacted') continue;
    const product = label(legacy.productName ?? legacy.product_name);
    const id = label(legacy.id, 100);
    if (!product || !id) continue;
    reports.push({ id: 'legacy:' + id, product, symptoms: [], note: label(legacy.note, 500) });
    if (reports.length === 3) break;
  }
  const reportCount = context.experiences.filter(item => item.data.kind === 'reacted').length
    + context.legacy.experiences.filter(item => item.kind === 'reacted').length;
  return { kind: 'ready', profile, reports, incomplete: context.historyTruncated || context.legacy.truncated || reportCount > reports.length };
}
