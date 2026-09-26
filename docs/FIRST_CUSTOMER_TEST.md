# Scanner-First External Beta Acceptance Plan

**Purpose:** Target criteria for a future scanner-first external beta. This is not evidence that the complete target flow or hosted anonymous access exists.

**Acceptance ownership:** Acceptance follows the active feature-DRI model. P0-A Capture + Product Resolution is currently recommended to Sami; P0-B Personal Decision Intelligence is currently recommended to Kanuj. Name a cross-product composition/release DRI before final release acceptance. Platform/truth and customer-experience stewardship remain cross-cutting review roles.

**Current implementation boundary:** A bounded free scanner-first path, profile/history, private evidence handling, and K4/S4 camera integration exist locally. Check uses Expo Camera directly. Current free Personal Fit is first-match; free product memory does not contain the canonical routine schedule model. Photo OCR/image recognition is absent, hosted guest activation is gated, and physical scanner acceptance is unverified. The target details below must not be marked complete until observed in an eligible future build.

## Target first-launch and first-check flow

- [ ] A fresh install in the scanner-first free build establishes the intended guest identity and lands on CHECK without account creation, sign-in, email/password, membership activation, long onboarding, baseline photos, or managed-routine setup. Hosted guest access remains gated until its separate lifecycle and abuse requirements are met.
- [ ] Start a Check with product-name search and barcode capture when available. Verify camera permission, cancel, retry, and back/reset behavior. If private front-label or ingredient evidence is enabled in the build, verify capture and private handling; do not claim that OCR or image recognition works.
- [ ] Show factual value before profile prompts: supported product identity, variant/package state, formula details only when exact evidence supports them, customer-safe provenance, and explicit unknowns. Unknown remains unknown; no universal score.
- [ ] Offer personalization only after factual value. It is optional; skipping it leaves factual Check useful. When supported context is added, refresh the same product result.
- [ ] When the customer chooses to personalize, capture decision intent: add something new, replace something already used, or check something already in use.
- [ ] Capture one primary goal and optional secondary goals, up to roughly three goals total. Goal examples include breakouts, dark/post-breakout marks, dryness/barrier, redness/sensitivity, texture, oiliness, or fine lines. Capture skin behavior and reactivity, plus treatment or sensitivity context when it can materially change the decision.
- [ ] Do not require routine-complexity preference during initial free personalization.
- [ ] Ask about pregnancy, trying to conceive, and breastfeeding/nursing just in time, only when materially relevant to the product decision. Keep the states distinct; unknown, unanswered, and withheld must never become “no.”
- [ ] **These profile details are target, not current behavior:** the existing free profile has a goals array, not a separate decision-intent or primary-goal field, and uses one pregnancy/nursing status field without a distinct trying-to-conceive state.
- [ ] Return a personal action, reason, and next step only when supported evidence permits it. The target preserves all material supported findings and applies a deterministic, versioned policy to select the action. Current runtime remains a narrower first-match Personal Fit implementation.
- [ ] Progressively capture routine context when useful. The approved target includes product, AM/PM/both/unknown, frequency, current/paused/stopped, and routine completeness. Preserve unknown values rather than assuming a complete routine.
- [ ] **This routine model is target, not current free history:** current free memory stores using/considering/stopped product state, checks, and reported experiences; it does not store the target schedule and completeness model.
- [ ] Keep formula facts separate from Personal Fit. Do not invent concentrations, diagnoses, or ingredient claims. A reported reaction is not proof of an ingredient allergy or causation. Do not infer race, ethnicity, ancestry, or Fitzpatrick.
- [ ] Verify profile edits, explicit Check-history saves, owner-switch clearing, identity linking, privacy, and deletion only on their corresponding implemented paths. Do not record credentials or sensitive disclosures.
- [ ] Verify the target CHECK / MY STUFF / PLAN / SHOP navigation and CHECK launch when available. Do not let Mock fixtures leak into a customer session.
- [ ] Never infer physical-device acceptance from simulator or export evidence.

## Beta release evidence required

Before broad scanner-first outreach, require supported factual results and safe unknown recovery, useful catalog coverage, hosted free access with explicit RLS and lifecycle/abuse review, a working private evidence fallback, a supported personal decision where context exists, and physical-device acceptance on the actual release candidate. Current privacy, support, and store information must match that binary. H1P is not required for factual Check or the current deterministic baseline fit. Do not create a build or public release as part of this documentation plan.

## Historical managed-first acceptance script

The following script records an earlier paid-first customer flow. It is preserved as historical evidence and must not be used as the acceptance spec for the future scanner-first binary.

**Purpose:** Verify that customer #1 can activate a $25/month Founding Beta membership, provide truthful intake data, and receive a reviewed skincare routine. Products are purchased separately. The first 10 members may receive manual founder care, but no step may invent product, formula, payment, or routine truth.

**Owner:** Kanuj, for the customer device journey and acceptance record. Sami owns hosted Auth, billing, intelligence, and founder operations. Record a backend blocker for Sami instead of changing that lane during this test.

**Current status:** This is a test script, not evidence that hosted Remote or live payment is ready. L1A signed-out physical-device preflight passed on Remote staging build `1.0.0 (5)`. H1A's password-auth script sessions are still unavailable through the customer UI. Provider/proposal/published-routine gates remain blocked under Sami's H1P and F1 work; real mobile OTP remains H1E and Stripe remains later H1B. Kanuj L1B/L1C consume those separate handoffs. See [HOSTED_REMOTE_SMOKE.md](HOSTED_REMOTE_SMOKE.md), [ROADMAP.md](ROADMAP.md) and [OWNERSHIP.md](OWNERSHIP.md).

## Choose the run before opening the app

| Run | Identity and money | What its result proves |
| --- | --- | --- |
| Mock development | Local Mock data. No real email OTP, Stripe charge, signed webhook, or hosted persistence. | Screen behavior and copy only. A Mock pass cannot clear a Remote or launch gate. |
| Remote core staging | Disposable authenticated identity and trusted service/admin staging entitlement after H1A project verification. No real email delivery or Stripe payment. | Backend post-auth smoke only until a supported mobile Auth path exists. Synthetic entitlement is never billing proof. |
| Remote provider staging | Dedicated test inbox and identity, real hosted six-digit OTP, Stripe test Checkout/webhook/Portal, hosted records and test photos after H1E/H1B readiness. | Email and billing lifecycles only for steps actually observed and recorded; F1 is additionally required to clear manual routine fallback. |
| Real-money customer launch | Production customer build, real member identity, live $25/month Stripe membership, real intake, and an operational founder response. | Customer #1 acceptance only after L2 prerequisites and the full customer path pass. Do not charge or enroll customer #1 based on Mock or test-mode evidence. |

For a guided usability session, let the person drive and prompt only after they are stuck for about 30 seconds. Observe hesitation and trust, but do not replace the checks below with an interview. Use a fresh account and clean app state; verify that no Arthur, demo, or other member data appears. Do not put names, OTPs, payment details, photos, or sensitive skin disclosures in the acceptance record.

## Preflight gates

- [ ] Record run type, build and revision, environment, device, date, tester role, and whether a real customer is involved. Confirm the build points to the intended environment. A TestFlight label alone does not prove Remote mode.
- [ ] For a Remote staging run, use the L0 `remote-staging` profile and read its staging-only diagnostics before sign-in: build flavor, Remote service mode, valid public configuration **shape**, expected hosted backend host and app version. Match the host against H1A's independently verified project. Never record or display the publishable key. An absent or wrong host blocks the run; a shape check alone is not proof of a live key.
- [ ] For a Remote core staging run, use H1A evidence for the exact hosted project, controlled script Auth/session, disposable entitlement, intake/Shelf/reaction snapshot, private photos, founder authorization and selected cross-user boundaries. Those script sessions do not authorize a password UI, token paste or other L1A mobile bypass. Record mobile post-auth, provider proposal, founder routine review/publication and published member reads as **Blocked** until exercised; H1P owns provider activation. Mark real email OTP and Stripe rows Not applicable, never passed. H1's old negative tests alone do not prove the active lifecycle.
- [ ] For Remote provider staging, require separate H1E real inbox OTP and H1B signed test Checkout/webhook/Portal evidence. Do not carry synthetic H1A entitlement forward as payment proof.
- [ ] For full manual-fallback acceptance, verify F1 can recover when automation produces no usable proposal: an authorized founder can construct, validate and publish a complete routine through the approved workflow. A controlled L1 core happy-path run may occur before F1, but it cannot clear the fallback or customer-launch gate.
- [ ] For L2, independently confirm production OTP/email, live Stripe price and webhook, founder operations, security checks, and a working customer contact path. Do not display or hand out an unverified support email, phone number, or URL.
- [ ] Have one known catalog barcode and one genuinely unknown product or barcode for Scan. Their identities must be independently known to the tester. Have products for manual Shelf entry and a safe, private space for baseline photos.

## Customer path

Mark each item **Pass**, **Fail**, **Blocked**, or **Not applicable** with a short observation. Do not mark an unrun Remote or launch step as passed because its Mock equivalent worked.

### 1. Sign in and activate membership, provider staging and launch runs

- [ ] Enter an email and receive a six-digit code in the intended inbox. Enter it on the phone and confirm the resulting account belongs to that identity. Record delivery and retry failures without copying the code.
- [ ] Before payment, confirm the membership screen explains **$25/month for Derive skincare management** and that routine products cost extra. A signed-in account without an active membership must not reach sensitive onboarding or the five member tabs.
- [ ] Open Stripe-hosted Checkout in the run's test or live mode. Confirm the trusted Checkout amount, recurring cadence, and account match the $25 membership. A cancelled or failed Checkout must leave access inactive.
- [ ] After successful Checkout, distinguish the return navigation from entitlement. The app may proceed only after the signed Stripe webhook projects canonical **active** membership and a fresh backend read confirms it. If confirmation is pending, show a recoverable pending state; do not unlock from the success URL or a local flag.

Mock development: inspect the membership explanation if exposed, but record Auth, charge, webhook, and entitlement checks as **Not applicable**. Never simulate a payment success and call it billing acceptance.

Remote core staging: H1A's disposable password-auth sessions and trusted server/admin entitlement are **script-only evidence**. The customer app cannot begin from those sessions; mobile post-auth checks are **Blocked** until H1E proves hosted six-digit OTP or another founder-approved customer Auth path. Once that path exists, a new disposable mobile session may use the trusted staging entitlement to test the core, while Checkout, webhook and Portal remain **Not applicable** until H1B. Never describe the fixture as a paid member or add a client Auth bypass.

### 2. Welcome, intake, and real Shelf

- [ ] Let the member complete goals, preference, skin behavior, reaction history, and safety questions. Check that skipped or withheld safety answers remain unknown rather than turning into "no." Note any confusing, coercive, or clinical-sounding language.
- [ ] At Shelf, photograph products if desired. Explain only that Derive will try to identify what it can and the member can review or add products. Do not promise automatic recognition of arbitrary bottles.
- [ ] Add a real product manually using the member's **brand, exact product name, and category**. Review it, edit each field, remove it, add it again, leave Shelf, and return. Confirm the entered identity remains correct. No canned Vanicream or other fixture may appear.
- [ ] Retake the Shelf photo and exercise an empty or failed recognition result. Confirm the manual product survives and recognized products, when present, can coexist without an obvious duplicate. Unknown ingredients, actives, formula, barcode, catalog verification, retailer, and price must remain unknown; a typed name alone does not establish them.
- [ ] Continue without automatic recognition. An unknown product is acceptable for this concierge beta if the customer can finish intake and the founder can work from truthful information. A dead end or fabricated match fails.

### 3. Baseline photos and submission

- [ ] Capture front, left, and right baseline photos. Check guidance, comfort, permission handling, retake, and manual shutter recovery if auto-capture does not work. Confirm the correct three photos are shown at review; do not claim a specific capture speed without observing it.
- [ ] At the summary, have the member recognize their goals, products, and safety answers and use an Edit link if needed. Confirm the $25 membership and separate product costs remain clear. Provider staging and launch require actual payment activation before intake; Remote core staging uses only its controlled test entitlement.
- [ ] Submit once, then verify the app's own completion state and hosted intake/photo records for a Remote run. A submission error must preserve the member's work and allow retry. Submission starts routine preparation; it does not prove that a proposal exists, is under founder review, or is active.

### 4. Routine preparation and founder handoff, Remote runs

- [ ] Observe whether an actual routine proposal is created and, if so, that its status is **awaiting review**. Verify the founder task belongs to an authorized founder, uses the submitted member data, and does not invent formula facts for manually entered products.
- [ ] Have the founder inspect safety context and product evidence, correct or reject unsafe or unsupported steps, then publish through the guarded workflow. Verify the published routine belongs to this member and the member app refreshes to it without reinstalling.
- [ ] If automatic preparation produces no usable proposal, record the core happy-path run as blocked and route the evidence to F1. For full manual-fallback acceptance, run F1 and confirm the founder can create, validate and publish the full routine in Derive. Until F1 is implemented and demonstrated, do not claim customer #1 can receive a routine after automation fails.
- [ ] Record who owns any manual follow-up and when the member should expect it. Do not show an "under review" or "ready" state unless the corresponding server state exists.

### 5. Five member tabs and Scan

The root navigation is **Today · Plan · Shop · Ask · Progress**. **Scan is inside Shop**, with a Today shortcut where shown; it is not a sixth tab. Check both pending and published states when the run can reach them.

| Surface | Acceptance observation |
| --- | --- |
| Today | Before publication, show a truthful preparation or draft state with no active routine, shipment, streak, or insight invented. After publication, show only the member's current steps and actual status. |
| Plan | The member can distinguish DRAFT · NOT ACTIVE from a published routine. Products match the submitted Shelf; actions and rationale do not assert unknown formula facts. |
| Shop | While a routine is unpublished, no active ADD purchase prompt. After publication, show only real plan needs or a calm covered state. Production currently has zero verified merchant listings; no fake retailer, live price, stock, physical checkout, order, or tracking claim. |
| Shop → Scan | Reach the scanner from Shop. A known, verified match may show identity and fit/formula verdicts supported by evidence. An unknown or unresolved product must show a recoverable unknown state, such as Scan Again, without an invented identity or verdict. Arbitrary visual product resolution is not a current acceptance assumption. |
| Scan → Ask | For a verified Scan result, the Ask handoff retains that product context. For an unknown result, Ask must not turn missing product facts into a confident match. |
| Ask | Ask a routine question and a safety-sensitive question. Check that ordinary answers use actual member context, uncertainty is stated where needed, and urgent symptoms take the safety path. A failed provider call must not be presented as a generated answer. |
| Progress | Show only the member's baseline and real check-in history. Try a weekly check-in when enabled; verify a truthful result and no fabricated comparison or learned insight. |

Open Orders & Refills from Shop or Profile if available. With no real order, the empty state must remain empty. A retailer page visit is not an order, and no managed refill or shipment should be shown without its actual record.

### 6. Billing lifecycle, provider staging and launch runs

- [ ] Open Manage Membership and the member's own Stripe Billing Portal in the run's mode. Verify that returning from the Portal does not itself alter membership state.
- [ ] In staging, use a safe supported pause or cancellation path and observe the signed webhook update. After refresh, the app must route the inactive member to Membership, clear managed client caches, and block onboarding and paid tabs. Historical ownership and account deletion follow their existing authorized boundaries.
- [ ] Verify any reactivation only through an actually supported billing path and another canonical active backend read. Do not infer reactivation from a Portal page or local state. For a real customer, exercise live cancellation only with the member's explicit intent; otherwise carry forward the proven staging result and mark the live action **Not applicable**.

## Close and record the result

Ask the participant: "In your own words, what is Derive?"; "What would make you trust this routine?"; "Where did you hesitate?"; and "At $25 per month, with products purchased separately, what would make this worthwhile?" Note time, unprompted questions, confusion, recovery attempts, and exact screen at failure. Do not record audio or identifying skin details for this script.

Record one outcome for each run:

| Result | Meaning |
| --- | --- |
| Pass | Every applicable check in this run was observed, with evidence for external boundaries. |
| Fail | An observed behavior violated a check; include reproduction and owner. |
| Blocked | A prerequisite or system path was unavailable, so the customer journey could not be completed. Name the missing gate and owner. |

Keep Mock, Remote core staging, Remote provider staging, and launch results separate. Customer #1 may be charged only after the final launch gate confirms the complete production path, including a real contact route and routine delivery when automation fails. Kanuj fixes customer/mobile defects in his lane; hosted Auth, billing, provider, product resolution, and founder-operation defects are recorded for Sami with evidence.
