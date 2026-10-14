---
name: Sentinel Voice Security
colors:
  surface: '#faf8fe'
  surface-dim: '#dad9df'
  surface-bright: '#faf8fe'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f8'
  surface-container: '#eeedf3'
  surface-container-high: '#e9e7ed'
  surface-container-highest: '#e3e2e7'
  on-surface: '#1a1b1f'
  on-surface-variant: '#414755'
  inverse-surface: '#2f3034'
  inverse-on-surface: '#f1f0f5'
  outline: '#717786'
  outline-variant: '#c1c6d7'
  surface-tint: '#005bc1'
  primary: '#0058bc'
  on-primary: '#ffffff'
  primary-container: '#0070eb'
  on-primary-container: '#fefcff'
  inverse-primary: '#adc6ff'
  secondary: '#4c4aca'
  on-secondary: '#ffffff'
  secondary-container: '#6664e4'
  on-secondary-container: '#fffbff'
  tertiary: '#006b27'
  on-tertiary: '#ffffff'
  tertiary-container: '#008733'
  on-tertiary-container: '#f7fff2'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a41'
  on-primary-fixed-variant: '#004493'
  secondary-fixed: '#e2dfff'
  secondary-fixed-dim: '#c2c1ff'
  on-secondary-fixed: '#0c006a'
  on-secondary-fixed-variant: '#3631b4'
  tertiary-fixed: '#72fe88'
  tertiary-fixed-dim: '#53e16f'
  on-tertiary-fixed: '#002107'
  on-tertiary-fixed-variant: '#00531c'
  background: '#faf8fe'
  on-background: '#1a1b1f'
  surface-variant: '#e3e2e7'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 64px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Inter
    fontSize: 34px
    fontWeight: '700'
    lineHeight: 41px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  title:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 25px
    letterSpacing: -0.008em
  body-lg:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 21px
    letterSpacing: 0em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 13px
    letterSpacing: 0.04em
  mono-metric:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2.5rem
  margin-mobile: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system embodies the meticulous discretion, mechanical clarity, and ambient calm characteristic of Apple’s human-interface philosophy. Designed for critical voice phishing (vishing) and acoustic social-engineering defense, the interface must project utter composure under duress. Security monitoring must not evoke panic; rather, it should project quiet technical omnipotence, high-fidelity signal clarity, and authoritative guidance.

The aesthetic fuses Cupertino minimalism with sophisticated translucent glassmorphism. It uses generous negative space, deliberate typographic weight contrasts, and frosted vibrancy overlays that elevate situational awareness without visual noise. Every surface, interaction, and visual feedback cue feels tactile, weightless, and frictionless.

Key brand traits:
- **Calm Authority:** Eliminates red-alert sensory overload; presents critical intelligence with surgical precision.
- **Micro-Precision:** Utilizes hairline borders, pristine typographic tracking, and calculated micro-spacing.
- **Physical Translucency:** Uses frosted glass planes to layer incoming live acoustic signals over institutional baseline metrics.

## Colors

The palette leverages standard Apple Human Interface semantic tiers anchored against clean Apple monochromatic neutrals. 

- **Canvas & Surfaces:**
  - Base Canvas: `#F5F5F7` (Apple system gray 6 canvas)
  - Elevated Primary Surface: `#FFFFFF` (pure white, diffuse light transmission)
  - Glass Surface: `rgba(255, 255, 255, 0.72)` with active background saturation
  - Secondary Card Fill: `#FBFBFD`

- **Typography & Content Hierarchy:**
  - Label Primary: `#1D1D1F` (near-black, optical high contrast)
  - Label Secondary: `#86868B` (neutral balance)
  - Label Tertiary: `#A1A1A6` (subtle captions, timestamps)
  - Hairline Separators & Borders: `rgba(0, 0, 0, 0.06)` on light surfaces; `rgba(255, 255, 255, 0.20)` on dark or glass planes

- **Semantic Tints:**
  - Primary Accent (System Blue): `#007AFF` — Active verification, primary commands, system health
  - Secondary Accent (System Indigo): `#5856D6` — Deep neural analysis, biometric modeling, synthetic telemetry
  - Threat Mitigated / Verified (System Green): `#34C759` — Validated voiceprint, safe frequency band
  - Threat Warning (System Orange): `#FF9500` — Acoustic anomalies, suspicious script cadence, elevated risk
  - Critical Threat (System Red): `#FF3B30` — Deepfake detected, synthetic voice injection, immediate disconnect

## Typography

The typography uses Inter across display, narrative, and control tiers to replicate San Francisco's tracking and variable weight balance, complemented by JetBrains Mono strictly for real-time acoustic telemetry, threat certainty scores, and latency metrics.

- **Weight Contrast:** Tight negative tracking on large weights (`-0.03em` on display sizes) ensures structural tightness. In contrast, smaller labels use loose tracking (`+0.04em` on `label-sm`) for immediate legibility in high-density dashboards.
- **Hierarchy Rules:** Large titles transition straight into refined medium body copy without transitional weights to maintain a clean editorial feel. 
- **Telemetry Display:** Real-time speech-to-text tokens, spectrogram tags, and packet timestamps always use `mono-metric` with tabular figures (`font-variant-numeric: tabular-nums`) to prevent layout shift during live voice stream updates.

## Layout & Spacing

The layout is built on an adaptive 12-column grid on desktop/tablet, collapsing to a single-column structured layout on mobile, constrained by comfortable maximum container widths (1280px for standard views; 1440px for multi-stream intelligence consoles).

- **Margins & Safe Zones:** Canvas boundaries maintain generous margins (`2.5rem` desktop, `1.25rem` mobile) to create visual space around security statuses. 
- **Rhythm & Padding:** Component spacing adheres strictly to an 8pt base grid. Compact internal elements (badges, micro-telemetry cards) use 4px multiples (`space-xs` and `space-sm`), while module cards employ internal padding of `space-lg` to prevent dense information from feeling cramped.
- **Responsive Stacking:** On mobile, live audio spectrograms and risk meter clusters move from side-by-side splits into a vertically stacked format, preserving full touch targets (minimum 44x44pt) across all interactive threat mitigation toggles.

## Elevation & Depth

Visual depth follows a layered frosted glass structure rather than heavy drop shadows, mimicking Apple’s vibrant translucent window layers.

- **Level 0 (Canvas):** Solid neutral `#F5F5F7`. Non-interactive, grounding backdrop.
- **Level 1 (Card Baseline):** `#FFFFFF` with a single, highly diffused ambient shadow: `box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04)`. Outlined with a fine border: `1px solid rgba(0, 0, 0, 0.05)`.
- **Level 2 (Active Frosted Overlays / HUD Panels):** Background set to `rgba(255, 255, 255, 0.78)` backed by `backdrop-filter: blur(24px) saturate(180%)`. Border set to `1px solid rgba(255, 255, 255, 0.60)`. Elevated shadow: `0 12px 36px rgba(0, 0, 0, 0.06), 0 2px 6px rgba(0, 0, 0, 0.02)`.
- **Level 3 (Modal / Interruption Alerts):** Frosted container layered above a `rgba(0, 0, 0, 0.20)` diffused backdrop with `backdrop-filter: blur(12px)`. The surface uses `rgba(255, 255, 255, 0.92)` with `box-shadow: 0 24px 64px rgba(0, 0, 0, 0.12)`.

## Shapes

The design uses continuous-curvature geometry reminiscent of Apple squircle (superellipse) radii. 

- **Corner Curvature Hierarchy:**
  - Standard cards and surfaces: `1rem` (16px, `rounded-lg`).
  - Large display containers and floating action panels: `1.5rem` (24px, `rounded-xl`).
  - Inputs, alert rows, and small panels: `0.5rem` (8px, base roundedness).
  - Status badges, operational controls, and metric tags: Fully rounded pill shape (`9999px`) to maintain tactile clarity and contrast against angular grid modules.
- **Edge Finishes:** All visible borders must maintain a consistent 1px hairline weight with zero corner deformation.

## Components

- **Buttons:**
  - *Primary Button:* Apple System Blue (`#007AFF`) or System Red (`#FF3B30` for emergency termination). Pill or 10px rounded corners. Text is `label-md` bold white. Hover triggers a subtle brightness shift (`filter: brightness(1.04)`), active press scales down smoothly (`transform: scale(0.98)`).
  - *Secondary / Glass Button:* `rgba(0, 0, 0, 0.05)` fill on canvas, or `rgba(255, 255, 255, 0.8)` on dark sections, with a subtle border and `#1D1D1F` label text.
  
- **Chips & Threat Badges:**
  - Strict pill geometry (`rounded-full`). Padding: `4px 10px`. 
  - Background is a 10% tint of the semantic color with a 15% border (e.g., Red Threat Badge: `bg-[#FF3B30]/10 border border-[#FF3B30]/20 text-[#FF3B30]`). Displays an icon or pulse indicator dot (6px) followed by uppercase `label-sm` text.

- **Cards & Analysis Containers:**
  - Built with `#FFFFFF` or glassmorphic frosted surface treatments, wrapped in a 1px `border-black/5` edge.
  - Generous internal padding (`space-lg`), subtle headline hierarchy, and segmented metric footers divided by soft hairline separators.

- **Acoustic Spectrogram & Waveform Visualizer:**
  - Real-time audio streams sit on a subtle recessed surface (`#ECECEE`, `0.5rem` radius). 
  - Waveform bars use dynamic vertical scale transforms. Synthetic speech markers highlight in `#FF3B30` with a soft glow, while verified human natural speech renders in `#007AFF` or `#34C759`.

- **Inputs & Search:**
  - Neutral `#E5E5EA` background or glass outline with 10px corner radius. Placeholder text in `#86868B`.
  - Focus state swaps to a white background with a crisp `#007AFF` hairline border and a soft glow (`box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.15)`).

- **Toggles & Switches:**
  - Modeled on the iOS switch: 51x31px pill track (`#E9E9EA` off, `#34C759` or `#007AFF` on). Pure white circular thumb with a soft drop shadow (`0 3px 8px rgba(0, 0, 0, 0.15)`), animating smoothly with physics-based cubic-bezier easing (`cubic-bezier(0.16, 1, 0.3, 1)`).