# Camera result sheet

## Current source behavior

- When Check can bind a resolver result to an immutable product-truth snapshot, the live camera stays mounted and a compact result sheet covers the lower preview.
- The sheet shows loading, a bound result, or a check error. Barcode observation is paused while that sheet is open.
- Closing the sheet clears that result and starts a fresh capture session. View full result leaves the camera and uses the existing result page.
- A finished resolver result that omits the snapshot cannot be bound, so Check uses the existing result page instead of inventing a sheet.

## Same-case follow-up is not available

`resolve-product-identity` accepts a caller `requestId` so the same request can be retried. It does not accept an existing resolution case id or revision. A later ingredients photo therefore cannot be appended to the authoritative case that produced the sheet.

The sheet's "Add ingredient photo" action is not wired. Wiring it to a new resolve would create a different case and must not be presented as continuation of the current one.

Sami owns the missing contract: append customer evidence to the same owner, resolution case, and revision, then return a new immutable snapshot. Until that exists, Kanuj must not synthesize case continuity on the client.
