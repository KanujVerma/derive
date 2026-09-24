# K4-COMPOSE device acceptance

Use a physical iPhone with a product bearing a readable UPC/EAN barcode. These checks remain open until the final canonical Check composition runs on hardware.

## Physical hardware UX

- [ ] Open Check, close capture, and return to the compact entry without losing Search by name.
- [ ] Allow camera permission on first request; deny it and use the settings fallback in a separate run.
- [ ] Scan a real barcode, then try an unknown barcode. Both preserve a factual Search by name fallback.
- [ ] Capture front label, ingredients, and packaging. Retake each role and review the new local image.
- [ ] Exercise possible matches and insufficient evidence. Candidate selection remains a customer choice, not formula verification.
- [ ] Check haptics, safe area, and foreground/background return on the current development build.

## Local S-FREE-4 integration

- [ ] Use an exact local Supabase host and an authenticated free owner. Keep hosted anonymous signup disabled.
- [ ] Confirm each photo uses its detected MIME, one server-issued private path, immutable upload, and the matching resolver role.
- [ ] Confirm barcode resolution does not issue a photo grant.
- [ ] Confirm photo-only evidence without real extracted text can remain insufficient.
- [ ] Confirm a failed upload or resolver call leaves the local capture available for an explicit retry with the same request ID.
- [ ] Confirm quota and offline failures show safe copy without automatic grant requests.
- [ ] Inspect device logs and network traffic. No local URI, image bytes, raw ingredient text, or private path appears in logs or analytics.
