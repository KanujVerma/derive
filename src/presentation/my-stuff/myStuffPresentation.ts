/** UI-only context. A future owner-bound read adapter may supply this model. */
export type ProductState = 'using' | 'considering' | 'stopped';
export type ExperienceKind = 'tolerated' | 'reacted' | 'liked' | 'finished';

export interface MyStuffViewModel {
  profile: null | { concerns: readonly string[]; skinFeel?: string };
  products: readonly { id: string; name: string; brand?: string; state: ProductState }[];
  checks: readonly { id: string; productName: string; checkedAt: string; outcome: 'checked' }[];
  experiences: readonly {
    id: string;
    productName: string;
    kind: ExperienceKind;
    note?: string;
    notedAt?: string;
  }[];
}

const countLabel = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

export function buildMyStuffPresentation(model: MyStuffViewModel) {
  const concernCount = model.profile?.concerns.length ?? 0;
  return {
    profile: {
      summary: model.profile
        ? concernCount > 0
          ? countLabel(concernCount, 'skin concern')
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
