import type {
  SkinProfile,
  Product,
  UserProduct,
  Routine,
  RoutineStep,
  RoutineAction,
} from '../../types/schema.ts';

export interface RoutineProposalResult {
  summarySentence: string;
  userProducts: UserProduct[];
  routine: Routine;
}

export function generateRoutineProposal(
  profile: Partial<SkinProfile>,
  existingProducts: Product[]
): RoutineProposalResult {
  const userId = profile.userId || 'guest_user';

  // 1. Audit user products into KEEP, PAUSE, REPLACE, ADD, STOP
  const auditedProducts: UserProduct[] = existingProducts.map((p) => {
    let action: RoutineAction = 'KEEP';
    let actionReason = "Keep. It's working with the rest of your routine and you've reported no issues with it.";
    let frequency = 7;

    const lowerName = p.name.toLowerCase();

    if (lowerName.includes('adapalene') || lowerName.includes('retin') || p.category === 'treatment') {
      action = 'KEEP';
      actionReason = "Keep at 3 nights/week. You've tolerated this schedule without significant irritation.";
      frequency = 3;
    } else if (p.category === 'cleanser') {
      action = 'KEEP';
      actionReason = "Keep. It cleanses effectively without tightness or stripping your barrier.";
      frequency = 7;
    } else if (p.category === 'sunscreen') {
      action = 'KEEP';
      actionReason = 'Keep every morning. Essential daily UV protection to prevent post-blemish marks.';
      frequency = 7;
    } else if (p.category === 'moisturizer') {
      action = 'KEEP';
      actionReason = 'Keep. Pairs well with your evening active to maintain hydration without clogging pores.';
      frequency = 7;
    } else if (lowerName.includes('scrub') || lowerName.includes('harsh')) {
      action = 'PAUSE';
      actionReason = "Pause for now. You're already getting cellular turnover from your retinoid. Leaving physical scrubs out prevents irritation.";
      frequency = 0;
    } else if (lowerName.includes('astringent') || lowerName.includes('denatured alcohol')) {
      action = 'STOP';
      actionReason = 'Stop using. High alcohol astringents strip natural lipids and worsen reactive oiliness.';
      frequency = 0;
    }

    return {
      id: `up_${p.id}`,
      userId,
      productId: p.id,
      product: p,
      action,
      actionReason,
      frequencyNightsPerWeek: frequency,
      isConfirmedByUser: true,
    };
  });

  // 2. Formulate AM steps
  const amSteps: RoutineStep[] = [
    {
      id: 'step_am_1',
      order: 1,
      productId: 'p1',
      brand: 'CeraVe',
      productName: 'Hydrating Facial Cleanser',
      category: 'cleanser',
      amount: '1-2 pumps',
      area: 'Entire face with lukewarm water',
      timing: 'am',
      days: [], // Everyday
      purpose: 'Cleanse',
      whyChosen: "You're tolerating this cleanser well, and it keeps your routine simple around Differin without adding another active.",
      scheduleText: 'Every morning',
    },
    {
      id: 'step_am_2',
      order: 2,
      productId: 'p4',
      brand: 'La Roche-Posay',
      productName: 'Toleriane Double Repair Face Moisturizer',
      category: 'moisturizer',
      amount: 'Dime-sized dollop',
      area: 'Entire face & neck',
      timing: 'am',
      days: [],
      purpose: 'Hydrate & Seal',
      whyChosen: 'You already get niacinamide and ceramides from this moisturizer, preventing daytime dryness without needing an extra serum.',
      scheduleText: 'Every morning',
    },
    {
      id: 'step_am_3',
      order: 3,
      productId: 'p5',
      brand: 'Beauty of Joseon',
      productName: 'Relief Sun SPF 50+',
      category: 'sunscreen',
      amount: 'Two finger-lengths',
      area: 'Entire face, ears, and neck',
      timing: 'am',
      days: [],
      purpose: 'Daily UV Shield',
      whyChosen: 'Essential daily UV shield to prevent post-blemish marks from darkening while using evening Differin.',
      scheduleText: 'Every morning',
    },
  ];

  // 3. Formulate PM steps (e.g. Differin scheduled Mon, Wed, Fri)
  const pmSteps: RoutineStep[] = [
    {
      id: 'step_pm_1',
      order: 1,
      productId: 'p1',
      brand: 'CeraVe',
      productName: 'Hydrating Facial Cleanser',
      category: 'cleanser',
      amount: '1-2 pumps',
      area: 'Face & neck',
      timing: 'pm',
      days: [],
      purpose: 'Evening Cleanse',
      whyChosen: 'Gentle evening cleanse that removes sunscreen thoroughly without stripping your barrier before active treatment.',
      scheduleText: 'Every evening',
    },
    {
      id: 'step_pm_2',
      order: 2,
      productId: 'p2',
      brand: 'Differin',
      productName: 'Adapalene Gel 0.1%',
      category: 'treatment',
      amount: 'Pea-sized amount',
      area: 'Entire face, strictly avoiding eyelids and mouth corners',
      timing: 'pm',
      days: ['mon', 'wed', 'fri'],
      purpose: 'Blemish & Pore Treatment',
      whyChosen: 'Targeted schedule (Mon / Wed / Fri) to clear breakouts and unclog pores while preserving skin comfort.',
      watchFor: 'Mild flaking or stinging around corners of nose.',
      scheduleText: 'Mon / Wed / Fri',
    },
    {
      id: 'step_pm_3',
      order: 3,
      productId: 'p4',
      brand: 'La Roche-Posay',
      productName: 'Toleriane Double Repair Face Moisturizer',
      category: 'moisturizer',
      amount: 'Nickel-sized dollop',
      area: 'Entire face & neck',
      timing: 'pm',
      days: [],
      purpose: 'Barrier Recovery',
      whyChosen: 'Buffers evening Differin and locks in hydration overnight to prevent flaking or stinging.',
      scheduleText: 'Every evening',
    },
  ];

  const routine: Routine = {
    id: `rt_${Date.now()}`,
    userId,
    version: 1,
    status: 'approved',
    summarySentence: '3 steps morning · 3 steps evening · Differin Mon/Wed/Fri',
    amSteps,
    pmSteps,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    founderNotes: 'Routine confirmed. Adapalene scheduled Mon/Wed/Fri to preserve barrier comfort.',
  };

  return {
    summarySentence: routine.summarySentence,
    userProducts: auditedProducts,
    routine,
  };
}
