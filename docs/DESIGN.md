# Derive Design System: Direction A (Mineral)

Derive's visual language is modeled on Apple-grade minimalism and quiet luxury. It conveys calm, architectural precision rather than clinical coldness or frantic gamification.

---

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

