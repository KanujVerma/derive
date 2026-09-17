# Derive — First Founding Beta Customer Acceptance Script

**Purpose**: Structured 10–15 min guided session with a first beta member to validate usability, trust, and perceived effort before full enrollment.

**Format**: Founder observes silently. Let the member drive. Speak only to prompt when stuck more than ~30 seconds.

**Key Objectives**:
- Can they complete onboarding without assistance?
- Do the 3-angle baseline photos feel natural?
- Does barcode Scan feel instant and accurate?
- Do they trust the plan enough to follow it?
- Where do they hesitate, re-read, or express doubt?

---

## Setup (Before Member Arrives)

- [ ] iPhone charged, TestFlight or development-client build installed
- [ ] App in clean state (fresh install; production builds have no reset control)
- [ ] No demo or Arthur data visible
- [ ] WiFi connected
- [ ] Note-taking ready (paper preferred to avoid device distraction)
- [ ] Bring 2–3 real skincare product bottles with barcodes

---

## Session Script

### 1. Warm-Up (2 min)

"We're going to walk through the app together. I want you to use it like it's yours — don't worry about doing it wrong, because there's no wrong. I'll mostly be watching."

Ask before they open:
- "What do you currently use on your skin daily, if anything?"
- "What's your biggest frustration with skincare right now?"

**Observe**: baseline trust level, vocabulary they use for their skin.

---

### 2. Welcome & Onboarding (4–6 min)

**Action**: Hand them the phone on the Welcome screen. Say nothing else.

| Step | Expected | Failure Signal |
|------|----------|---------------|
| Welcome screen | Headline "Let's get to know your skin." plus a 4-minute, private, final-quality-check framing | Confusion about what Derive does |
| Goals selection | Selects 1–3 goals without hesitation | Asks "what does this mean?" for >2 options |
| Complexity preference | Selects 1 option; no confusion | Feels like a quiz they can fail |
| Skin behavior | Answers honestly; may ask about specific terms | Feels judged or embarrassed |
| Shelf products | Enters 1–2 products without coaching | Cannot figure out how to add products |
| Reaction history | Accurate No/Yes flow; no over-disclosure pressure | Feels like a medical intake form |
| Safety screen | Quick scan, no alarm | Pauses on pregnancy or Rx question with confusion |

**Observe**: hesitation points, language they use, whether they feel judged.

---

### 3. Baseline Photos — 3-Angle Capture (2–3 min)

**Action**: Watch them navigate to the photo capture step.

| Check | Expected | Failure Signal |
|-------|----------|---------------|
| Front capture | Camera opens, auto-capture triggers within ~5 sec of good positioning | Cannot get face in oval; capture never triggers |
| Guidance messaging | "Center your face" / "Move closer" / "Hold still" appear and are understood | Instructions feel confusing or stressful |
| Left profile | Turns their left (~quarter turn / 45°); not a full side profile | Turns wrong direction or forces a 90° ear-on pose |
| Right profile | Same on their right | Gives up before third capture |
| Use Photo / Retake | Comfortable accepting or retaking | Accepts blurry photo without noticing |
| Cannot skip | Continue button stays inactive until 3 photos | Feels forced and frustrated |

**Key UX Question**: Does auto-capture feel magical or unsettling?

**Observe**: how long auto-capture takes, whether manual shutter fallback is needed, body language (comfort with front camera).

---

### 4. Onboarding Summary & Plan Draft (1 min)

**Action**: Let them reach the summary screen.

| Check | Expected | Failure Signal |
|-------|----------|---------------|
| Review summary | Can identify their products and goals | "I didn't know I was giving all this" |
| $100 Founding Beta | Visible on the membership card and makes sense | "$100 for what exactly?" |
| Final Review copy | Understands the first routine gets a quality check before it goes live | Thinks the plan is already active |
| Explore-while-reviewing | Can still use Today / Plan preview / Scan / Ask | Feels locked out after submitting |

---

### 5. Today Tab — At-a-Glance (30 sec)

**Action**: Navigate to Today.

| Check | Expected | Failure Signal |
|-------|----------|---------------|
| Status card | Clean "plan in review" state | Sees fake shipment or fake insight |
| No streak counter | No daily check-in guilt visible | Feels obligated to check in daily |

---

### 6. Barcode Scan (2 min)

**Action**: Hand them one of the product bottles. Say: "Try scanning this."

| Check | Expected | Failure Signal |
|-------|----------|---------------|
| Camera opens | < 1 second | Visible delay or confusion finding Scan tab |
| Barcode detected | Single haptic, no shutter press | Has to move bottle many times; never detects |
| Known product | "FIT FOR YOU RIGHT NOW" verdict appears | Shows wrong product |
| Unknown product | Retry / Search options appear without fabricated identity | Shows a made-up product |
| Scan → Ask | One tap sends product to Ask tab with context | Context is lost between tabs |

**Observe**: perceived scanning speed, confidence in verdict, whether they trust the evaluation.

---

### 7. Ask Tab (1–2 min)

**Action**: Let them ask a natural skincare question.

| Check | Expected | Failure Signal |
|-------|----------|---------------|
| Composer usable | Can type; mic button is present (native currently uses a local dictation fallback, not live speech recognition) | Mic button placement confuses |
| Response grounded | References their actual skin/routine | Generic response ignores their context |
| Scanned product context | If coming from Scan, product banner visible | Context not carried over |

---

### 8. Plan Tab (30 sec)

**Action**: Navigate to Plan.

| Check | Expected | Failure Signal |
|-------|----------|---------------|
| DRAFT · NOT ACTIVE | Clearly a pending state | Thinks this is their live routine |
| Product shelf audit | Products they entered are visible | Empty or has Arthur's products |

---

### 9. Progress Tab (30 sec)

**Action**: Navigate to Progress.

| Check | Expected | Failure Signal |
|-------|----------|---------------|
| Baseline only | 3 photos captured in onboarding shown | Fabricated history shown |
| "Awaiting first check-in" | Makes sense, no pressure | Feels like they failed to complete something |

---

### 10. Orders / Refills (30 sec)

**Action**: Check the Orders tab or Refills if visible.

| Check | Expected | Failure Signal |
|-------|----------|---------------|
| Empty state | "Managed refills activate after your plan is confirmed" | Fake tracking number shown |

---

## Closing Interview (2 min)

Ask after the session:

1. "In your own words, what is Derive?"
2. "What would make you trust this more?"
3. "Was there anything that felt off or confusing?"
4. "If you were going to tell a friend about this, what would you say?"
5. "At $100/month, what would you need to see to feel like it's worth it?"

**Do not prime them** — let them answer before clarifying.

---

## What to Record

For each major step, note:
- Time spent
- Verbal reactions
- Hesitations (> 10 sec on same element)
- Questions they ask aloud
- Things they say they like or distrust
- Moments of visible confusion or delight

**Do NOT record**:
- Customer name or face
- Audio
- Specific skin condition disclosures beyond general context

---

## Common Failure Patterns to Watch For

| Pattern | Likely Root Cause |
|---------|------------------|
| Cannot position face for auto-capture | Hold threshold too strict; environment too dark |
| "What is Derive exactly?" at summary | Welcome copy needs stronger managed-service framing |
| Skips reading reactions page | Too many disclosure steps |
| "$100 for this?" | Perceived value not yet established by the time price appears |
| "Can I look things up myself?" | Trust not yet established; they want to verify |

---

*Script version: K5 initial — update after first 3 sessions.*
