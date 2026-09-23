# Catalog identity cleanup implementation plan

**Goal:** Carry a customer-selected catalog product UUID from committed intake through routine persistence and readback without accepting a model-supplied UUID.

**Architecture:** Validate the committed Shelf ID against the service-read catalog row, then give the provider a short intake reference rather than a product UUID. Resolve that reference against the validated intake after ordinary proposal validation. Normalize linked product text to the canonical catalog row before the existing atomic routine RPC. Manual products and additions retain their current name-based path.

**Scope:** Routine identity handoff and stale CI ledger only. No model activation, membership, mobile navigation, formula, S6, or TestFlight change.

### 1. Intake identity and provider reference

- [x] Add failing tests for a valid catalog selection, a mismatched catalog ID, and a manual product.
- [x] Carry the committed Shelf ID and catalog flag into routine context; validate catalog selections using server-read `products` rows.
- [x] Provide an opaque per-intake reference to the provider, without exposing or accepting a provider product UUID.

### 2. Proposal binding and persistence

- [x] Add failing tests for provider wording changes, cross-product reference substitution, manual fallback, and exact routine/user-product IDs.
- [x] Allow the provider to echo the opaque reference on catalog products, decisions, and steps. Validate it against committed intake, reject conflicting identities, and bind canonical product IDs only on the server.
- [x] Keep the existing safety/proposal validator and RPC. Read back exact product IDs after persistence.

### 3. Proof and landing

- [x] Extend the controlled local intake-to-routine harness and pgTAP coverage where needed.
- [x] Correct the PR #38/main CI ledger with run `35902132423` and both successful jobs.
- [ ] Run full unit, pgTAP, both TypeScript checks, web and iOS JS exports, diff check, exact-head PR CI, and main CI. Local gates passed; CI remains.
- [x] Perform a disposable hosted proof if a safe deterministic path is available; delete the account and read back cleanup.
