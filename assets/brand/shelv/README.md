# Shelv artwork

Canonical corrected originals are in [`originals/`](originals/). They are copied byte-for-byte from the founder-supplied `shelv_corrected_geometry` folder. [`manifest.json`](manifest.json) records SHA-256 checksums and every runtime derivative; [`docs/BRANDING.md`](../../../docs/BRANDING.md) defines usage and the technical migration boundary.

| Primary | Inverted | Transparent |
| --- | --- | --- |
| ![Primary shelf mark](originals/shelv_primary.svg) | ![Inverted shelf mark](originals/shelv_inverted.svg) | ![Transparent shelf mark](originals/shelv_transparent.svg) |

Use the opaque primary 1024 PNG for the app icon. Use the tight transparent PNG in `generated/` for small in-app marks. The tight crop removes transparent margins only; do not redraw, stretch, rearrange, or recenter individual elements. Rounded previews and the before/after image are retained reference evidence, not launcher assets. The original SVGs are editable vector artwork with no scripts, embedded raster, fonts, or external dependencies.
