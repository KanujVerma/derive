import type { FreeSkinProfile } from '../../contracts/FreePersonalFit.ts';
import type { FreeSavedProduct, FreeCheckEntry, FreeExperienceEntry } from '../../contracts/FreeContext.ts';
import type { MyStuffViewModel } from './myStuffPresentation.ts';

const goalLabels: Record<FreeSkinProfile['goals'][number], string> = {
  breakouts: 'Breakouts', dark_spots: 'Dark spots', dryness: 'Dryness',
  redness: 'Redness', texture: 'Texture', oiliness: 'Oiliness',
  fine_lines: 'Fine lines', simplify: 'Simplify routine', maintain: 'Maintain skin',
};
const skinFeelLabels: Record<FreeSkinProfile['skinBehavior'], string> = {
  dry_tight: 'Dry or tight', comfortable: 'Comfortable', combination: 'Combination',
  oily_shiny: 'Oily or shiny', unsure: 'Not sure',
};

/** Keep manual product text and reported experiences separate from catalog identity. */
export function mapFreeMyStuff(
  profile: FreeSkinProfile | null,
  products: readonly FreeSavedProduct[],
  checks: readonly FreeCheckEntry[],
  experiences: readonly FreeExperienceEntry[],
): MyStuffViewModel {
  return {
    profile: profile ? {
      concerns: profile.goals.map((goal) => goalLabels[goal]),
      skinFeel: skinFeelLabels[profile.skinBehavior],
      summaryUnit: 'skin goal',
    } : null,
    products: products.map((product) => ({
      id: product.id, name: product.name, brand: product.brand ?? undefined,
      state: product.state, source: product.source,
    })),
    checks: checks.map((check) => ({
      id: check.id,
      productName: check.productId ? check.productName : 'Product not identified',
      checkedAt: check.checkedAt, outcome: 'checked' as const,
    })),
    experiences: experiences.map((experience) => ({
      id: experience.id, productName: experience.productName,
      kind: experience.kind, source: experience.source,
      note: experience.note ?? undefined, notedAt: experience.notedAt,
    })),
  };
}
