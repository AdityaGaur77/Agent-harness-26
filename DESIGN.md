---
name: Blast Radius
description: ASCII-first connected privacy agent. TrueForge session state made visible through purposeful motion.
colors:
  canvas: "#0A0A0B"
  surface: "#141416"
  surface-elevated: "#1C1C1F"
  border: "#2A2A2E"
  border-strong: "#3A3A3F"
  ink: "#FAFAFA"
  ink-soft: "#D4D4D8"
  muted: "#A1A1AA"
  faint: "#71717A"
  accent: "#22D3EE"
  accent-soft: "#0E7490"
  accent-bg: "#052D3D"
  success: "#4ADE80"
  success-bg: "#052E16"
  warning: "#FBBF24"
  warning-bg: "#2E1A00"
  danger: "#FB7185"
  danger-bg: "#2E050A"
typography:
  display:
    fontFamily: "'Space Grotesk', 'JetBrains Mono', monospace"
    fontSize: "clamp(2.5rem, 5vw, 4.5rem)"
    fontWeight: 700
    lineHeight: 1.0
    letterSpacing: "-0.03em"
  body:
    fontFamily: "'Space Grotesk', 'JetBrains Mono', monospace"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.7
  ui:
    fontFamily: "'Space Grotesk', 'JetBrains Mono', monospace"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
  mono:
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
  ascii:
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace"
    fontSize: "0.65rem"
    fontWeight: 400
    lineHeight: 1.15
rounded:
  card: "16px"
  control: "10px"
  pill: "9999px"
spacing:
  section: "120px"
  card: "32px"
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  2xl: "80px"
---

# Design system: Blast Radius, ASCII-first connected agent

## Overview

**Reading this as:** ASCII-first product interface for a private erasure agent, with a restrained technical aesthetic and purposeful motion that makes the TrueForge session legible without exposing implementation details.

**Physical scene:** Dark room, terminal glow. You type what to find. The agent responds with living ASCII art that breathes, searches, thinks. No fluff. Pure function made visible.

**Core idea:** Dark canvas. Cyan accent. ASCII appears throughout the landing view, workspace, progress, and state views. The ASCII *is* the interface. Connected mode is driven by TrueForge; direct MCP remains a local fallback when the runtime is unavailable.

**Variance / Motion / Density:** `8 / 7 / 6` for expressive, cinematic motion and rich density.

## Colors

Dark monochrome base. Cyan is the only chromatic signal. Used for ASCII, primary actions, live states.

### Roles

- **Canvas** `#0A0A0B`: Full page background. Near-black with subtle warmth.
- **Surface** `#141416`: Cards, panels, composer. One step up from canvas.
- **Surface Elevated** `#1C1C1F`: Hover states, active cards, dropdowns.
- **Border** `#2A2A2E`: Default borders, dividers.
- **Border Strong** `#3A3A3F`: Focus rings, active borders.
- **Ink** `#FAFAFA`: Primary text, headings, ASCII glyphs.
- **Ink Soft** `#D4D4D8`: Secondary text, descriptions.
- **Muted** `#A1A1AA`: Labels, timestamps, secondary info.
- **Faint** `#71717A`: Placeholders, disabled, deep secondary.
- **Accent** `#22D3EE`: Cyan. Primary actions, ASCII glyphs, live indicators, focus rings. The *only* color.
- **Accent Soft** `#0E7490`: Hover states for accent.
- **Accent BG** `#052D3D`: Wash behind accent elements.
- **Success** `#4ADE80` / **Success BG** `#052E16`: Done states, confirmations.
- **Warning** `#FBBF24` / **Warning BG** `#2E1A00`: Waiting, needs input.
- **Danger** `#FB7185` / **Danger BG** `#2E050A`: Errors, destructive actions.

### Rules

**One accent.** Cyan only. No other hues. Variation through opacity and background washes.

**Dark first.** No light mode. Canvas is near-black. Surfaces step up in 10% luminance increments.

**ASCII owns the accent.** ASCII glyphs render in accent cyan. Live states pulse in accent.

## Typography

**Display:** Space Grotesk 700 at 400 weight for hero. Tight tracking. Pure mono feel with geometric quirks.

**UI:** Space Grotesk 500 for all UI text. Monospace feel without being mono.

**Mono:** JetBrains Mono for code, IDs, timestamps, data.

**ASCII:** JetBrains Mono at 0.65rem, 1.15 line height, 12 FPS. The star of the show.

### Hierarchy

- **Display** `40-72px / 1.0 / -0.03em`: Hero only. One per view.
- **Title** `16px / 600 / -0.01em`: Card titles, section heads.
- **Body** `16px / 1.7 / ink`: Conversation, descriptions. Max 70ch.
- **Label** `11px / 600 / 0.08em uppercase`: Eyebrows, tags, metadata.
- **Mono** `12px / mono`: ASCII, data, provenance.

## Shape

- **Card** `16px`: All containers. Generous radius for polished feel.
- **Control** `10px`: Buttons, inputs, small cards.
- **Pill** `9999px`: Tags, badges, primary button.

## Space

Generous macro whitespace. Sections use `120px` of vertical space. Cards have `32px` padding. ASCII fields get room because they *are* the content.

## Elevation

Layered dark surfaces. No shadows on static elements. Hover lift: `0 4px 24px rgba(0,0,0,0.4)` with accent border glow. Focus: `0 0 0 2px accent`.

## Motion

Cinematic but purposeful. 12 FPS ASCII refresh. Spring physics for state transitions.

- ASCII: 12 FPS glyph refresh, spring `stiffness 35 / damping 9` with velocity handoff.
- State transitions: 400ms cubic-bezier(0.16, 1, 0.3, 1).
- Staggered reveals: `calc(var(--index) * 100ms)`.
- Reduced motion: ASCII freezes on last frame, crossfade only.

**ASCII is the motion layer.** Everything else is static or subtle hover.

## Components

### Shell

Dark sidebar with `1px border` right. Rail groups separated by ASCII dividers. Selected row: accent border + surface-elevated wash.

### ASCII Hero (Home)

Massive ASCII field `160×40` centered above the prompt. A breathing orbital animation carries the state label `[ ready ]` at center. The sub-label types on load. No card or border, just ASCII on canvas.

### ASCII Agent (Mission)

Compact ASCII `80×24` embedded in progress bar. Same animation language. State label `[ finding ]` etc.

### ASCII Cards

Every mission card has a mini ASCII indicator `24×8` showing state: idle pulse, search scan, check diamond, execute bars.

### Composer

Surface elevated, `1px border-strong`, `16px` radius. Textarea borderless. Footer: synthetic status dot (cyan pulse), detail button, send button (accent bg, ink text, `10px` radius).

### Progress Bar

Sticky top. Left: mini ASCII. Center: title, detail, track (accent fill, spring width). Right: pause button (control radius).

### Activity Card

Flat surface, `1px border`, `16px` radius. Heading with chevron. Body: steps with ASCII indicators (pulse/scan/diamond/bars). Parallel grid with live dots.

### Question Card

Accent border, accent BG wash. Left: large `?` in mono. Right: question, two pill buttons.

### Completion

Check mark in accent. Bold title. Synthetic summary. Primary action: `Delete what you can` (accent). Secondary: `See what I found`.

### Drawer

Surface elevated, left `1px border-strong`. Sections divided by `1px border`. Impact grid: bordered cards with internal dividers. Tool list: mono code + description.

### ASCII States Library

Each agent state has distinct ASCII signature:
- **Idle**: Slow orbital pulse, `[ ready ]`
- **Reasoning**: Tightening orbit, `[ thinking ]`
- **Question**: Frozen orbit, blinking `?`, `[ ? ]`
- **Searching**: Horizontal scan wave, `[ finding ]`
- **Rehearsing**: Diamond contour, `[ checking ]`
- **Executing**: Horizontal bars with ticks, `[ clearing ]`
- **Monitoring**: Radial sweep, `[ verify ]`
- **Complete**: Steady glow, `[ done ]`
- **Error**: Cross pattern, `[ halted ]`

## Synthetic Demo Data

All data is generated client-side. No network calls. Instant.

- **Evidence fixture**: 7 source types with marks, names, details, confidence
- **Subagents**: 5 parallel (identity, brokers, records, links, web)
- **Steps**: 4 phases (understand → search → check → act)
- **Impact**: 42 records, 9 remove, 24 clear, 9 cut, 5.6 traces/name
- **Audit**: Timestamped events with types
- **Identity**: Jane Q Synthetic, Nashville, customer 4471
- **Question**: Nashville confirmation (yes/no)

## Copy Voice

Direct. Technical. No fluff. One idea per sentence. "You" addresses the reader. Numbers literal. No adverbs. No em dashes. Stop-slop compliant.

## Do and Do Not

### Do

- ASCII everywhere. Hero, sidebar, cards, progress, states.
- Cyan accent only. No other colors.
- Dark canvas. Surfaces step up.
- Synthetic data runs instantly. No loading skeletons.
- Space Grotesk + JetBrains Mono only.
- Generous radii (16px cards).
- 12 FPS ASCII with spring physics.

### Do Not

- Light mode. Gradients. Other colors.
- Real network calls in demo mode.
- Inter, Roboto, system sans.
- Small radii (8px or less).
- Card grids without ASCII.
- Static ASCII. It must breathe.

## Verification

- ASCII renders at 12 FPS with spring physics on all target states.
- Cyan accent <15% surface area.
- One font family for display/UI, one for mono/ASCII.
- All radii use 16px, 10px, or pill values without drift.
- Demo completes in <30s with zero network calls.
- Keyboard accessible, reduced motion respected.
