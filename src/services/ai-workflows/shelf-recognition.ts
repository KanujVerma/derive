import { callGemini, isGeminiConfigured } from '../gemini';
import { Product, ProductCategory } from '../../types/schema';

export interface ShelfRecognitionResult {
  products: Product[];
  unclearBottlesCount: number;
}

export async function recognizeShelfProducts(
  imageUri: string
): Promise<ShelfRecognitionResult> {
  if (isGeminiConfigured) {
    const prompt = `You are Derive's computer vision product recognizer. Analyze this skincare shelf or product photo.
Identify all visible skincare products.
Return ONLY valid JSON matching this structure:
{
  "products": [
    {
      "id": "gen_unique_id",
      "brand": "Brand Name",
      "name": "Product Name",
      "category": "cleanser|toner|treatment|serum|moisturizer|sunscreen|oil|mask|other",
      "keyActives": ["active1", "active2"]
    }
  ],
  "unclearBottlesCount": 0
}`;

    const raw = await callGemini({ prompt, imageUri });
    if (raw) {
      try {
        const cleaned = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return {
          products: parsed.products || [],
          unclearBottlesCount: parsed.unclearBottlesCount || 0,
        };
      } catch (err) {
        console.warn('Failed to parse Gemini shelf response, using defaults:', err);
      }
    }
  }

  // Realistic mock data when API key is not yet set
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
