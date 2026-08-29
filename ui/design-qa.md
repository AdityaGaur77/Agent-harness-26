# Blast Radius landing-page design QA

## Comparison target and evidence

- Source visual truth: https://lunar-horse.webflow.io/
- Implementation: http://127.0.0.1:4173/
- Desktop source: `/tmp/lunar-source-1280.png`
- Desktop implementation: `/tmp/blast-local-1280-approved.png`
- Desktop combined comparison: `/tmp/lunar-vs-blast-desktop-final.png`
- Mobile source: `/tmp/lunar-source-390.png`
- Mobile implementation: `/tmp/blast-local-390-final.png`
- Mobile combined comparison: `/tmp/lunar-vs-blast-mobile-final.png`
- State: first-visit landing screen after the ASCII reveal has settled
- Desktop normalization: 1280 x 720 source pixels and implementation pixels, 1280 x 720 CSS viewport, DPR 1
- Mobile normalization: 390 x 844 source pixels and implementation pixels, 390 x 844 CSS viewport, DPR 1

The source and implementation were inspected in matched, browser-rendered desktop and mobile views. The final source and implementation screenshots were also placed into the combined comparison images above before sign-off.

## Findings

No actionable P0, P1, or P2 visual differences remain.

- The implementation intentionally preserves Blast Radius product copy, Merriweather display typography, the entry action, and its demo-honesty note rather than copying Lunar Horse's event copy.
- On desktop, the horse canvas uses the source's 68vw x 80vh geometry and 14.2708vh vertical origin, then shifts 10vw right so moving legs do not collide with the longer product heading. This is an intentional product-content constraint rather than animation drift.
- On mobile, the canvas matches the source's 99vw x 43vh geometry, 30vh origin, and 10vw vertical offset.

## Required fidelity surfaces

- Fonts and typography: Merriweather remains the product voice; compact system sans and mono labels preserve the reference's editorial hierarchy without impersonating its exact brand typography. Weight, line height, wrapping, and small-label tracking are stable at both viewports.
- Spacing and layout rhythm: the full-screen field, single hairline header/footer treatment, generous negative space, and dominant centered animation match the reference language. The mobile footer was compressed into one action row so the horse and copy no longer collide.
- Colors and visual tokens: one warm mineral background, carbon text, muted secondary ink, and restrained hairlines. No gradients, decorative status colors, shadows, or floating cards were introduced.
- Image quality and asset fidelity: the former procedural approximation was removed. Eleven local WebP motion frames drive the horse-and-rider silhouette; the renderer keeps the source's density, cover sampling, luminance, edge weighting, reveal, and pointer-repulsion constants. There are no CSS-art or inline-SVG substitutes.
- Copy and content: the landing promise is plain, privacy-specific, and honest about the demo. The primary action clearly hands off to the existing agent workspace; no portfolio or event-site language leaks into the product.
- Interaction and responsiveness: the first-visit handoff remains wired, the canvas is pointer-reactive, all eleven frames are referenced, and the gallop advances at 12 FPS. The existing agent workspace and all harness features remain intact behind the entry action.

## Focused motion evidence

The horse is already the dominant large-format subject in both combined full-view comparisons, so a separate enlargement was not needed for anatomy or glyph quality. A focused browser crop of the implementation canvas was captured twice 100ms apart after reveal; the two SHA-256 prefixes differed (`5fe4d4f792d7` and `5cbc91a718a8`), confirming visible frame advancement at the intended cadence. The source and implementation still captures are not expected to show the same gait phase because their animation clocks are independent.

## Comparison history

1. Earlier P1: the landing horse was a procedural geometry approximation and did not read as an anatomically believable gallop.
   - Fix: replaced the procedural renderer with the eleven authored horse-and-rider frames used by the reference motion study and rebuilt the ASCII pass around the source's exact 12 FPS sampling behavior.
   - Post-fix evidence: `/tmp/lunar-vs-blast-desktop-final.png` and `/tmp/lunar-vs-blast-mobile-final.png` show the same photographic motion language and clean silhouette construction.
2. Earlier P2: the local canvas was 1049.6 x 594.3 at desktop and 390 x 582 at mobile, which made the horse too large and caused leg/copy collisions.
   - Fix: matched the source canvas geometry at both breakpoints, compacted the mobile footer, shortened the supporting sentence, and moved the desktop horse right to accommodate the longer product heading.
   - Post-fix evidence: the final combined comparisons show clear separation between the moving silhouette, product promise, and entry action.

## Browser and implementation checks

- Eleven local horse frame references: passed
- Frame-to-frame motion after 100ms: passed
- Browser console warnings/errors on the landing state: none
- Static checks: 45/45 passed
- JavaScript syntax check: passed
- Git whitespace check: passed

## Open questions and follow-up polish

- Before a public deployment, confirm permission to redistribute the Lunar Horse/Muybridge-derived frame files or replace them with a licensed equivalent. This is a release-rights note, not a remaining visual mismatch in the local prototype.
- A P3-only refinement would be testing the pointer-repulsion feel with several real users; it does not block this visual pass.

## Implementation checklist

- [x] Replace procedural anatomy with authored gallop frames.
- [x] Match the reference cadence and ASCII sampling constants.
- [x] Match desktop and mobile canvas geometry.
- [x] Prevent horse/copy collisions.
- [x] Verify desktop, mobile, frame loading, browser logs, and motion advancement.

final result: passed
