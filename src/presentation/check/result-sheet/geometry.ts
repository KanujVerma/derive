/** Native onLayout supplies the complete identity/verdict height. No text is line-clamped. */
export function resultSheetGeometry(input: { height: number; topInset: number; bottomPadding: number; summaryHeight: number; contentSized?: boolean }) {
  const full = Math.max(180, input.height - input.topInset - 8);
  const needed = Math.ceil((input.summaryHeight || (input.contentSized ? 80 : 260)) + 60 + input.bottomPadding);
  const compact = Math.min(full - 2, Math.max(180, needed));
  const expanded = Math.min(full - 1, Math.max(compact + 1, Math.round(input.height * 0.72)));
  return { snapPoints: input.contentSized ? [compact] : [compact, expanded, full], needsFullHeight: needed > full - 2 };
}
