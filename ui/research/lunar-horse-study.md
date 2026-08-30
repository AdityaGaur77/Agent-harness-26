# Lunar Horse reference study

Source inspected live on 2026-08-28: <https://lunar-horse.webflow.io/>

## Composition

- One calm, full-viewport composition with no page scroll.
- Fixed 64-ish pixel header, a hairline rule, sparse status copy, and no visible navigation clutter.
- The ASCII canvas dominates the upper center. The title is anchored bottom-left and a short explanation bottom-right.
- At 1440 × 900, the canvas is roughly 979 × 720, the title is 40/40, and the body is 16/20.8.
- At 390 × 844, the canvas becomes almost full width and about 43vh tall; copy stacks at the bottom-left.
- Base palette: `#f4f3f1` surface, `#1c1c1c` ink, `#413e3e` and `#6d6d6d` muted text, `#dfdede` rules.

## Motion behavior

- Eleven eager-loaded WebP source frames are converted to ASCII on a canvas.
- The source swaps at 12 FPS: approximately 83.3ms per frame and 0.92s per full loop.
- An adaptive luminance ramp moves from punctuation to dense glyphs. Four-neighbor edge sampling boosts the silhouette boundary.
- Each cell receives a random 0–1250ms reveal delay, then a 150ms opacity fade.
- Pointer movement repels local samples inside a roughly 110px radius at strength 0.3. It never moves the canvas as one block.
- Heading, subtitle, and description use short per-character opacity reveals with increasing delays. The fixed header arrives last from `translateY(-1rem)`.
- The reference does not expose a motion control or reduced-motion alternative.

## Translation into Blast Radius

- Preserved: one dominant generative scene, strict edge alignment, thin rules, large whitespace, discrete frame cadence, organic cell assembly, and local pointer repulsion.
- Rebuilt for motion fidelity: the procedural ellipse-and-limb approximation was removed. The landing renderer now samples an eleven-frame, locally bundled horse-and-rider gallop sequence through the same luminance ramp and edge-weighting constants as the reference.
- Provenance: the reference describes the work as an ASCII reinterpretation of Eadweard Muybridge's horse-in-motion study. The locally bundled WebP frames were captured from the source page for this faithful prototype; production reuse still requires confirming the source site's asset terms or replacing them with equivalently authored licensed frames.
- Added: a true first-visit front door, a measured handoff into the existing agent workspace, randomized glyph assembly, reduced-motion behavior, offscreen RAF suspension, accessible canvas labeling, and the non-destructive demo honesty note.
- Kept: the full harness workflow behind the front door—prompt-first home, clarification, five parallel checks, pause/resume, evidence, rehearsal, rollback, scope controls, connectors, audit history, and completion.
- Avoided: hotlinked assets, hidden navigation in the agent area, dashboard rails on the landing view, overlapping telemetry, decorative gradients, and any cursor interaction that implies a deletion occurred.

## Implementation values

- Canvas cadence: 12 FPS.
- Glyph reveal: randomized 0–1250ms delay with 150ms fade.
- Pointer radius: 110 sampled-canvas pixels; repulsion multiplier 0.3.
- DPR cap: 2.
- Landing canvas: 68vw × 80vh at desktop with a 10vw product-layout shift; 99vw × 43vh below 860px with the reference's 10vw vertical offset.
- Palette: warm mineral paper, carbon ink, one restrained moss accent, and oxide only for actionable harness errors.
