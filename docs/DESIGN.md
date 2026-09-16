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
