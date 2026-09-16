/**
 * Client-side Gemini helper is intentionally inert.
 *
 * Production Gemini invocation belongs on the trusted Supabase/server
 * environment (Sami). The Expo client must never embed a Gemini API key
 * or send customer data to Google from the device.
 *
 * MockDeriveService and local AI workflow helpers use deterministic
 * fallbacks when this helper returns empty.
 */

export const isGeminiConfigured = false;

interface GeminiCallOptions {
  prompt: string;
  systemInstruction?: string;
  imageUri?: string;
  temperature?: number;
}

export async function callGemini(_options: GeminiCallOptions): Promise<string> {
  return '';
}
