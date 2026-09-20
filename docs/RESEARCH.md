# Derive Product, Clinical & Market Research

High-signal findings synthesized from founder research, customer discovery conversations, dermatological literature, and competitive teardowns.

## Commerce source policy (C1.5A direction)

Brand-direct and major trusted retailer product pages are first-class acquisition options when destination, product variant and formula equivalence can be supported. C1.5A has an empty production listing registry and a test-only Ulta example; exact brand/name and `isCatalogStandard` are insufficient activation evidence. C1.5B should prefer official merchant APIs, affiliate/product feeds, approved commerce networks and trusted providers for listing identity and verification, then current prices, availability and approved attribution. Verify each integration's current terms when that milestone opens. HTML scraping is a last-resort research fallback, not production commerce infrastructure. C1.5C plans a future Derive Shopify merchant. Merchant payout never changes product identity, formula verification or Scan/recommendation decisions.

---

## 1. Competitive Teardowns & Critical Lessons

### A. Yuka & OnSkin (The Hazard of Universal Scoring)
* **[FACT]**: Barcode scanning apps assign fixed 0–100 or green/red scores to products based on static ingredient databases.
* **[INFERENCE]**: These scores demonize safe formulations (e.g. parabens, phenoxyethanol, chemical UV filters) without considering dosage or skin barrier status.
* **[DERIVE TAKEAWAY]**: **Personalized fit beats universal scoring.** A product is not good or bad in isolation; fit depends on whether this specific user is acclimating to Differin, prone to clogged pores, or allergic to a known active.

### B. Skin Bliss (The Hazard of Feature Bloat & Optimization Theater)
* **[FACT]**: Skin Bliss surfaces 30+ skin metrics, full chemical encyclopedias, and pseudo-precise compatibility percentages (e.g. "87% match").
* **[INFERENCE]**: Users experience cognitive fatigue and anxiety. They do not know what bottle to open next.
* **[DERIVE TAKEAWAY]**: **Zero optimization theater.** No fake percentages or arbitrary scores. If skin is stable, Derive says: *"Everything looks on track. Keep your routine the same."*

### C. Curology (The Walled Garden & Care-Loop Lesson)
* **[FACT]**: Curology pioneered guided 3-angle photo submissions and provider oversight, but locks customers into a single proprietary custom bottle.
* **[INFERENCE]**: Customers resent being forced to discard beloved cleansers, sunscreens, and lip treatments.
* **[DERIVE TAKEAWAY]**: **Keep, Pause, Replace, Add.** Audit and preserve existing counter products that are working well; only suggest replacements where there is a clear gap or active conflict.

### D. Renude (The Retention & Cadence Warning)
* **[FACT]**: Routine services that enforce rigid automated shipping cadences see customer churn when bottles outlast the billing cycle.
* **[INFERENCE]**: Automatic depletion illusions destroy trust when a customer still has half a bottle left.
* **[DERIVE TAKEAWAY]**: **Managed Refills on demand.** Clear 1-tap replenishment: *"Running low? Tell us in one tap and we'll handle the rest."*

### E. GetHarley (High-Touch Concierge Benchmark)
* **[FACT]**: GetHarley connects clients with skin practitioners who curate medical-grade third-party products delivered directly to their door.
* **[INFERENCE]**: High-income customers willingly pay for curation, authentic third-party products, and continuous oversight.
* **[DERIVE TAKEAWAY]**: **Concierge service over cosmetics manufacturing.** Derive curates established dermatological brands (La Roche-Posay, CeraVe, Differin) and provides continuous reassurance.

---

## 2. Onboarding & Drop-Off Research

* **[FACT]**: Healthcare intake funnels lose 60–80% of users when they encounter 20+ continuous questions or manual text typing.
* **[INFERENCE]**: Capturing bathroom counter bottles via camera recognition drastically lowers intake friction compared to typing chemical names.
* **[DERIVE TAKEAWAY]**: Target completion under 4 minutes. Progressive disclosure (1 core decision per screen), instant shelf recognition with 1-tap confirmation, and camera permissions requested only at the photo stage with explicit privacy guarantees.

---

## 3. Founding Beta Learning Hypotheses (6 Core Success Questions)

The Founding Beta (10 paying members) is explicitly designed to test these learning hypotheses. The beta fails its primary purpose if it does not generate concrete qualitative and behavioral evidence against these questions.

**Implemented successor hypotheses (ADR-26 / I1-B4A):**

1. **VALUE**: Will a qualified customer pay **$25 recurring** for Derive management **independent of product cost**?
2. **BEHAVIOR**: Will members follow a Derive-managed routine?
3. **TRUST**: Will members accept KEEP / PAUSE / REPLACE / ADD / "don't buy this" recommendations?
4. **LONGITUDINAL**: Does accumulated history/context make Derive more useful over time?
5. **COMMERCE**: Will members buy/refill Derive-recommended products **through Derive** when products are separate transactions?
6. **RETENTION**: Will members voluntarily renew the Derive membership in Month 2?

**Historical $100 all-in hypotheses (SUPERSEDED as commercial framing; preserve as research history):** Will someone pay $100/mo including products to stop managing their own skincare? Does bundled fulfillment increase retention enough to justify operational complexity?

*Founder interpretation of N=31:* the student-heavy Wave 1 sample is an **acquisition/research convenience sample**, not evidence that the median student is Derive's ICP. Initial beta recruiting should favor people with an active skin concern, recent skincare experimentation/spend, meaningful uncertainty, and a desire to offload skincare management. Do not fabricate evidence. Preserve all N=31 methodology caveats below.

*Operating Rule*: Do not optimize for vanity engagement metrics (daily active opens, session duration) at the expense of evaluating these six core hypotheses.

---

## 4. Preliminary Customer-Discovery Evidence (N=31 Pilot / Wave 1)

### A. Methodology & Critical Sampling Caveats
- **Sample Nature**: Convenience sample of 31 respondents recruited primarily from a University of Wisconsin–Madison / Computer Science-heavy campus environment.
- **Demographic Bias**: The sample appears male-skewed and engineering-heavy.
- **Non-Representativeness**: This sample **MUST NOT** be described as representative of UW–Madison students, general skincare consumers, or the broader target market.
- **Survey Configuration Limitation (Q5 Multi-Select)**: Question 5 ("What is the most annoying part of taking care of your skin?") appears configured in the survey tool as multi-select despite the singular wording "most annoying." Percentages for Q5 reflect selections across respondents and are **not mutually exclusive**. Do not treat them as a single-choice distribution.
- **No Manufactured Statistical Significance**: Findings are directional pilot signals only.

### B. Directional Findings (Wave 1 Pilot, N=31)
- **Baseline Skincare Habit**:
  - **71.0%** use 0–2 skincare products at least weekly.
  - **74.2%** spent under $50 total on skincare in the previous 3 months.
- **Friction & Product Regret**:
  - **45.2%** stopped using or regretted at least one skincare product purchase in the past 6 months.
- **Reported Friction Areas (Q5, Multi-Select)**:
  - **35.5%** selected *"I don't really have a skincare problem"*.
  - **32.3%** selected uncertainty about whether their routine is actually working.
  - **25.8%** selected uncertainty about which products are right for their skin.
  - **25.8%** selected spending too much money on products.
- **Single Most Valuable Handled Function (Single-Choice Question)**:
  - **22.6%** chose *tracking whether skin is improving over time*.
  - **16.1%** chose *building/managing their routine*.
  - **16.1%** chose *adjusting the routine based on skin response*.
  - **9.7%** chose *evaluating whether a new product fits before buying*.
  - **6.5%** chose *personalized answers to skincare questions*.
  - **~3.2%** chose *knowing what to keep, pause, replace, or add*.
  - **0.0%** chose *refill handling / replenishment*.
  - **25.8%** chose *none of these*.
- **Aggregate Signal**:
  - **54.8%** of the total sample chose one of **build/manage routine + adapt based on response + progress tracking** as the single most valuable handled function.
  - Open-ended qualitative responses highlighted routine simplicity, understanding what skin genuinely needs, information reliability, and more visible skin results.

### C. Interpretation & Strategic Implications
- **Primary Positioning Wedge**: Directional evidence favors positioning longitudinal management, routine adaptation, and progress tracking over treating Scan (in-store lookup) or fulfillment as the primary customer acquisition hook.
- **Preserve Scan & Fulfillment**: Do **NOT** remove Scan or managed refills based on N=31. While replenishment is not an initial acquisition hook for low-involvement users, physical product delivery and reliable replenishments may be decisive drivers of month-two retention and service defensibility once a member is active.
- **Expanded Research Plan**:
  - Treat the first 31 responses as **Wave 1 / pilot**.
  - Continue toward 50–100 customer discovery conversations with a more diverse campus intercept sample (campus libraries, student unions, non-CS majors, balanced gender mix).

---

## 5. Dermatological Evidence Architecture & Peer-Reviewed References

Derive strictly adheres to an evidence-grounded recommendation policy. We distinguish methodological study strength from individual member applicability.

### A. Evidence Hierarchy
1. **Member's Direct Longitudinal History**: Observed past reactions, verified tolerances, active prescription schedules.
2. **Member's Confirmed Phenotype Context**: Verified shade depth, undertone, PIH tendency, curl pattern, razor bump history.
3. **High-Grade Clinical Research (Grade A/B)**: Methodologically sound trials that directly match member applicability criteria.
4. **Contextual / Mechanistic Literature (Grade C)**: Observational studies informing Ask education, but forbidden from silently altering active routine steps.
5. **Preliminary / Anecdotal Data (Grade D)**: Excluded from driving any product or routine behavior.

### B. Peer-Reviewed Citations & Dermatological Guidance
1. **Visible-Light / Iron-Oxide Melasma Randomized Trial (Grade A)**:
   - *Castanedo-Cazares JP, et al.* Photodermatol Photoimmunol Photomed. 2014;30(1):35-42.
   - [PubMed 24313385](https://pubmed.ncbi.nlm.nih.gov/24313385/)
   - *Finding*: Mineral sunscreens fortified with iron oxides blocking High-Energy Visible (HEV) / blue light significantly reduce hyperpigmentation relapses in darker phototypes compared to standard broad-spectrum UV filters alone.
2. **AAD Clinical Guidance on Fading Dark Spots & PIH (Grade B)**:
   - *American Academy of Dermatology Association.* [AAD Routine Secrets: Fade Dark Spots](https://www.aad.org/public/everyday-care/skin-care-secrets/routine/fade-dark-spots)
   - *Finding*: Daily broad-spectrum SPF 30+ photoprotection is mandatory for preventing post-inflammatory hyperpigmentation marks from darkening. Minimized irritation is paramount; aggressive exfoliation exacerbates pigment deposition.
3. **AAD Sunscreen Labeling & Mineral Guidance (Grade B)**:
   - *American Academy of Dermatology Association.* [AAD Sunscreen Labels](https://www.aad.org/public/everyday-care/sun-protection/shade-clothing-sunscreen/understand-sunscreen-labels)
4. **Pseudofolliculitis Barbae Pathophysiology & Management (Grade B)**:
   - *Ogunbiyi A.* Clinical review of PFB. [PMC12360796](https://pmc.ncbi.nlm.nih.gov/articles/PMC12360796/)
   - *Finding*: PFB is driven by mechanical hair curl pattern and close-shaving transfollicular/extrafollicular penetration, not race. Managed through shaving mechanics, barrier maintenance, and gentle keratolytics.
5. **Race, Ethnicity, and Skin Color Terminology in Dermatology (Methodological Consensus)**:
   - *Lester JC, et al.* JAAD. 2023. [PubMed 37328613](https://pubmed.ncbi.nlm.nih.gov/37328613/)
   - *Rule*: Race and ethnicity are social and political constructs, not biological proxies for cutaneous physiology or cosmetic formulation matching.
6. **Skin-Color Assessment in Dermatology (Clinical Review)**:
   - *Venkatesh S, et al.* Br J Dermatol. 2024. [PubMed 38342247](https://pubmed.ncbi.nlm.nih.gov/38342247/)
   - *Finding*: Reviews limitations of subjective visual scales; stresses explicit provenance and member confirmation over arbitrary colorimetric categorization.
7. **Limitations of Uncontrolled Image-Derived Skin-Typing (Algorithmic Fairness)**:
   - *Groh M, et al.* [PMC13459198](https://pmc.ncbi.nlm.nih.gov/articles/PMC13459198/)
   - *Finding*: Uncalibrated smartphone ambient lighting introduces significant error in automated phototype estimation. Camera estimates must be provisional, confidence-scored, and confirmable by the user.
8. **Diverse Dermatology Images & Machine Learning Disparities (Algorithmic Bias)**:
   - *Daneshjou R, et al.* Nat Med. 2022;28(8):1576-1581. [PubMed 35960806](https://pubmed.ncbi.nlm.nih.gov/35960806/)
   - *Finding*: Demonstrates severe performance drops of dermatological models on underrepresented skin tones. Proves necessity of evaluating visual algorithms across stratified pigmentation groups.
9. **Observational Association Between Dairy and Acne (Grade C - Educational Only)**:
   - *Aghasi M, et al.* Clin Nutr. 2018;38(3):1067-1077. [PubMed 30096883](https://pubmed.ncbi.nlm.nih.gov/30096883/)
   - *Rule*: Meta-analysis shows weak observational correlation; no randomized controlled trial evidence. Must NOT be converted into causal individual rules or automated diet interventions.
