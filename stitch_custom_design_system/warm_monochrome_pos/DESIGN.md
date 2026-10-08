---
name: Warm Monochrome POS
colors:
  surface: '#FFFFFF'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#444748'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f0f1f1'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5f5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1b'
  on-primary-container: '#858383'
  inverse-primary: '#c8c6c5'
  secondary: '#5e5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e3e2e2'
  on-secondary-container: '#646464'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1c1b1a'
  on-tertiary-container: '#868382'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c8c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474746'
  secondary-fixed: '#e3e2e2'
  secondary-fixed-dim: '#c7c6c6'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#464747'
  tertiary-fixed: '#e6e2df'
  tertiary-fixed-dim: '#cac6c4'
  on-tertiary-fixed: '#1c1b1a'
  on-tertiary-fixed-variant: '#484645'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
  ink-950: '#171717'
  ink-700: '#404040'
  ink-500: '#737373'
  ink-300: '#D4D4D4'
  ink-200: '#E5E5E5'
  ink-100: '#F5F5F5'
  canvas: '#FAFAFA'
  success: '#16803A'
  danger: '#C52A2A'
typography:
  display-hero:
    fontFamily: Geist
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  display-hero-mobile:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Geist
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  label-lg:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
  caption:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  numeral-hero:
    fontFamily: Geist
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  numeral-hero-mobile:
    fontFamily: Geist
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  numeral-lg:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 26px
  numeral-md:
    fontFamily: Geist
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 22px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1.5rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system is engineered specifically for Indonesian culinary micro, small, and medium enterprises (warung makan, kedai kopi, and rumah makan UMKM). The brand aesthetic balances utility, humility, and restrained craftsmanship: it is unapologetically functional, grounded (*membumi*), and warm without relying on frivolous ornament.

The design movement is a purposeful synthesis of **Warm Minimalism** and **High-Contrast Utilitarianism**:
- **Monochrome Integrity:** Eliminates arbitrary brand tinting, enterprise blues, and decorative gradients. Visual structure is articulated entirely through crisp structural contrast between deep carbon ink, calibrated border lines, and breathable light surfaces.
- **Touch-First Ergonomics:** Designed for high-stress counter environments, grease-prone screens, and rapid customer turnover. Interactive components enforce generous touch targets, distinct pressed states, and uncompromising readability under varied lighting conditions.
- **Pure Functional Color:** Color is treated as an exceptional semantic signal—restricted strictly to payment confirmation (`Success`) and destructive actions or voids (`Danger`).
- **Conversational Indonesian Voice:** All interface microcopy uses natural, direct Bahasa Indonesia (e.g., `Bayar`, `Kembalian`, `Buka Shift`, `Meja Terisi`, `Bungkus / Bawa Pulang`) avoiding cold corporate loanwords.

## Colors

The color architecture relies on an intentional inversion paradigm rather than multi-hued chromatic states:
- **`Ink 950` (`#171717`):** Primary action fill, top-level typography, active category and table selections, and single-line analytical charts.
- **`Ink 700` (`#404040`) & `Ink 500` (`#737373`):** Secondary and metadata typography, subtle boundary indicators, and quiet icon strokes.
- **`Ink 300` (`#D4D4D4`) & `Ink 200` (`#E5E5E5`):** Structural divider lines, card perimeters, input field borders, and inactive outlines.
- **`Ink 100` (`#F5F5F5`):** Subtle hover states, table headers, and disabled background fills.
- **`Canvas` (`#FAFAFA`) & `Surface` (`#FFFFFF`):** High-contrast base planes that separate the overarching application backdrop from content cards, sheets, and active panels.

### Semantic Guardrails
- **`Success` (`#16803A`):** Strictly reserved for positive settlement states, payment receipts, and device connection verification. It must never be used decoratively or for routine confirmations.
- **`Danger` (`#C52A2A`):** Exclusively indicates destructive terminal operations: void transactions, order cancellations, stock write-offs, and critical hardware errors.
- **State Inversion Rule:** When an element is selected (such as category pills, table cards, or segmented controls), it transitions from a bordered `#FFFFFF` card to a solid `#171717` container with `#FFFFFF` text.

## Typography

The typography system relies strictly on a single sans-serif family (`Geist` or `Inter`) across all operational viewports. 

### Tabular Numerals & Currency Syntax
- **Tabular Figures:** All prices, stock tallies, cash denominations, tax subtotals, and calculations must enforce `font-variant-numeric: tabular-nums` (`tnum`). This prevents jitter during dynamic cart updates and keeps receipt summaries vertically aligned.
- **Currency Convention:** Indonesian Rupiah amounts are written strictly as `Rp` directly adjacent to thousands-separated figures with no trailing decimal fractions (e.g., `Rp25.000`, `Rp150.000`).
- **Operational Floor:** In the cashier view, body copy never drops below `15px` to maintain fast readability on tablet stands at arm's length.

## Layout & Spacing

Layout geometry is structured across three core viewport modalities with strict adherence to an 8px base rhythm:

### Form Factors & Adaptations
1. **Tablet Landscape (Primary Register, 1024px–1440px):**
   - Optimized for counter hardware at `1280px × 800px`.
   - Structured as a persistent 3-zone split:
     - **Category Rail / Filter Strip:** Left or horizontal strip with `48px` minimum category chips.
     - **Menu Product Grid:** 3 to 5 columns auto-fitting available canvas space (`gutter: 1rem`).
     - **Sticky Order Ticket Panel:** Fixed right column (`380px` width) displaying the running cart, subtotal calculations, and the persistent sticky pay trigger.
2. **Mobile Viewport (Owner Analytics & Quick Order, &lt;768px):**
   - Single-column vertical layout (`margin: 1rem`).
   - Persistent 5-icon bottom navigation bar with `56px` height and explicit micro-labels.
   - Modals translate into bottom-sheet cards.
3. **Desktop (Backoffice Management, &gt;1440px):**
   - Fixed 240px collateral sidebar with 2-column data-entry panels.

### Dimensional Minimums
- **Touch Targets:** No interactive element (numpad, quantity stepper, modifier toggle) may be smaller than `48px × 48px`.
- **Primary Checkout Button (`BAYAR`):** Fixed minimum height of `64px` across all terminal screens to guarantee immediate checkout strikes without fine motor targeting.
- **Data Table Row Height:** Enforced minimum of `52px` for comfortable finger selection.

## Elevation & Depth

Visual hierarchy rejects skeuomorphism, neon glow, and synthetic glass surfaces. Depth is established through planar contrast, border definition, and restrained ambient dispersion.

### Surface Tiers
- **Base Canvas (`#FAFAFA`):** Ground tier of the interface upon which all panels sit.
- **Card & Sheet Surface (`#FFFFFF`):** Foreground elements outlined with a crisp `1px solid #E5E5E5` border.
- **Elevated Overlays & Modals:** Floating elements utilize a single, extra-diffused ambient shadow:
  `box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);`
  combined with a `1px solid #E5E5E5` hairline perimeter to retain crisp boundary distinction against white table slips.
- **Inverted Focus:** Highest-priority selection is signaled through high-contrast fill (`#171717`) rather than heavy multi-stop elevation shadows.

## Shapes

The shape system employs consistent geometry to signal component tiers and operational touch zones:

- **Modals, Floating Sheets, and Payment Drawers:** `24px` radius (`rounded-xl` token adaptation) to produce welcoming, modern container thresholds.
- **Cards, Order Ticket Containers, and Table Selectors:** `16px` radius (`rounded-lg`) offering clear visual separation for items within high-density grids.
- **Interactive Controls (Buttons, Inputs, Chips, Numpad Tiles):** `12px` radius (`rounded`) to provide tactile affordance without veering into full pill geometry.
- **Status Pills and Badges:** Rounded pills (`9999px`) restricted exclusively to compact tag indicators (e.g., `Terbayar`, `Bawa Pulang`, `Offline`).

## Components

### Buttons
- **Primary Action (e.g., `BAYAR`, `Konfirmasi`):** Background `#171717`, label `#FFFFFF`, height minimum `48px` (Checkout bar: `64px`), radius `12px`. Hover/Active: opacity `0.9` with a subtle scale down (`0.98`) for tactile response.
- **Secondary Action (e.g., `Batal`, `Simpan Draft`):** Background `#FFFFFF`, border `1px solid #E5E5E5`, label `#171717`. Active state transitions to `#F5F5F5`.
- **Destructive Action (e.g., `Hapus Pesanan`, `Void Meja`):** Background `#FFFFFF`, border `1px solid #C52A2A`, label `#C52A2A`. Confirmation state flips to solid `#C52A2A` with `#FFFFFF` text.

### Chips & Filter Tabs
- **Default / Unselected:** Background `#FFFFFF`, border `1px solid #E5E5E5`, text `#737373`, height `48px`, padding `0 16px`, radius `12px`.
- **Active / Selected:** Background `#171717`, border `1px solid #171717`, text `#FFFFFF`, font-weight `600`.

### Cards
- **Product Card:** Surface `#FFFFFF`, border `1px solid #E5E5E5`, radius `16px`, padding `16px`. Displays image or monochrome category glyph fallback, dish title in `body-md` (`#171717`), and price in `numeral-md` (`#404040`).
- **Table Card (`Meja`):** 
  - *Kosong (Empty):* Surface `#FFFFFF`, border `1px solid #E5E5E5`, text `#171717`.
  - *Terisi (Occupied):* Inverted to surface `#171717`, border `1px solid #171717`, text `#FFFFFF`, with active duration tag rendered in `#D4D4D4`.

### Input Fields & Numpad Keys
- **Inputs:** Height `48px`, background `#FFFFFF`, border `1px solid #E5E5E5`, radius `12px`, padding `0 16px`, text `16px` `#171717`. Focus: border `1px solid #171717`, outline none.
- **Numpad Cashier Keys:** Grid of `12px` rounded tiles, minimum size `56px × 56px`, background `#FFFFFF`, border `1px solid #E5E5E5`, font `numeral-lg`. Active tap background `#F5F5F5`.

### Order Ticket / Cart List
- **Line Items:** Minimum row height `48px`, separated by hairline divider (`1px solid #E5E5E5`). Quantity steppers (`+` / `-`) must measure at least `48px × 48px` touch bounds. Price columns strictly tabular-numeral aligned.

### Modals & Dialogs
- **Confirmation & Payment Sheets:** Centered container on desktop (max-width `480px`), bottom-sheet on mobile. Surface `#FFFFFF`, radius `24px`, ambient shadow `0 8px 24px rgba(0, 0, 0, 0.06)`, internal padding `24px`.