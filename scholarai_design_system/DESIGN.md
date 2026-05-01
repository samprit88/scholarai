---
name: ScholarAI Design System
colors:
  surface: '#fff7fc'
  surface-dim: '#e1d7e0'
  surface-bright: '#fff7fc'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fbf1fa'
  surface-container: '#f5ebf4'
  surface-container-high: '#efe5ee'
  surface-container-highest: '#e9dfe9'
  on-surface: '#1f1a20'
  on-surface-variant: '#4d4450'
  inverse-surface: '#342f35'
  inverse-on-surface: '#f8eef7'
  outline: '#7e7481'
  outline-variant: '#cfc2d2'
  surface-tint: '#7f43a4'
  primary: '#612586'
  on-primary: '#ffffff'
  primary-container: '#7b3fa0'
  on-primary-container: '#ecc4ff'
  inverse-primary: '#e5b4ff'
  secondary: '#875206'
  on-secondary: '#ffffff'
  secondary-container: '#fcb565'
  on-secondary-container: '#754600'
  tertiary: '#6d5e06'
  on-tertiary: '#ffffff'
  tertiary-container: '#beab51'
  on-tertiary-container: '#4a3f00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#f4d9ff'
  primary-fixed-dim: '#e5b4ff'
  on-primary-fixed: '#30004b'
  on-primary-fixed-variant: '#65298a'
  secondary-fixed: '#ffdcbb'
  secondary-fixed-dim: '#ffb869'
  on-secondary-fixed: '#2b1700'
  on-secondary-fixed-variant: '#673d00'
  tertiary-fixed: '#f8e382'
  tertiary-fixed-dim: '#dbc769'
  on-tertiary-fixed: '#211b00'
  on-tertiary-fixed-variant: '#524600'
  background: '#fff7fc'
  on-background: '#1f1a20'
  surface-variant: '#e9dfe9'
typography:
  h1:
    fontFamily: Noto Serif
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  h2:
    fontFamily: Noto Serif
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.3'
  h3:
    fontFamily: Noto Serif
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  caption:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.01em
  button:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.02em
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
  xl: 40px
  container-margin: 24px
  gutter: 16px
---

## Brand & Style

This design system establishes an academic and premium atmosphere through a **Tactile / Modern** hybrid aesthetic. It evokes the feeling of a prestigious library combined with the efficiency of modern technology. The brand personality is scholarly, authoritative, and focused, yet warm and encouraging. 

The visual narrative centers on an "ink-on-parchment" metaphor. Surfaces are layered to mimic physical paper, using subtle depth to create a focused study environment. The use of rich plum and aged gold creates a "Dark Academia" influence that distinguishes the interface from clinical, tech-heavy productivity tools.

## Colors

The palette is rooted in organic, warm tones that reduce eye strain during long study sessions.

- **Foundations:** The background utilizes aged parchment (#FAF3E8) to provide a soft, low-contrast base. Secondary areas use warm sand to define structural divisions.
- **Surface & Hero:** The deep plum (#2D1B4E) is reserved for high-impact "Hero" moments and dark-mode cards, providing a dramatic contrast that signals premium intelligence.
- **Accents:** Gold (#C4853A) is the primary call-to-action color, signifying achievement and value. Plum (#7B3FA0) is used for secondary interactive elements, links, and active states.
- **Utility:** Success and Danger states are desaturated to maintain the vintage aesthetic without sacrificing clarity.

## Typography

The system employs a sophisticated typographic pairing to balance tradition and readability.

- **Serif (Headings):** **Noto Serif** (serving as the scholarly equivalent to Playfair Display) provides an authoritative, literary feel. It should be used for all page titles and section headers to reinforce the scholarly narrative.
- **Sans-Serif (UI & Body):** **Plus Jakarta Sans** is used for all functional text, body copy, and data. Its modern, clean proportions ensure high legibility during intensive reading tasks.
- **Styling:** Headings use a tighter letter-spacing to feel "set" like a physical book, while body text uses a generous line height (1.5–1.6) to improve reading flow.

## Layout & Spacing

This design system utilizes a **Fluid Grid** with generous internal padding to create an airy, unhurried user experience.

- **Rhythm:** A 4px baseline grid governs all spacing. Vertical rhythm should prioritize large margins (24px+) between major sections to prevent the "cramped" feeling typical of productivity apps.
- **Grid:** Use a 12-column system for desktop and a 4-column system for mobile. Elements should often be centered with wide "gutters" to mimic the layout of a formal manuscript or thesis paper.
- **Density:** Maintain "Low Density" for reading-focused views and "Medium Density" for dashboard/management views.

## Elevation & Depth

Depth is achieved through **Tonal Layering** and soft, ambient shadows rather than harsh light sources.

- **Shadows:** Use warm-tinted shadows (using the Deep Plum color at very low opacity, e.g., `rgba(45, 27, 78, 0.08)`) to make cards appear as if they are resting lightly on parchment.
- **Layering:** 
    - **Level 0 (Base):** Primary Background (#FAF3E8).
    - **Level 1 (Cards):** Deeper Parchment (#E8D9C4) with a 1px border and a subtle soft shadow.
    - **Level 2 (Popovers/Modals):** Pure white or the lightest parchment with a more pronounced, diffused shadow.
- **Ink Effect:** Interactive elements should feel like they are "pressed" or "stamped" into the paper when active.

## Shapes

The shape language is organic and approachable, avoiding the clinical sharpness of traditional SaaS.

- **Containers:** Main cards and content areas use a radius of 16px–18px.
- **Buttons:** Use a consistent 12px–14px radius to maintain a sophisticated profile.
- **Badges:** All badges and tags are strictly **pill-shaped** (fully rounded) to contrast against the more structured rectangular cards.
- **Borders:** Borders are thin (1px) and use a low-opacity Plum to mimic a light pencil or ink stroke.

## Components

- **Buttons:** 
    - **Primary:** Gold background (#C4853A) with Deep Plum text. This is used for "Submit," "Save," or "Complete" actions.
    - **Secondary:** Deep Plum background with parchment text. Used for "Edit," "Add," or navigation.
- **Cards:** Use the Card Background (#E8D9C4) with a 1px border. For "AI-generated" or "Featured" content, use the Hero/Dark Card (#2D1B4E) with gold accents.
- **Input Fields:** Use a subtly darker parchment fill than the background. On focus, the border transitions to Plum (#7B3FA0) with a soft glow.
- **Pill Badges:** Used for categories and status. They should feature a desaturated background color with high-contrast text in the same hue.
- **Progress Indicators:** Use the Gold accent for completion bars, evoking a sense of "earning" progress.
- **List Items:** Separated by the standard border color (12% Plum), with generous vertical padding (16px) to maintain the scholarly rhythm.