---
name: Blast Radius
description: Document-style erasure agent. White, monochrome, editorial, ASCII-led.
colors:
  canvas: "#FFFFFF"
  bone: "#F7F6F3"
  surface: "#FFFFFF"
  card: "#FFFFFF"
  border: "rgba(0,0,0,0.06)"
  border-strong: "#EAEAEA"
  ink: "#111111"
  ink-soft: "#2F3437"
  muted: "#787774"
  faint: "#9A9A9A"
  pastel-red: "#FDEBEC"
  pastel-red-text: "#9F2F2D"
  pastel-blue: "#E1F3FE"
  pastel-blue-text: "#1F6C9F"
  pastel-green: "#EDF3EC"
  pastel-green-text: "#346538"
  pastel-yellow: "#FBF3DB"
  pastel-yellow-text: "#956400"
typography:
  display:
    fontFamily: "'Newsreader', 'Lyon Text', 'Playfair Display', serif"
    fontSize: "clamp(2.4rem, 4.2vw, 3.6rem)"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.04em"
  ui:
    fontFamily: "'SF Pro Display', 'Geist Sans', 'Helvetica Neue', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
  mono:
    fontFamily: "'Geist Mono', 'SF Mono', 'JetBrains Mono', monospace"
    fontSize: "0.7rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  card: "12px"
  control: "6px"
  tag: "9999px"
spacing:
  section: "96px"
  card: "32px"
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "24px"
  xl: "40px"
---

# Design System: Blast Radius — Premium Utilitarian Minimal

## Overview

**Reading this as:** document-style product UI for a private erasure agent used by ordinary people at a desk, with an editorial minimal language, leaning toward warm monochrome + spot pastels and ASCII as primary spatial system.

**Physical scene:** Morning, white desk, white page, thin 1px lines. You see where your address leaked. You type what to clear. The agent shows an open ASCII field above the prompt. It runs below. You say delete when ready.

**Core idea:** White holds the page. Thin lines and air hold structure. Serif carries the single headline. Mono ASCII carries life. Pastel appears only as a 4px tag or live wash. The workflow stays in three plain moves: tell it, watch it, say delete.

**Variance / Motion / Density:** `4 / 2 / 2` — restrained grid, invisible motion, gallery air.

## Colors

White and bone are the only surfaces. Pastel is scarce and semantic.

### Roles

- **Canvas** `#FFFFFF`: Full page and sidebar.
- **Bone** `#F7F6F3` / `#FBFBFA`: Subtle section washes and kbd keys. Never a full flood.
- **Card** `#FFFFFF` with `1px solid #EAEAEA`: Every container. No shadow, no tint.
- **Ink** `#111111`: Headlines, primary button, ASCII glyphs, icons.
- **Ink Soft** `#2F3437`: Secondary titles and active states.
- **Muted** `#787774`: Meta, labels, timestamps.
- **Faint** `#9A9A9A`: Placeholders and disabled.
- **Pastel Blue** `#E1F3FE` / `#1F6C9F`: Info tags and quiet washes.
- **Pastel Green** `#EDF3EC` / `#346538`: Live and done.
- **Pastel Yellow** `#FBF3DB` / `#956400`: Needs you / waiting.
- **Pastel Red** `#FDEBEC` / `#9F2F2D`: Error only.

### Rules

**No flood.** No large colored backgrounds. No gradients, no neon, no glass beyond a navbar blur at `8px`.

**Pastel as tag only.** Pastel sits in `9999px` pill tags at `text-xs` uppercase or in a 4px wash behind a dot. Never as a full card fill.

**Border is the system.** `1px solid #EAEAEA` or `rgba(0,0,0,0.06)` separates everything. No diffuse shadows above `0 2px 8px rgba(0,0,0,0.04)`.

## Typography

**Display serif** `Newsreader / Playfair Display` at `400`, `line-height 1.05`, `tracking -0.04em` for the single hero headline and agent messages. One editorial voice.

**UI sans** `SF Pro Display / Geist Sans / Helvetica Neue` at `500` for navigation, buttons, labels, meta.

**Mono** `Geist Mono / SF Mono` at `400` for ASCII, keystrokes, IDs, timestamps.

### Hierarchy

- **Display** `38-56px / 1.05 / -0.04em / serif`: One per view. The request.
- **Title** `15px / 500 / -0.01em / sans`: Row and question titles.
- **Body** `15px / 1.6 / ink #111111`: Conversation. Max `65ch`, never pure black.
- **Label** `11px / 700 / 0.05em uppercase / sans`: Eyebrows, tags.
- **Mono** `11px / mono`: ASCII field, `<kbd>`, provenance.

## Shape

- **Card** `12px` max. `8px` on small controls. Large containers never `rounded-full`.
- **Control** `6px` for primary button, inputs, secondary buttons. `4px` for kbd.
- **Tag** `9999px` only for status pills and badges at `text-xs`.

**Documented rule:** Cards and composers are `12px`. Primary button is `6px`. Tags are pill. No 18px, no 22px, no 999px on large surfaces.

## Space

Macro whitespace is the layout. Sections use `py-24` to `py-32`. Content constrained to `max-w-4xl` to `max-w-5xl` at center. Cards carry `24px` to `40px` internal padding. Dividers are `1px solid #EAEAEA` with air on both sides. Never stack cards without air.

## Elevation

Ultra-flat. No `shadow-md/lg/xl`. The only allowed shadow is `0 2px 8px rgba(0,0,0,0.04)` on hover lift for cards, or `0 0 0 rgba(0,0,0,0)` at rest. Buttons have no shadow. Navbar may blur at `8px`.

## Motion

Invisible. `transform` and `opacity` only.

- Entry: `translateY(12px) + opacity 0 → 0` over `600ms` `cubic-bezier(0.16, 1, 0.3, 1)` via `IntersectionObserver`, staggered `calc(var(--index) * 80ms)`.
- Hover: card `box-shadow` from `0 0 0` to `0 2px 8px rgba(0,0,0,0.04)` in `200ms`. Button `:active` `scale(0.98)`.
- ASCII: 12 FPS glyph refresh, spring `stiffness 28 / damping 10.2` with velocity handoff. Reduced motion collapses to static. No layout jitter, no `transition: all`, no scroll listener.

**One ambient layer only** if used: a single radial gradient blob at `opacity 0.02-0.04`, `20s+` drift, `position: fixed; pointer-events: none`.

## Components

### Shell

White sidebar with `1px solid #EAEAEA` right border. No cream. Rail groups carry air, not washes. Selected row uses `1px solid #EAEAEA` plus `background #F7F6F3` wash. No lavender wash.

### ASCII Presence

Mono field centered above headline at `72×17` home, `42×14` agent. Glyphs are `·` and `:` in `#111111` at `0.94` opacity, `8.6px` home / `5.2px` agent, tight tracking. Elliptical orbit with pulse and spring displacement. Center label `[ ready ]` etc in mono. Home second line `your data, under your direction`, third line `5.6 traces per name · white · document` in faint mono. Integration: field sits on white with no card, no border, max air. Agent compact sits inside a `12px` flat card with `1px #EAEAEA` and `#FFFFFF`.

### Composer

White, `1px solid #EAEAEA`, `12px` radius, no shadow. Textarea borderless. Footer holds `Runs alone` with dot in pastel green wash and `Add detail` in muted. Send is `#111111` on `#FFFFFF` text, `6px` radius, hover `#333333`. Focus adds `1px #111111` ring.

### Bento Feature Grids

Asymmetrical CSS Grid. Each cell is a card `1px #EAEAEA`, `12px` max, `24-32px` padding. Never pill. Images if used are desaturated warm photos at low opacity, no saturation.

### Buttons

Primary: `#111111` bg, `#FFFFFF` text, `6px` radius, no shadow, hover `#333333` or `scale(0.98)`. Secondary: white with `1px #EAEAEA`, `6px`. Tags: pill `9999px`, `text-xs` uppercase, pastel fill per semantic.

### Progress + Activity

Sticky progress is a flat card `12px`, `1px #EAEAEA`, no shadow. Left ascii frame `12px`, center title/detail/track (`3px` track in `#F7F6F3` with `#111111` fill), right pause is secondary button `6px`. Activity card is flat, heading row with `border-bottom 1px #EAEAEA`, steps are lines separated by `1px #EAEAEA`, not chips.

### Drawer

White, left `1px #EAEAEA`, `0 2px 8px rgba(0,0,0,0.04)` if lifted. Sections divided by `1px #EAEAEA`. Impact grid is a `1px #EAEAEA` bordered card with internal dividers, not a tinted grid.

### Kbd + Window Chrome

Shortcuts as `<kbd>` with `1px #EAEAEA`, `4px` radius, `bg #F7F6F3`, mono. Mock windows get white top bar with three `8px` light grey circles.

## Copy Voice

Plain, specific, document-like. No elevate, seamless, unleash, next-gen. No adverbs. One idea per sentence. “You” addresses the reader. Numbers and provenance stay literal.

## Do and Do Not

### Do

- Keep white dominant. Let air and thin lines do the work.
- Use serif once for the headline, sans for chrome, mono for evidence.
- Let ASCII breathe above the prompt. Keep it as the only ambient layer.
- Expose four plain steps: Understand, Search, Check, Delete.
- End with `Delete what you can.` Keep law-keeps note literal.

### Do Not

- Use Inter, Roboto, Open Sans, Lucide/Feather/Heroicons thin strokes, `shadow-lg`, pill on large containers, gradients, neon, 3D glass, emojis, John Doe / Acme / Lorem, or cliche copy.
- Flood a section with a solid primary color or pastel card fill.
- Use `rounded-full` on composer, cards, or primary buttons.
- Animate layout properties or mount grid items without stagger.

## Verification

- White stays dominant. Pastel covers <6% surface and only in pill tags or dot washes.
- One headline per view, `tracking -0.04em`, `line-height 1.05`, max `65ch`.
- Corners: cards `12px` max, buttons `6px`, tags pill — no drift.
- Borders everywhere `1px solid #EAEAEA`.
- ASCII `72×17` home, `42×14` agent at 12 FPS, spring preserved, reduced motion static.
- Sections carry `py-24` to `py-32`, content `max-w-4xl/5xl`, images desaturated if present.
- All states complete and keyboard accessible.
