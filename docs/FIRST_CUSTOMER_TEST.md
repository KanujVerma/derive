# Derive: First Customer Acceptance Script

**Purpose:** Verify that customer #1 can activate a $25/month Founding Beta membership, provide truthful intake data, and receive a reviewed skincare routine. Products are purchased separately. The first 10 members may receive manual founder care, but no step may invent product, formula, payment, or routine truth.

**Owner:** Kanuj, for the customer device journey and acceptance record. Sami owns hosted Auth, billing, intelligence, and founder operations. Record a backend blocker for Sami instead of changing that lane during this test.

**Current status:** This is a test script, not evidence that hosted Remote or live payment is ready. H1 hosted activation and the F1 founder fallback must be proven before L1 physical-device acceptance. L2 is the separate real-money launch gate. See [ROADMAP.md](ROADMAP.md) and [OWNERSHIP.md](OWNERSHIP.md).

## Choose the run before opening the app

| Run | Identity and money | What its result proves |
| --- | --- | --- |
| Mock development | Local Mock data. No real email OTP, Stripe charge, signed webhook, or hosted persistence. | Screen behavior and copy only. A Mock pass cannot clear a Remote or launch gate. |
| Remote staging, Stripe test mode | Dedicated test identity and inbox, hosted six-digit email OTP, Stripe test Checkout and Portal, hosted records, test photos. | End-to-end hosted lifecycle only for steps actually observed and recorded. Complete H1 smoke first; keep real customer data and live charges out of this run. |
| Real-money customer launch | Production customer build, real member identity, live $25/month Stripe membership, real intake, and an operational founder response. | Customer #1 acceptance only after L2 prerequisites and the full customer path pass. Do not charge or enroll customer #1 based on Mock or test-mode evidence. |

For a guided usability session, let the person drive and prompt only after they are stuck for about 30 seconds. Observe hesitation and trust, but do not replace the checks below with an interview. Use a fresh account and clean app state; verify that no Arthur, demo, or other member data appears. Do not put names, OTPs, payment details, photos, or sensitive skin disclosures in the acceptance record.

## Preflight gates

- [ ] Record run type, build and revision, environment, device, date, tester role, and whether a real customer is involved. Confirm the build points to the intended environment. A TestFlight label alone does not prove Remote mode.
- [ ] For a Remote staging run, use the L0 `remote-staging` profile and read its staging-only diagnostics before sign-in: build flavor, Remote service mode, valid public configuration, expected hosted backend host and app version. Match the host against H1A's independently verified project. Never record or display the publishable key. An absent or wrong host blocks the run.
- [ ] For Remote staging, use H1 hosted smoke evidence for OTP, signed test Checkout webhook, active membership, private photos, real provider call, founder review and publication, member reads, cross-user boundaries, and Portal downgrade. Recheck any changed boundary on the device. H1's existing negative tests alone do not prove the active lifecycle.
- [ ] For L1, verify that F1 can recover when automatic routine preparation yields no usable proposal: an authorized founder can construct, validate, and publish a complete routine through the approved workflow. If that path is unavailable, mark the test blocked; a promise to handle it manually outside Derive is not a passing app flow.
- [ ] For L2, independently confirm production OTP/email, live Stripe price and webhook, founder operations, security checks, and a working customer contact path. Do not display or hand out an unverified support email, phone number, or URL.
- [ ] Have one known catalog barcode and one genuinely unknown product or barcode for Scan. Their identities must be independently known to the tester. Have products for manual Shelf entry and a safe, private space for baseline photos.

## Customer path

Mark each item **Pass**, **Fail**, **Blocked**, or **Not applicable** with a short observation. Do not mark an unrun Remote or launch step as passed because its Mock equivalent worked.

### 1. Sign in and activate membership, Remote runs

- [ ] Enter an email and receive a six-digit code in the intended inbox. Enter it on the phone and confirm the resulting account belongs to that identity. Record delivery and retry failures without copying the code.
- [ ] Before payment, confirm the membership screen explains **$25/month for Derive skincare management** and that routine products cost extra. A signed-in account without an active membership must not reach sensitive onboarding or the five member tabs.
- [ ] Open Stripe-hosted Checkout in the run's test or live mode. Confirm the trusted Checkout amount, recurring cadence, and account match the $25 membership. A cancelled or failed Checkout must leave access inactive.
- [ ] After successful Checkout, distinguish the return navigation from entitlement. The app may proceed only after the signed Stripe webhook projects canonical **active** membership and a fresh backend read confirms it. If confirmation is pending, show a recoverable pending state; do not unlock from the success URL or a local flag.

Mock development: inspect the membership explanation if exposed, but record Auth, charge, webhook, and entitlement checks as **Not applicable**. Never simulate a payment success and call it billing acceptance.

### 2. Welcome, intake, and real Shelf

- [ ] Let the member complete goals, preference, skin behavior, reaction history, and safety questions. Check that skipped or withheld safety answers remain unknown rather than turning into "no." Note any confusing, coercive, or clinical-sounding language.
- [ ] At Shelf, photograph products if desired. Explain only that Derive will try to identify what it can and the member can review or add products. Do not promise automatic recognition of arbitrary bottles.
- [ ] Add a real product manually using the member's **brand, exact product name, and category**. Review it, edit each field, remove it, add it again, leave Shelf, and return. Confirm the entered identity remains correct. No canned Vanicream or other fixture may appear.
- [ ] Retake the Shelf photo and exercise an empty or failed recognition result. Confirm the manual product survives and recognized products, when present, can coexist without an obvious duplicate. Unknown ingredients, actives, formula, barcode, catalog verification, retailer, and price must remain unknown; a typed name alone does not establish them.
- [ ] Continue without automatic recognition. An unknown product is acceptable for this concierge beta if the customer can finish intake and the founder can work from truthful information. A dead end or fabricated match fails.

### 3. Baseline photos and submission

- [ ] Capture front, left, and right baseline photos. Check guidance, comfort, permission handling, retake, and manual shutter recovery if auto-capture does not work. Confirm the correct three photos are shown at review; do not claim a specific capture speed without observing it.
- [ ] At the summary, have the member recognize their goals, products, and safety answers and use an Edit link if needed. Confirm the $25 membership and separate product costs remain clear. In Remote, payment should already have been activated before this intake.
- [ ] Submit once, then verify the app's own completion state and hosted intake/photo records for a Remote run. A submission error must preserve the member's work and allow retry. Submission starts routine preparation; it does not prove that a proposal exists, is under founder review, or is active.

### 4. Routine preparation and founder handoff, Remote runs

- [ ] Observe whether an actual routine proposal is created and, if so, that its status is **awaiting review**. Verify the founder task belongs to an authorized founder, uses the submitted member data, and does not invent formula facts for manually entered products.
- [ ] Have the founder inspect safety context and product evidence, correct or reject unsafe or unsupported steps, then publish through the guarded workflow. Verify the published routine belongs to this member and the member app refreshes to it without reinstalling.
- [ ] If automatic preparation produces no usable proposal, run the F1 manual founder fallback. Confirm the founder can create, validate, and publish the full routine in Derive. Until F1 is implemented and demonstrated, record **Blocked** here and do not claim customer #1 can receive a routine.
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

### 6. Billing lifecycle, Remote runs

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

Keep Mock, Remote staging, and launch results separate. Customer #1 may be charged only after L2 confirms the complete production path, including a real contact route and routine delivery when automation fails. Kanuj fixes customer/mobile defects in his lane; hosted Auth, billing, provider, product resolution, and founder-operation defects are recorded for Sami with evidence.
