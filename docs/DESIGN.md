# Derive design: Direction A / Mineral

## Current scanner-first contract

Derive should help a person answer “Should I use this product?” before asking for optional context. Use warm ivory canvas, mineral-white content, dark ink and restrained Mineral green. Functional titles, labels, inputs and actions use system sans-serif. Existing managed-first references below are historical; they do not prescribe today's navigation, material implementation or questionnaire.

Keep Check home minimal: shared mark/title/Account header, Open camera, name search, separate product-link input and intentional whitespace. Current root tabs are Check, My Stuff, Plan and Shop. Account is a Back subpage. Preserve the accepted Managed Early Access offer, $25/month display hypothesis, products purchased separately and honest canonical waitlist state. Changing tabs, offers, prices or entitlements requires a product decision.

Consistency means the same role follows the same rule. Primary and secondary actions intentionally differ. Brand green identifies action/selection or a restrained offer eyebrow; it does not establish a favorable skincare finding. No universal score, decorative badge, filler, emoji or customer-copy em dash.

## Semantic type and color

| Role | Style | Rule |
| --- | --- | --- |
| Root/page title | System sans, 26/32, bold, ink | Reuse ScreenHeader/RootShellHeader and shared mark. |
| Section heading | System sans, 13/18, semibold, inkMuted | Sentence case outside grouped content; optional adjacent action. No automatic uppercase or green status inference. |
| Question | System sans, 17/24, medium, ink | Reuse QuestionGroup; necessary support remains readable below it. |
| Body / row title | 15/22 or 17/24, ink | Size follows reading task and hierarchy; wrap long names. |
| Necessary support / uncertainty | 13/18, inkMuted | Never use inkSubtle for necessary instructions, caution, errors or privacy explanations. |
| Primary action | Mineral green, inverse text, at least 44pt | One obvious action per state; preserve meaningful secondary actions. |
| Caution / error | Existing semantic alert color plus explicit text | Always include meaning in words, independent of color or payment. |

`src/constants/theme.ts` is the actual palette. `textStyles` and `rhythm` are the shared semantic exports. Existing serif/mono tokens remain for historical consumers; this pass introduces no serif functional UI.

## Spacing and anatomy

| Relationship | Token / points | Owner |
| --- | --- | --- |
| Title to support | rhythm.titleToSupport / 8 | Header/group |
| Question label to content | rhythm.labelToContent / 8 | QuestionGroup; no child top margin |
| Related controls | rhythm.relatedControls / 12 | Control group |
| Related rows | rhythm.relatedRows / 16 | List/group |
| Card padding | rhythm.cardPadding / 20 | Content surface |
| Root/content gutter | rhythm.screenGutter / 24 | Screen/header |
| Major transition | rhythm.majorTransition / 32 | Parent composition |

Spacing is applied once per relationship. Do not combine a label bottom margin with a chip-group top margin. Content groups own their gaps; embedded GroupedSection removes its default enclosing card and margin. Over-camera and narrow contextual overlays may use 16pt gutters deliberately, while their internal rows follow the same type and control rules.

SectionHeader provides a persistent section action such as “+ Add” with explicit Add product/Add experience accessibility label and at least a 44pt target. An empty section does not duplicate that action in another card. Rows distinguish a title, necessary supporting metadata, and a real action. Decorative chevrons are omitted when no navigation exists. ChoiceChip announces radio for a single choice and checkbox for multiple choice; all sizes remain at least 44pt tall. SelectionRow embedded mode avoids nested bordered cards.

CatalogProductSearch has an embedded variant for sheets/editors, so a search inside a grouped surface does not create another card. Its keyboard submit uses the same request gate as debounce. Contextual selection preserves query/results and supports focus restoration; existing additive consumers retain their default clear-after-add behavior.

## Results and context

Identity, Personal Fit or the actual limitation, essential reason/caution and relevant action come before optional Formula Details and source depth. These roles need coherent hierarchy, not identical cards. Critical cautions and meaningful unknowns remain visible at every sheet detent. Unknown identity, missing exact formula, missing context, unsupported rule, service failure, unacknowledged save and preview incapability remain distinct. Additional profile answers never repair missing formula evidence or unsupported science.

Reuse shared result content for contextual camera/search/link surfaces and later full detail. Dismiss restores the originating scanner or query/list/scroll/focus. Tab switches retain valid state. Profile editing retains the same owner/product/case and refreshes only after canonical acknowledgment. Saved historical results require immutable owner-bound detail; current reassessment is a separately labeled action.

Profile setup remains optional. Use an explicit main priority and progressive secondary goals, plain self-reported skin-feel wording, and separate reactivity. Collect treatment/sensitivity/reproductive context only at supported triggers. Blank, unsure, withheld and explicit no remain distinct where the actual contract supports them. My Stuff provides Skin profile, Your products, Check history and Your experience, with creation actions where supported. A saved/considering product does not become current routine context, and a reported reaction does not become a proven allergy.

## Materials and accessibility

| Surface | Treatment |
| --- | --- |
| Floating navigation/controls with content behind | GlassContainer material=chrome when actual module, API and compiled runtime support it. |
| Reading, questionnaire, formula and result content | Mineral-white surface; GlassContainer material=content is opaque. |
| Unsupported runtime or Reduce Transparency | Opaque readable light/dark Mineral fallback. No availability claim from module import alone. |
| Rounded controls | Native surface and boundary follow the caller's actual radius; optional border can be omitted. |

The existing expo-glass-effect package is sufficient. Camera-local BlurView plus tint is a different implementation, owned by Sami's active capture lane; coordinate its semantic alignment rather than replacing the scanner. GlassContainer explicitly observes Reduce Transparency. No motion is required to understand shared primitives; animated consumers must honor Reduce Motion and provide tap/accessible alternatives. Check long names, larger text, small/large screens, contrast, keyboard, safe area, scroll versus drag and VoiceOver on actual UI.

Native tabs are evaluated only in an isolated compatibility prototype. Existing Router/navigation remains until state retention, legacy/target shell behavior, access-driven routes, insets, modal/camera presentation and physical accessibility are proven. A material correction does not authorize a navigation migration.

See [the 2026-09-29 decision and question matrix](ux/UX_CONSISTENCY_2026_09_29.md) for inspected consumers, deferred authority gaps and acceptance gates. [Expo glass](https://docs.expo.dev/versions/latest/sdk/glass-effect/) documents runtime/accessibility checks; [Apple materials](https://developer.apple.com/design/human-interface-guidelines/materials) supplies the platform design anchor. Neither source proves Derive's runtime or clinical accuracy.

---

The reference below preserves earlier managed-first design guidance, including obsolete five-tab and display-serif rules. The current contract above and actual source take precedence.

## Historical managed-first design reference

Derive's visual language is modeled on Apple-grade minimalism and quiet luxury. It conveys calm, architectural precision rather than clinical coldness or frantic gamification.

---

## Obvious-by-default consumer UX

> **Complexity belongs behind the interface.** Derive may use sophisticated evidence, personalization, catalog, and decision systems internally, but a customer should not have to understand them to use the product.

- Design for first-time use without explanation or technical/skincare expertise.
- Support a broad consumer age range, including older adults, without gender stereotypes.
- Use plain consumer language, keep backend terminology out of primary flows, and present one clear primary action whenever possible.
- Keep visible choices to a minimum.
- Prefer progressive disclosure and minimal reading/setup before first value.
- Do not make technical camera modes the default.
- Use automatic behavior only when it stays truthful; when uncertain, ask one simple clarification.
- Keep manual correction as recovery or optional depth, with clear Back, Close, and Retry paths.
- Keep touch targets at least 44pt and layouts readable across supported text sizes and smaller screens.
- Avoid unnecessary cards, chips, settings, explanations, and choices.
- Yuka is a simplicity and first-value reference, not a visual clone or source of Derive's truth model.

## 1. Color Palette Tokens (`src/constants/theme.ts`)

| Token | Hex | Role | Contrast Ratio |
| :--- | :--- | :--- | :--- |
| **Canvas** | `#F6F3EC` | Warm ivory background | 1.0 : 1 |
| **Surface** | `#FFFEFB` | Clean mineral card surface | 1.1 : 1 vs canvas |
| **Ink** | `#171A18` | Deep architectural charcoal for primary text | **12.4 : 1** (Passes AAA) |
| **Muted** | `#626760` | Secondary metadata, dates, dosage | **4.8 : 1** (Passes AA) |
| **Brand Accent** | `#345447` | Deep architectural mineral green for primary CTAs | **6.8 : 1** on white |
| **Sage Tint** | `#E2EAE4` | Selected state backgrounds & badge fills | N/A (Decorative fill) |
| **Hairline** | `#EAE5DC` | Subtle boundary lines replacing heavy borders | N/A (Structural divider) |

### Action Badges (Counter Audit & Status)
* **KEEP**: Mineral green (`#345447` text on `#E2EAE4` pill)
* **PAUSE**: Soft amber slate (`#8A6B2D` text on `#FBF4E6` pill)
* **REPLACE**: Warm bronze (`#8A4B2D` text on `#FBEFE6` pill)
* **ADD**: Slate mineral (`#2D6B8A` text on `#E6F4FB` pill)
* **REVIEW**: Warm antique ochre (`#8C6D3B` text on `#FBF6EE` pill, border `#E8DCB8`)

---

## 2. Typography
* **Display / Brand**: Restrained serif display (`New York` or serif fallback) for warm, dignified titles (e.g. "Good evening, Arthur", "Your skincare, handled").
* **Functional / UI**: System sans-serif (`SF Pro` / iOS System Sans) for all labels, dosages, navigation, schedules, and button actions.
* **Weights**: Regular (400), Medium (500), Semibold (600).
* **Rules**: Zero emojis across the entire user experience. Use native SF Symbols exclusively.

---

## 3. Materials & Liquid Glass
* **Restrained Liquid Glass**: Used for floating chrome (tab bar, top navigational header, composer capsule).
* **Blur Intensity**: `intensity={40}` to `60` with warm ivory tint overlay (`rgba(246, 243, 236, 0.85)`).
* **Hairline Boundary**: 1px subtle stroke (`#EAE5DC`) separating glass elements from scroll content.
* **Accessibility**: When iOS "Reduce Transparency" is enabled in system settings, glass blurs fall back gracefully to opaque `#FFFEFB` surfaces.

---

## 4. Tactile & Haptic System
* **Button Presses**: Light impact haptic (`impactAsync(ImpactFeedbackStyle.Light)`).
* **Stage Completion**: Medium impact haptic (`impactAsync(ImpactFeedbackStyle.Medium)`).
* **Voice Dictation Start/Stop**: Rigid impact (`impactAsync(ImpactFeedbackStyle.Rigid)`).
* **Safety / Error Warnings**: Notification warning haptic (`notificationAsync(NotificationFeedbackType.Warning)`).
* **Simulator Graceful Fallback**: All haptic calls wrap in silent try/catch blocks.

---

## 5. Layout & Navigation Safe-Zones
* **Bottom Insets**: To prevent content from being trapped behind the 5-tab bar and Safari browser chrome on mobile, all scrollable screens enforce:
  `paddingBottom: insets.bottom + 120` to `140`.
* **Card Restraint**: No nested boxes inside bordered cards. Prefer flat clean typography separated by hairline dividers over heavy boxed containers.
* **Center Tab (Scan)**: Positioned at tab index 3 as a native navigation item with viewfinder icon, NOT a floating action button.
* **Global Account Affordance**: All 5 root tabs (`Today`, `Plan`, `Scan`, `Ask`, `Progress`) feature a standardized 44x44 pt tactile Account button in the header (`person` icon in a circular mineral frame) routing directly to `app/profile`.

---

## 6. Semantic UI Primitives (`src/components/ui/`)

All customer views build exclusively on a standardized suite of semantic primitives in `src/components/ui/`:

| Primitive | Role & Key Properties |
| :--- | :--- |
| **`Screen`** | Full-height canvas wrapper with safe-area padding, optional scroll, and standardized screen gutters. |
| **`ScreenHeader`** | Editorial title + subtitle with optional back action, step counters, and trailing settings/actions (including 44x44 pt account button). |
| **`GroupedSection`** | iOS-style grouped white cards with subtle hairline borders, optional section header, and hairpins between rows. |
| **`SelectionCard`** | Tappable option card supporting `selectionType?: 'radio' \| 'checkbox'`, title, description, and optional metadata badges. |
| **`SelectionRow`** | Grouped table row with left title/subtitle and trailing radio button or checkbox (44pt touch minimum). |
| **`ChoiceChip`** | Horizontal capsule selector for single or multi-select filters and categories. |
| **`SegmentedControl`** | Tactile sliding tab switcher for view toggling (e.g. `ROUTINE` vs. `PRODUCTS`, photo angles). Placed on a full-width row for optimal touch targets. |
| **`StatusBadge`** | Categorical status pill supporting `'keep' \| 'pause' \| 'replace' \| 'add' \| 'review' \| 'active' \| 'caution'`. |
| **`StickyActionFooter`** | Floating bottom bar anchored above safe insets with primary CTA, optional secondary link, and glass blur. |
| **`TextField`** | Clean styled text input with label, placeholder, and error state. |
| **`VoiceTextArea`** | Multiline text note input integrated with a 44x44 client-side voice transcription button. |
| **`InfoBanner`** | Non-intrusive status banner with `'review' \| 'info' \| 'warning'` variants for non-blocking notifications. |
| **`EmptyState`** | Minimal placeholder with iconography, headline, description, and call-to-action. |

---

## 7. Component Interaction Conventions

* **Accordion Disclosure**: Expandable routine cards (`RoutineCard`) use directional chevrons (`up` / `down`) rather than generic `X` / close symbols, providing clear affordances for expanding and collapsing step details.
* **Chat Action Callouts**: AI-proposed actions in chat (`ChatBubble`) render in full-width, multiline wrapping callout boxes with tactile buttons (`flexShrink: 1`, multiline wrapping) to completely prevent text truncation or pill clipping.
* **Progress Photo Angles**: Photo comparison uses a dedicated full-width `SegmentedControl` (`Front` \| `Left` \| `Right`) paired with friendly editorial date labels (`Sep 1`, `Sep 8`, `Sep 15`) rather than raw ISO timestamps.

---

## 8. Spatial Layout Grammar & Rhythm

The layout adheres to strict geometric intervals defined in `src/constants/theme.ts`:

* **Screen Gutters**: 24pt horizontal margins (`layout.gutter: 24`).
* **Section Gap**: 32pt vertical spacing between grouped modules (`layout.sectionGap: 32`).
* **Item Gap**: 16pt vertical rhythm between related items (`layout.itemGap: 16`).
* **Minimum Touch Target**: 44pt x 44pt for all interactive buttons, rows, and toggles (`layout.minTouchTarget: 44`).
* **Primary CTA Height**: 54pt pill button with bold centered typography (`layout.ctaHeight: 54`).
* **Corner Radii**: 20pt for large cards/grouped containers, 12pt for internal subcards/chips, 27pt for pill CTAs.

---

## 9. Guided Baseline Photo Capture UX & Quality Semantics

Intake photo capture balances effortless Apple-grade interaction with strict photographic standardization:

* **Guided Step Sequence**: Standardized 3-step sequence (`Front View` → `Left Profile` → `Right Profile`) displayed with clean numerical step indicators and visual framing guidelines.
* **Intended Auto-Capture Flow**:
  - The camera evaluates **capture quality in real time**:
    1. Exactly one face in frame.
    2. Correct pose and head orientation for the active step.
    3. Proper face distance and size within the guide frame.
    4. Centered positioning.
    5. Adequate ambient lighting and balanced exposure (no harsh flash blowout or deep underexposure).
    6. Sharp focus (no motion blur).
    7. Severe obstructions avoided (hair or hands covering the face).
    8. Stable frame maintained for a brief interval (~500ms).
  - When all quality criteria are met, the shutter fires **automatically without requiring manual tapping**.
* **Review & Affirmation**:
  - The user immediately inspects the captured frame and chooses between `[Use Photo]` and `[Retake]`.
* **Manual Shutter Fallback**:
  - A tactile manual shutter button is always accessible so users can capture manually if lighting, disability, or environment prevents automated quality satisfaction.
* **On-Device & Biometric Safeguards**:
  - Evaluation operates on-device where practical.
  - Strictly evaluates image quality; never computes or stores persistent face embeddings or facial recognition IDs.

