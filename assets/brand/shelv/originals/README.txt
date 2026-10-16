SHELV, corrected symmetric shelf mark

The previous traced mark inherited different left and right curves from the AI-generated reference. This production artwork replaces those unequal curves with an exactly reflected cubic Bezier curve on either end of each shelf. Both shelves use the same proportions, with the lower shelf uniformly enlarged and shifted left. Dot radius and vertical spacing are preserved.

Master palette from KanujVerma/derive/src/constants/theme.ts:
  Brand green: #345447
  Off-white: #FFFEFB
  Warm ivory: #F6F3EC

shelv_primary.svg         Full-bleed green square / off-white mark. Use for iOS app icon with OS mask.
shelv_inverted.svg        Ivory square / green mark.
shelv_transparent.svg     Green mark on true transparent 700x700 canvas.
*_512.png, *_1024.png, *_2048.png: high resolution raster exports.
*_rounded_preview.svg: Rounded-corner preview ONLY, not needed for iOS asset catalog.
shelv_before_after.png   Previous asymmetric trace versus corrected mark.
geometry_spec.json       Curve dimensions and numerical symmetry verification.

Each SVG has real SVG <path> and <circle> elements, with no embedded raster. Import the SVG into Figma as editable vector paths.
