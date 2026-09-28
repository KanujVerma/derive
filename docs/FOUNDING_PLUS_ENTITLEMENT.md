# Founding Plus entitlement and Check usage

## Status

**IMPLEMENTED (client preparation):** `projectEntitlement` is a pure presentation projection. It does not fetch a policy, activate a grant, update a counter, enforce a server limit, or change app routing. The fixture is test/example data only. Current `FreeAccessState` still reports Free product access and Managed membership, without a Plus field. No customer currently receives Founding Plus from this module.

**APPROVED TARGET:** A future trusted server reader may provide a versioned policy, a customer-bound grant, and a usage count. The client projects current capabilities from those inputs. Server authority must independently enforce any Check limit and atomically count each customer-visible Check session once. Internal model calls, retries, and provider requests are not billable or quota units in this contract.

**EXPERIMENT:** Founding Plus is represented as a time-bounded promotional Plus grant with a cohort identifier. Cohort size, duration, and Free/Plus limits are policy decisions. The client contains no launch cohort allocation or fixed quota. A customer-visible offer must state the actual expiry and terms sourced from trusted authority before activation.

**OPEN FOUNDER DECISION:** Exact grant duration, cohort allocation, Check limits and windows, post-expiry behavior, and paid Plus billing provider remain unresolved. A policy version string identifies the server policy used to issue a grant and usage count; it does not imply a deployed remote config service.

## Projection boundary

Inputs are the validated `FreeAccessState`, an optional future `TrustedEntitlementSnapshotV1`, current UTC time, and network availability. The projection verifies snapshot version, owner, policy validity, grant validity, and usage window. Missing, offline, unknown, expired, or malformed evidence does not create Plus access. A valid active Managed membership conceptually includes Plus, but does not become a separate Plus purchase. Billing source and promotional source remain distinct; the founding cohort belongs to the grant, not the billing provider. The usage counter is a separate server fact.

Free factual product access remains available under the current access contract. When a future policy permits a full Check, the result must retain all supported facts, safety cautions, uncertainty, and reasons regardless of tier. Reaching a policy limit can prevent starting another customer-visible Check; it must never truncate an allowed Check's truth. When no policy snapshot is supplied, the projection falls back to current Free access rather than inventing a quota or Plus entitlement. A supplied but invalid snapshot cannot authorize another metered Check; server enforcement remains authoritative.

This module is deliberately uncomposed. App integration needs a trusted server response, server-side authorization/counting, customer terms and expiry copy, and an exact release/privacy review. Existing Stripe Managed membership and `access-state` remain separate authority paths.
