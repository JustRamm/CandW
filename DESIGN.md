---
name: Carbon & Whale Operational Identity
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#3f484e'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#6f787f'
  outline-variant: '#bfc8cf'
  surface-tint: '#00668a'
  primary: '#00668a'
  on-primary: '#ffffff'
  primary-container: '#5aaad4'
  on-primary-container: '#003c54'
  inverse-primary: '#82d0fb'
  secondary: '#006d37'
  on-secondary: '#ffffff'
  secondary-container: '#6bfe9c'
  on-secondary-container: '#00743a'
  tertiary: '#565f70'
  on-tertiary: '#ffffff'
  tertiary-container: '#98a1b4'
  on-tertiary-container: '#2f3848'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c3e7ff'
  primary-fixed-dim: '#82d0fb'
  on-primary-fixed: '#001e2c'
  on-primary-fixed-variant: '#004c69'
  secondary-fixed: '#6bfe9c'
  secondary-fixed-dim: '#4ae183'
  on-secondary-fixed: '#00210c'
  on-secondary-fixed-variant: '#005228'
  tertiary-fixed: '#dae3f7'
  tertiary-fixed-dim: '#bec7db'
  on-tertiary-fixed: '#131c2a'
  on-tertiary-fixed-variant: '#3e4758'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  gutter: 20px
  margin-mobile: 16px
  margin-desktop: 40px
---

## Brand & Style
The design system for this sustainable outdoor media company is built on the pillars of **Environmental Stewardship** and **Operational Excellence**. The brand personality is professional and reliable, mirroring the durability of outdoor hardware, while remaining eco-conscious through a refined, modern aesthetic.

The visual style is **Corporate Modern with a Tactile Edge**. It utilizes a systematic card-based architecture to organize dense operational data—such as asset locations, maintenance schedules, and energy consumption metrics. The interface evokes a sense of "digital precision meets natural responsibility," using generous white space and high-quality typography to ensure that complex information remains legible and actionable. Minimalist glassmorphism is used sparingly for overlays to maintain a sense of lightness and transparency.

## Colors
The palette is anchored by **Sky Blue**, representing the "Carbon" aspect of the brand's environmental mission and providing a professional, calm primary action color. **Eco Green** serves as the secondary accent, reserved for sustainability-linked data points, success states, and "green" initiatives.

The background uses a subtle **Off-white/Light Gray** gradient to reduce eye strain during long operational sessions, while **Dark Charcoal/Navy** provides high-contrast legibility for all primary text. Status colors are intentional: **Warm Amber** is used for active maintenance or warnings, and **Soft Red** is strictly reserved for critical hardware damage or system errors.

## Typography
This design system utilizes **Inter** exclusively to leverage its exceptional legibility in data-heavy environments. The typographic scale is highly structured:

- **Headlines:** Use a slightly tighter letter-spacing and heavier weights to establish a clear hierarchy.
- **Body Text:** Optimized for reading speed; `body-md` is the standard for operational logs and descriptions.
- **Labels:** Small caps or bold weights are used for metadata, status tags, and technical specs to differentiate them from prose.
- **Mobile:** Headlines scale down to prevent awkward wrapping while maintaining enough visual weight to anchor the screen.

## Layout & Spacing
The layout follows a **Fluid Grid System** with specific constraints for data density.

- **Grid:** A 12-column grid is used for desktop environments, reflowing to a 4-column grid on mobile.
- **Spacing Rhythm:** Based on a 4px baseline. Components primarily utilize `16px (md)` padding for internal elements and `24px (lg)` for external margins between cards.
- **Density:** For data-dense views (like inventory or maintenance schedules), the spacing can be compressed to the `sm` (8px) scale to maximize information visibility without sacrificing touch targets.

## Elevation & Depth
Hierarchy is established through **Tonal Layering** and **Ambient Shadows**.

1.  **Level 0 (Background):** The off-white surface (#F7F9FB).
2.  **Level 1 (Cards):** Pure white (#FFFFFF) surfaces with a subtle, 1px border (#E2E8F0) and a soft, low-opacity shadow (Color: #1A2332, Alpha: 0.04, Blur: 8px). This is the standard for dashboard modules.
3.  **Level 2 (Active/Hover):** Increased shadow depth (Alpha: 0.08, Blur: 16px) and a slight vertical lift (2px) to indicate interactivity.
4.  **Level 3 (Modals/Overlays):** High-contrast shadows and a 12px backdrop blur on the underlying content to focus the user's attention.

## Shapes
The shape language is **Rounded**, striking a balance between the precision of professional software and the approachable nature of a sustainable brand.

- **Standard Elements:** Buttons, input fields, and small widgets use a 0.5rem (8px) radius.
- **Containers:** Large dashboard cards and sections use a 1rem (16px) radius to create a soft, friendly container for technical data.
- **Pills:** Status badges and chips use a fully rounded (999px) radius to clearly distinguish them from actionable buttons.

## Components
- **Buttons:** Primary buttons use the Sky Blue background with white text. Secondary buttons use a transparent background with a Sky Blue border. Success actions (e.g., "Complete Maintenance") use the Eco Green.
- **Cards:** The central UI building block. Cards must include a clear header, 1px light gray border, and consistent internal padding. Content should be grouped logically with horizontal dividers.
- **Chips/Badges:** Small, pill-shaped indicators. For "Sustainability Scores," use a light green background with dark green text.
- **Input Fields:** Use a 1px border that shifts to Sky Blue on focus. Labels should always be visible above the field in `label-md` style.
- **Leaf Iconography:** Subtle eco-themed icons (leaves, recycling loops, suns) should be used as secondary visual cues next to sustainability metrics or "Green-certified" assets.
- **Lists:** Clean, border-bottom separated rows with `body-sm` text. Use Sky Blue for linked text within lists.