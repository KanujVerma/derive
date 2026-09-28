# Multi-photo capture acceptance

## Current source behavior

- The Auto shutter saves the first ordinary photo as the front label. Review offers **Use photo** and **Retake** without asking the customer to classify it. **Change part** reveals the role choices only when the photo is not the front. A saved photo stays in the same capture session. The live camera returns with the first missing role selected: front label, then ingredients, then packaging. The customer can take the next photo immediately or tap **Check product**.
- Up to one photo is retained per role, with at most three photos plus a barcode. The compact thumbnails show retained photos and retake that role in one tap. In photo review, the role can be corrected; **Replace photo** names an intentional overwrite of an occupied role.
- A barcode detected in Auto does not join an existing photo set. The customer can explicitly choose Barcode. Valid observed retail barcodes already trigger a success haptic.
- A photo is only evidence. There is no automatic OCR, formula verification, or hands-free shutter. Unknown and insufficient evidence outcomes remain available.
- `initialRole` of front label, ingredients, or packaging opens the camera in that mode, so a later “add ingredients photo” request can capture without another role choice. The default and barcode opens stay in Auto. Connecting that request to the same resolution case is separate work.

## Validation boundary

Pure capture-session tests cover retained roles, one-per-role replacement, the three-photo cap, duplicate taps, and retake. Camera layout and hardware behavior need a later current-source physical pass. No on-device result is claimed by this change.
