# Multi-photo capture acceptance

## Current source behavior

- A saved photo stays in the same capture session. The live camera returns with the first missing role selected: front label, then ingredients, then packaging. The customer can take the next photo immediately or tap **Check product**.
- Up to one photo is retained per role, with at most three photos plus a barcode. The compact thumbnails show retained photos and retake that role in one tap. In photo review, the role can be corrected; **Replace photo** names an intentional overwrite of an occupied role.
- A barcode detected in Auto does not join an existing photo set. The customer can explicitly choose Barcode. Valid observed retail barcodes already trigger a success haptic.
- A photo is only evidence. There is no automatic OCR, formula verification, or hands-free shutter. Unknown and insufficient evidence outcomes remain available.
- `initialRole="ingredients"` in the capture host can preselect Ingredients when a later Check result requests it. Connecting that request and carrying an existing case across Check composition is separate work.

## Validation boundary

Pure capture-session tests cover retained roles, one-per-role replacement, the three-photo cap, duplicate taps, and retake. Camera layout and hardware behavior need a later current-source physical pass. No on-device result is claimed by this change.
