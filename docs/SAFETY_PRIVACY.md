# Derive Safety & Privacy Architecture

Derive operates under uncompromising safety and privacy standards appropriate for handling sensitive consumer health information.

---

## 1. Clinical Scope & Medical Boundaries
* **Cosmetic Guidance Only**: Derive advises on over-the-counter skincare routines, skin barrier maintenance, and cosmetic product compatibility.
* **No Medical Diagnosis**: Derive does NOT diagnose skin diseases (e.g. atopic dermatitis, cystic acne, rosacea, melanoma, psoriasis).
* **Emergency Escalation Circuit Breaker**:
  Any input mentioning acute or dangerous symptoms triggers an immediate hard stop:
  - Facial or eye swelling
  - Respiratory distress or throat tightness
  - Severe blistering rash with yellow oozing or pus
  - Rapidly spreading hot hives
  When detected, Derive presents clear, unskippable medical referral copy advising immediate in-person evaluation at an urgent care center or emergency room.

---

## 2. Customer Health Data & Private Photos
* **Private Photo Storage**: All customer skin photos are stored in private Supabase Storage buckets with public read disabled.
* **Zero Public URLs**: Photos are NEVER accessible via static public URLs. They are served to authenticated client sessions exclusively via short-lived signed URLs (15-minute validity).
* **Zero Model Training**: Customer photos, symptom descriptions, and conversation histories are never used for public model training or third-party data broker sharing.
* **Data Deletion**: Complete deletion requests delete all photos from storage, wipe profile records, and purge conversation logs.

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
