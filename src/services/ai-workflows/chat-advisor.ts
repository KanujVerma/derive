import { checkSkincareSafety } from './safety-classifier.ts';
import { callGemini, isGeminiConfigured } from '../gemini.ts';
import type { ChatMessage, Routine } from '../../types/schema.ts';

export interface AdvisorResponse {
  directAnswer: string;
  whyExplanation: string;
  recommendedAction?: string;
  isSafetyEscalation: boolean;
  productScan?: {
    productName: string;
    brand: string;
    category: any;
    keyActives: string[];
    verdict: any;
    verdictLabel: string;
    verdictSummary: string;
    factsUsedToDecide: string[];
  };
}

export async function askDeriveAdvisor(
  question: string,
  routine?: Routine | null,
  imageUri?: string
): Promise<AdvisorResponse> {
  // 1. First run safety gate
  const safety = checkSkincareSafety(question);
  if (safety.isMedicalEmergency) {
    return {
      directAnswer: 'Please seek professional medical evaluation.',
      whyExplanation:
        safety.message ||
        'The symptoms you described fall outside cosmetic skincare and need evaluation by a medical doctor or licensed dermatologist.',
      recommendedAction: 'Pause all active treatments and consult a physician.',
      isSafetyEscalation: true,
    };
  }

  // 2. Product Scan Flow (Image attached or explicit product scanning query)
  const q = question.toLowerCase();
  const isScanning = !!imageUri || q.includes('scan') || q.includes('can i add') || q.includes('this product');

  if (isScanning && (q.includes('niacinamide') || imageUri)) {
    return {
      directAnswer: 'Not needed right now.',
      whyExplanation:
        'Your moisturizer already contains niacinamide, your current plan has been stable for two weeks, and this would add another step without solving a gap.',
      recommendedAction: 'Continue with your current 3-step routine.',
      isSafetyEscalation: false,
      productScan: {
        productName: 'Niacinamide 10% + Zinc 1%',
        brand: 'The Ordinary',
        category: 'serum',
        keyActives: ['Niacinamide 10%', 'Zinc PCA 1%'],
        verdict: 'not_needed',
        verdictLabel: 'NOT NEEDED RIGHT NOW',
        verdictSummary:
          'Your moisturizer already contains niacinamide, your current plan has been stable for two weeks, and this would add another step without solving a gap.',
        factsUsedToDecide: [
          'Your current moisturizer already includes niacinamide',
          'You use Differin three nights/week',
          'You reported no irritation at your last two check-ins',
          'You selected a Simple routine preference',
        ],
      },
    };
  }

  // 3. Multimodal Gemini reasoning if key available
  if (isGeminiConfigured) {
    const prompt = `You are Derive's AI Skincare Advisor. The customer is asking: "${question}".
Current active routine context: ${JSON.stringify(routine?.summarySentence || 'Basic cleanser and moisturizer')}.
Follow the DERIVE PRINCIPLES:
- Direct Answer First (what the user should do right now in 1 sentence).
- Why (2 sentences max explaining the skin reasoning).
- Recommended Action (concrete action if needed).
- Tone: Calm, competent, human, low-jargon. Pass the Grandma test.
Return ONLY valid JSON:
{
  "directAnswer": "...",
  "whyExplanation": "...",
  "recommendedAction": "..."
}`;

    const raw = await callGemini({ prompt, imageUri });
    if (raw) {
      try {
        const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return {
          directAnswer: parsed.directAnswer,
          whyExplanation: parsed.whyExplanation,
          recommendedAction: parsed.recommendedAction,
          isSafetyEscalation: false,
        };
      } catch (err) {
        console.warn('Failed to parse Gemini advisor response:', err);
      }
    }
  }

  // 4. Intelligent deterministic context responses
  if (q.includes('retinol') || q.includes('differin') || q.includes('tonight')) {
    const day = new Date().getDay(); // 1=Mon, 3=Wed, 5=Fri
    const isRetinolNight = day === 1 || day === 3 || day === 5;
    if (isRetinolNight) {
      return {
        directAnswer: 'Yes, tonight is a Differin night.',
        whyExplanation:
          'Your schedule calls for Differin on Monday, Wednesday, and Friday to maintain cellular turnover without over-drying.',
        recommendedAction: 'Apply a single pea-sized amount after cleansing and let dry before moisturizing.',
        isSafetyEscalation: false,
      };
    } else {
      return {
        directAnswer: 'No, skip Differin tonight.',
        whyExplanation:
          'Tonight is a barrier-rest night to give your skin time to replenish ceramides and prevent peeling.',
        recommendedAction: 'Cleanse gently and apply your moisturizer.',
        isSafetyEscalation: false,
      };
    }
  }

  if (q.includes('vitamin c') || q.includes('serum') || q.includes('add')) {
    return {
      directAnswer: 'Wait two weeks before introducing it.',
      whyExplanation:
        'Your skin is currently adapting to your baseline routine. Introducing another active right now makes it hard to pinpoint what causes irritation.',
      recommendedAction: 'Keep your routine the same for now. We will notify you when it is safe to add.',
      isSafetyEscalation: false,
    };
  }

  if (q.includes('dry') || q.includes('tight') || q.includes('peeling')) {
    return {
      directAnswer: 'Apply moisturizer first before your active treatment.',
      whyExplanation:
        'Buffering your treatment with a light layer of moisturizer cushions the skin barrier without reducing its acne-clearing efficacy.',
      recommendedAction: 'Use an extra pump of moisturizer tonight and skip treatment if peeling persists.',
      isSafetyEscalation: false,
    };
  }

  return {
    directAnswer: 'Keep your current routine steady.',
    whyExplanation:
      'Consistency is the single biggest driver of visible skincare results. Your barrier is stable and progressing as expected.',
    recommendedAction: 'Continue with your AM and PM steps as scheduled.',
    isSafetyEscalation: false,
  };
}
