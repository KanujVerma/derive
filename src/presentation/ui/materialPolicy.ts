export type Material = 'chrome' | 'content';
export function nativeGlassAllowed(input: {
  platform: string; moduleAvailable: boolean; apiAvailable: boolean;
  liquidGlassAvailable: boolean; reduceTransparency: boolean | null;
}): boolean {
  return input.platform === 'ios' && input.moduleAvailable && input.apiAvailable
    && input.liquidGlassAvailable && input.reduceTransparency === false;
}
export function materialSurface(_material: Material, tone: 'light' | 'dark'): string {
  return tone === 'dark' ? '#171A18' : '#FFFEFB';
}
export async function readReduceTransparency(platform: string, read: (() => Promise<boolean>) | undefined): Promise<boolean> {
  if (platform !== 'ios' || !read) return true;
  try { return await read(); } catch { return true; }
}
