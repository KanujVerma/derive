import type { Product } from '../../types/schema';

export interface ShelfRecognitionResult {
  products: Product[];
  unclearBottlesCount: number;
}

export async function recognizeShelfProducts(
  imageUri: string
): Promise<ShelfRecognitionResult> {
  // Live shelf recognition is a server/Edge Function concern (Sami).
  // The Expo client uses deterministic fixtures so Kanuj can build without a Gemini key.
  void imageUri;

  return {
    products: [
      {
        id: 'p1',
        brand: 'CeraVe',
        name: 'Hydrating Facial Cleanser',
        category: 'cleanser',
        keyActives: ['Ceramides', 'Hyaluronic Acid'],
      },
      {
        id: 'p2',
        brand: 'Differin',
        name: 'Adapalene Gel 0.1% Acne Treatment',
        category: 'treatment',
        keyActives: ['Adapalene 0.1% (Retinoid)'],
      },
      {
        id: 'p3',
        brand: 'The Ordinary',
        name: 'Niacinamide 10% + Zinc 1%',
        category: 'serum',
        keyActives: ['Niacinamide', 'Zinc PCA'],
      },
      {
        id: 'p4',
        brand: 'La Roche-Posay',
        name: 'Toleriane Double Repair Face Moisturizer',
        category: 'moisturizer',
        keyActives: ['Ceramide-3', 'Niacinamide'],
      },
      {
        id: 'p5',
        brand: 'Beauty of Joseon',
        name: 'Relief Sun : Rice + Probiotics (SPF 50+)',
        category: 'sunscreen',
        keyActives: ['Rice Extract', 'Grain Probiotics', 'Chemical Filters'],
      },
    ],
    unclearBottlesCount: 0,
  };
}
