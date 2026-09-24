/** Customer-facing free memory. Server records are mapped before reaching components. */
export type ProductState = 'using' | 'considering' | 'stopped';
export type ExperienceKind = 'tolerated' | 'reacted' | 'liked' | 'finished';
export type ProductSource = 'catalog' | 'user_reported';

export interface MyStuffViewModel {
  profile: null | { concerns: readonly string[]; skinFeel?: string; summaryUnit?: 'skin goal' };
  products: readonly { id: string; name: string; brand?: string; state: ProductState; source?: ProductSource }[];
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
    productHeader: 'Saved products',
    experienceHeader: 'Product experiences',
    experienceFooter: 'Your reports, separate from a medical diagnosis.',
  } : {
    productHeader: 'Current products',
    experienceHeader: 'Reactions & tolerance',
    experienceFooter: 'Your own observations, separate from a medical diagnosis.',
  };
}

export function formatMyStuffDate(value: string, liveFree: boolean): string {
  if (!liveFree) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value
    : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function buildMyStuffPresentation(model: MyStuffViewModel) {
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
    productSummary: model.products.length ? countLabel(model.products.length, 'product') : 'No products saved',
    checkSummary: model.checks.length ? countLabel(model.checks.length, 'check') : 'No checks yet',
    experienceSummary: model.experiences.length ? countLabel(model.experiences.length, 'experience') : 'No experiences noted',
  };
}
