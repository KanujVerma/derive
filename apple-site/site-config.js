/*
 * Derive site configuration.
 *
 * This is the only place availability and destinations are set. The HTML
 * ships in the "coming-soon" state, so the page stays truthful if this file
 * or landing.js fails to load.
 *
 * Switch to "available" only after the public App Store listing has been
 * opened and confirmed live. An App Store Connect app ID (eas.json) is not
 * proof that a public listing exists.
 */
window.DERIVE_SITE = {
  // "coming-soon" | "available"
  availability: 'coming-soon',

  // Verified public App Store URL, e.g. "https://apps.apple.com/us/app/derive/id...".
  // Leave null until the listing is live.
  appStoreUrl: null,

  // Optional QR code image (SVG/PNG in /assets) that encodes appStoreUrl exactly.
  // Shown quietly on desktop only when availability is "available".
  appStoreQrSrc: null,

  // A real launch-notification endpoint does not exist yet. Leave null.
  // When one exists, landing.js is the place to add the form states.
  launchNotifyUrl: null,
};
