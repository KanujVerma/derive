# Multi-photo capture acceptance

## Current source behavior

- The Auto shutter saves the first ordinary photo as the front label. Review offers **Use photo** and **Retake**. A saved photo stays in the same session, and the camera returns to Auto. It does not ask for the next empty photo slot. **Check product** is available once any photo is saved. If that photo cannot identify the product, a sheet offers search by name in the card, or a button that opens the ingredient photo with the earlier photo kept. Dismissing the sheet leaves the camera and the saved photo in place.
- Up to one photo is retained per role, with at most three photos plus a barcode. The compact thumbnails show retained photos and retake that role in one tap. In photo review, the role can be corrected; **Replace photo** names an intentional overwrite of an occupied role.
- A barcode detected in Auto does not join an existing photo set. The customer can explicitly choose Barcode. Valid observed retail barcodes already trigger a success haptic.
- A photo is only evidence. There is no automatic OCR, formula verification, or hands-free shutter. Unknown and insufficient evidence outcomes remain available.
- `initialRole` of front label, ingredients, or packaging opens the camera in that mode, so a later “add ingredients photo” request can capture without another role choice. The default and barcode opens stay in Auto. Connecting that request to the same resolution case is separate work.

## Validation boundary

Pure capture-session tests cover retained roles, one-per-role replacement, the three-photo cap, duplicate taps, and retake. Camera layout and hardware behavior need a later current-source physical pass. No on-device result is claimed by this change.
