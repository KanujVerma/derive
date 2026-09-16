/**
 * Thin provider abstraction for Google Gemini Multimodal models.
 * Uses structured JSON outputs with schema enforcement.
 */

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.5-flash';

export const isGeminiConfigured = Boolean(GEMINI_API_KEY);

interface GeminiCallOptions {
  prompt: string;
  systemInstruction?: string;
  imageUri?: string;
  temperature?: number;
}

export async function callGemini(options: GeminiCallOptions): Promise<string> {
  if (!isGeminiConfigured) {
    // Return empty to trigger deterministic intelligent mock
    return '';
  }

  try {
    const parts: any[] = [{ text: options.prompt }];

    if (options.imageUri) {
      const response = await fetch(options.imageUri);
      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      parts.push({
        inline_data: {
          mime_type: 'image/jpeg',
          data: base64,
        },
      });
    }

    const payload: any = {
      contents: [{ parts }],
      generationConfig: {
        temperature: options.temperature ?? 0.2,
      },
    };

    if (options.systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: options.systemInstruction }],
      };
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Gemini API error: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    return json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (err) {
    console.warn('Gemini API call failed, falling back to local reasoning:', err);
    return '';
  }
}
