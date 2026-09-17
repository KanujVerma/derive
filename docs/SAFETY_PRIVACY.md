# Derive Safety & Privacy Architecture

Derive operates under uncompromising safety and privacy standards appropriate for handling sensitive consumer health information.

---

## 1. Clinical Scope, Medical Boundaries & Trust Language

* **Cosmetic Guidance Only**: Derive advises on over-the-counter skincare routines, skin barrier maintenance, and cosmetic product compatibility.
* **No Medical Diagnosis**: Derive does NOT diagnose skin diseases (e.g. atopic dermatitis, cystic acne, rosacea, melanoma, psoriasis).
* **Emergency Escalation Circuit Breaker**:
  Any input mentioning acute or dangerous symptoms triggers an immediate hard stop:
  - Facial or eye swelling
  - Respiratory distress or throat tightness
  - Severe blistering rash with yellow oozing or pus
  - Rapidly spreading hot hives
  When detected, Derive presents clear, unskippable medical referral copy advising immediate in-person evaluation at an urgent care center or emergency room.

### Customer-Facing Trust & Safety Language Standards
Derive maintains strict integrity in all customer communications.
- **Authorized Slogans & Framing**:
  - Preserve: *"Your skincare, handled."*
  - Routine Verification: *"Your first routine gets one final quality check before it goes live."*
- **Strictly Prohibited Claims**:
  - **No AI Dermatologist**: Never claim or imply that Derive is an "AI dermatologist," clinical diagnostic device, or medical provider.
  - **No Unsubstantiated Clinical Review**: Never claim "dermatologist reviewed" or "clinically reviewed" unless literally true for that specific formulation or feature.
  - **No Photo Diagnosis**: Photos are visible baseline/progress context only; never claim disease diagnosis from imagery.
  - **No Pseudo-Quantitative Measurements**: Never claim exact quantitative skin-barrier, hydration, or sebum percentages from smartphone selfies.
  - **No False Causal Allergy Inferences**: Never infer a causal ingredient allergy from a single multi-ingredient reaction event.
  - **No Guaranteed Outcomes**: Never promise guaranteed clearing, cure, or clinical results.
  - **No Unheld Credentials**: Never claim clinical or dermatological licenses the founders do not hold.
  - **No Permanent Founder Consultation Promise**: Never market unlimited personal founder consultations as the scalable product.
  - **No Premature Regulatory Claims**: Never claim HIPAA or GDPR compliance until formally audited and certified; do not claim secure resumability until fully implemented.

---

## 2. Customer Health Data, Private Photos & Biometric Invariants

* **Sensitive Skincare Data**: Skin photos, reaction notes, and tolerance logs are treated as private, sensitive consumer skincare data. They are never uploaded to public buckets or exposed in telemetry.
* **Photo Capture Quality vs. Biometrics**:
  - Camera quality gating during intake evaluates **photographic capture quality only** (single face presence, pose/orientation, face distance, centering, lighting/exposure, sharpness, stability).
  - **Zero Persistent Biometrics**: Derive strictly prohibits generating or storing persistent face embeddings, facial recognition models, or biometric identity templates.
* **Private Photo Storage (S1A Enforced)**: `customer-skin-photos` is provisioned with `public = false`, a 10 MiB limit, and an image MIME allowlist. Authenticated uploads are isolated under a first path segment equal to the caller's immutable Auth UUID.
* **Zero Public or Direct Customer Reads (S1A Enforced)**: Customers can create immutable objects only under their Auth UUID namespace, but cannot list, download, sign, replace, or delete objects directly. The next S1 slice must add a trusted JWT-bound endpoint that issues 15-minute signed URLs; until it exists, the live signed-photo delivery path is not complete.
* **Immutable Uploads**: The bucket has no authenticated `UPDATE` policy. Clients must use unique opaque filenames and `upsert: false` so a later capture cannot silently overwrite an earlier longitudinal record.
* **Zero Model Training**: Customer photos, symptom descriptions, and conversation histories are never used for public model training or third-party data broker sharing.
* **Data Deletion Contract**: A complete deletion must first remove every object through the Supabase Storage API, then remove relational/auth records, and finally purge any conversation data that exists. Customers deliberately lack independent blob or photo-metadata deletion rights because partial client workflows can orphan one side. This orchestration is still an S1 implementation requirement and must not be represented as automated until the endpoint is shipped and tested; existing signed URLs may remain valid only until their maximum 15-minute expiry.

---

## 3. Privacy-Safe Analytics Guardrails
* **Session Replay Disabled**: PostHog session replay is strictly disabled (`disable_session_recording: true`) to prevent capturing user photos or typed text.
* **Allowlisted Events Only**: The mobile client can only dispatch events in the typed analytics catalog:
  `onboarding_started`, `onboarding_stage_completed`, `onboarding_completed`, `today_viewed`, `routine_viewed`, `checkin_completed`, `refill_requested`, `scan_tab_opened`, `product_scan_recognized`, `scan_verdict_viewed`, `scan_ask_handoff`, `voice_input_started`, `voice_input_completed`.
* **Zero Health Data in Telemetry**: Symptoms, diagnoses, photo URLs, full chat transcripts, and personal notes must NEVER be included in analytics properties.

---

## 4. Reaction History vs. Clinical Allergies
* **Evidence vs. Diagnosis**: A recorded past reaction to a product is treated as an *adverse tolerance signal*, never as a clinical medical allergy diagnosis unless confirmed by a physician.
* **Severity vs. Confidence Separation**:
  - **Reaction Severity**: What the customer experienced (`mild`, `moderate`, `severe`, `unknown`).
  - **Signal Confidence**: Derive's probabilistic inference (`weak_signal`, `suspected_sensitivity`, `strong_signal`, `confirmed_allergy`).
  - A severe burn from a single product yields `severity: 'severe'`, but the ingredient confidence remains `weak_signal` until repeated overlap is observed.
* **Tolerated Exposure Discounting**: If an ingredient appears in an adverse product but is also present in two well-tolerated daily products (e.g. CeraVe Cleanser + Toleriane Moisturizer), Derive discounts naive suspicion.
* **No Universal Blacklists**: Derive never applies pseudoscience blacklists (e.g. banning all silicones, chemical UV filters, or emulsifiers). Every evaluation is grounded in this specific customer's observed tolerance.

---

## 5. Model Credentials
* **Server-only Gemini**: Live Gemini API keys belong in the trusted Supabase/server environment. They must never be shipped in the Expo client or prefixed as public client variables.
* The mobile app reaches intelligence only through `IDeriveService`. Local/mock paths stay deterministic.

---

## 6. Phenotype Non-Discrimination & Algorithmic Fairness

* **Never Race-Aware**: Derive does NOT use race, ethnicity, or ancestry as skincare decision rules.
  - Hard prohibitions: No race classifiers, no ethnicity classifiers, no ancestry inference from imagery, no demographic recommendation rules (e.g. "Black -> product X", "Indian -> avoid ingredient Y").
  - Biological attributes (observable pigmentation family, undertone, post-inflammatory response, hair curl pattern) are distinct from social and political constructs of race and ethnicity (*Lester et al. JAAD 2023*).
* **Zero CV Colorimetry in V1**: No computer vision colorimeters, Fitzpatrick ML classifiers, or skin-quality scoring algorithms exist in the production client.
* **Confirmation Invariant**: Any future approximate photo estimate must carry explicit provenance (`source: 'photo_estimate'`), categorical confidence (`low` | `medium` | `high`), and MUST be overridden whenever a member confirms or corrects their profile (`setOrConfirmPhenotypeValue`). Unconfirmed estimates cannot overwrite confirmed truth.
* **Visual Fairness Across Pigmentation Strata**: In accordance with algorithmic bias research (*Daneshjou et al. Nat Med 2022*), any computer vision system evaluated in Derive must demonstrate balanced error parity across all pigmentation strata (very light through very deep).
* **Mechanism Over Demographics (PFB)**: Pseudofolliculitis barbae is addressed strictly through mechanical shaving practices, hair curl pattern, and follicular dynamics—never racial profiling (*Ogunbiyi PMC12360796*).
* **No Causal Diet Interventions**: Weak population observational associations (such as dairy and acne, *Aghasi et al. 2018*) must never be converted into automated diet interventions or causal rules.
