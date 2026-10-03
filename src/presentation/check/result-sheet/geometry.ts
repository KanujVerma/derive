/** Native onLayout supplies the complete identity/verdict height. No text is line-clamped. */
export function resultSheetGeometry(input: { height: number; topInset: number; bottomPadding: number; summaryHeight: number; contentSized?: boolean }) {
  const full = Math.max(180, input.height - input.topInset - 8);
  const needed = Math.ceil((input.summaryHeight || (input.contentSized ? 80 : 260)) + 60 + input.bottomPadding);
  // Native spring/layout rounding cannot reliably distinguish one-pixel detents.
  // Oversized summaries open at full height; keep the other detents reachable.
  const compact = Math.min(full - 48, Math.max(132, needed));
  const expanded = Math.min(full - 24, Math.max(compact + 24, Math.round(input.height * 0.72)));
  return { snapPoints: input.contentSized ? [compact] : [compact, expanded, full], needsFullHeight: needed > full - 48 };
}
