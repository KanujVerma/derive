export const OBF_SOURCE_METHOD_URL = 'https://snojlbqovlawewwqbviz.supabase.co/functions/v1/part-one/source-method/v1';
export function isOpenBeautyFactsSource(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'world.openbeautyfacts.org' && !url.username && !url.password;
  } catch { return false; }
}
