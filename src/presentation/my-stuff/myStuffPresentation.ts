import type { PersonalContextSnapshot } from '../../contracts/PersonalContext.ts';
import { contextProductLabel } from '../p0b-personalization/storageAdapter.ts';
/** Customer-facing free memory. Server records are mapped before reaching components. */
export type ProductState = 'using' | 'considering' | 'stopped';
export type ExperienceKind = 'tolerated' | 'reacted' | 'liked' | 'finished' | 'no_reaction_reported' | 'ineffective';
export type ProductSource = 'catalog' | 'user_reported';

export interface MyStuffViewModel {
  profile: null | { concerns: readonly string[]; skinFeel?: string; summaryUnit?: 'skin goal' };
  products: readonly { id: string; productId?: string | null; name: string; brand?: string; state: ProductState; source?: ProductSource }[];
  checks: readonly { id: string; productName: string; checkedAt: string; outcome: 'checked' }[];
  experiences: readonly {
    id: string;
    productName: string;
    kind: ExperienceKind;
    source?: ProductSource;
    note?: string;
    notedAt?: string;
  }[];
}

const countLabel = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

export function myStuffCopy(liveFree: boolean) {
  return liveFree ? {
    productHeader: 'Your products',
    experienceHeader: 'Your experience',
    experienceFooter: 'Your reports, separate from a medical diagnosis.',
  } : {
    productHeader: 'Your products',
    experienceHeader: 'Your experience',
    experienceFooter: 'Your own observations, separate from a medical diagnosis.',
  };
}

export function formatMyStuffDate(value: string, liveFree: boolean): string {
  if (!liveFree) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function buildMyStuffPresentation(model: MyStuffViewModel, canonicalExperiences: readonly CanonicalExperienceView[] = []) {
  const experienceRows = [
    ...canonicalExperiences.map(row => ({ ...row, key: 'personal:' + row.revisionId, origin: 'personal_context' as const })),
    ...model.experiences.map(row => ({ ...row, key: 'saved:' + row.id, origin: 'legacy_free_context' as const, revisionId: undefined, formulaContext: row.source === 'user_reported' ? 'manual' as const : 'unconfirmed' as const, occurred: undefined })),
  ];
  const concernCount = model.profile?.concerns.length ?? 0;
  return {
    profile: {
      summary: model.profile
        ? concernCount > 0
          ? countLabel(concernCount, model.profile.summaryUnit ?? 'skin concern')
          : 'Profile started'
        : 'Not set up',
      concerns: model.profile?.concerns ?? [],
      skinFeel: model.profile?.skinFeel,
    },
    products: model.products,
    checks: model.checks,
    experiences: model.experiences,
    experienceRows,
    productSummary: model.products.length ? countLabel(model.products.length, 'product') : 'No products saved',
    checkSummary: model.checks.length ? countLabel(model.checks.length, 'check') : 'No checks yet',
    experienceSummary: experienceRows.length ? countLabel(experienceRows.length, 'experience') : 'No experiences noted',
  };
}

export interface CanonicalExperienceView {
  id: string;
  revisionId: string;
  productName: string;
  kind: ExperienceKind;
  source: ProductSource;
  formulaContext: 'manual' | 'confirmed' | 'unconfirmed';
  note?: string;
  /** Reported occurrence dates, never substituted with the date saved. */
  occurred?: { start: string | null; end: string | null };
  notedAt?: string;
}

export function mapCanonicalExperiences(context: PersonalContextSnapshot, displayLabels: Record<string, string>): CanonicalExperienceView[] {
  return context.experiences.filter(item => item.ownerId === context.ownerId).map((item, index) => ({
    id: item.data.id,
    revisionId: item.id,
    productName: contextProductLabel(item.data.reference, displayLabels, index + 1),
    kind: item.data.kind,
    source: item.data.reference.kind === 'manual' ? 'user_reported' : 'catalog',
    formulaContext: item.data.reference.kind === 'manual' ? 'manual'
      : item.data.reference.variantId && item.data.reference.formulaVersionId ? 'confirmed' : 'unconfirmed',
    ...(item.data.note ? { note: item.data.note } : {}),
    occurred: { ...item.data.occurred },
  }));
}

export const experienceLabels: Record<ExperienceKind, string> = {
  reacted: 'Reported reaction', tolerated: 'No problems noticed', no_reaction_reported: 'No reaction reported',
  liked: 'Liked it', finished: 'Finished it', ineffective: 'No benefit noticed',
};
