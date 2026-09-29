# Landing page handoff (apple-site)

**Status: unpublished preview on a branch.** Nothing was deployed. The Vercel project is not Git-connected (recorded in CONTEXT_SYNC), so merging does not publish either. Public deployment needs separate founder approval.

## Where things live

| What | File |
| --- | --- |
| Page structure and all customer copy | `apple-site/index.html` (plain HTML, one section per story beat, no copy in JS) |
| Availability and destinations | `apple-site/site-config.js` |
| Styles and Mineral tokens | `apple-site/assets/landing.css` (`:root` mirrors `src/constants/theme.ts`) |
| Demo, example toggle, header, CTA switching | `apple-site/assets/landing.js` (progressive enhancement only) |
| Brand assets | `derive-mark-64/128.png` (resized `assets/logo.png`, not redrawn), `favicon.png`, `apple-touch-icon.png`, `assets/og.png` |
| Font | Instrument Sans variable, SIL OFL 1.1, self-hosted with `assets/fonts/OFL.txt` |

Privacy, Support and Privacy choices pages, `styles.css` and `vercel.json` are unchanged.

Run locally from the repo root: `python3 -m http.server 4173 -d apple-site`, then open http://localhost:4173/ (clean URLs such as `/privacy` resolve only on Vercel or a server that maps `.html`).

## CTA state

- The HTML ships in the **coming-soon** state: "See how it works" (anchor to the demo), a quiet "See an example" link, and "Coming to iPhone. Checking a product will be free." The header shows only anchor links; its app button stays hidden.
- No public App Store listing was confirmed. `eas.json` has `ascAppId 6813524447`, but APP_STORE_RELEASE_READINESS lists the record as UNKNOWN and no scanner-first release exists. The listing could not be opened from this environment.
- When the listing is live: set `availability: 'available'` and `appStoreUrl` in `site-config.js`. Primary CTAs become "Get Derive for iPhone" and the header shows "Get the app". Optionally add a QR image encoding the same URL as `appStoreQrSrc` (desktop only). Use Apple's official badge artwork if a badge replaces the text button.
- **No launch or Plus notification path exists.** The only waitlist (`managed_waitlist`) is an authenticated in-app Managed table, not a web form. The page therefore has no email field and no "Notify me".

## Real versus illustrative

- Real: Derive mark and icon, Mineral palette, and the result language, which reuses the app's own decision titles, reason sentences, section labels and next-step labels (`src/presentation/personal-decision/result.ts`, `ScanResultSheet`).
- Illustrative: every phone screen is HTML built from those app patterns, not a screenshot. Products ("Barrier Repair Cream", "Daily Hydrating Lotion", "Example brand") and the example profile are fictional. Each visual is labeled as an example on the page.
- Needed to replace them: a sanitized iPhone screenshot of a real Check result (no personal profile), and ideally a short silent capture-to-result screen recording from the scanner-first candidate.

## Provisional claims to confirm before publishing

- "Scan or search" and "Point your camera at the barcode": barcode resolution is built but not physically accepted on the release candidate.
- "Checking a product will be free": matches MONETIZATION's Free Check, but the final offer is not locked.
- Derive Plus is shown as "In development" with one self-directed capability (compare a current product with one being considered). No price, trial or date. Remove the section if Plus stays parked.
- The page carries "Cosmetic skincare guidance, not medical diagnosis or treatment." No audience/age statement is included because that decision is reopened.
- `og:image` uses an absolute `derive-beta-site.vercel.app` URL. Update it if the domain changes.

## Checks performed (Chromium via Playwright, 2026-09-29)

- 375, 430, 768 and 1440 px: no horizontal overflow, no console errors or failed requests.
- 200% root text size at 1280 px: no overflow; layout reflows.
- JavaScript disabled: all content visible (demo shows the final result, both example views stack).
- Keyboard: skip link, nav, CTAs, demo steps, pause control, tablist with arrow/Home/End keys, details disclosure. Visible focus ring on all.
- Reduced motion: demo does not autoplay, pause control hidden, transitions effectively off.
- Contrast: muted text 4.74 to 5.74:1; Plus section text 8.1 to 9.5:1; buttons 8.3:1.
- Performance, local server, 4x CPU throttle, 1.6 Mbps / 150 ms RTT, 3 runs each: LCP 1.10 to 1.16 s (mobile and desktop), CLS 0, about 100 KB transferred.
- Not tested: Safari/WebKit and real iOS devices, VoiceOver, production CDN.
