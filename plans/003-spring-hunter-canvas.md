# 003 — Spring hunter canvas with velocity handoff

- **Status**: DONE
- **Resolution**: Satisfied by the agent-workspace rewrite. AsciiAgent carries velocity across state changes, advances spring physics continuously, and paints glyphs at 12 FPS.
- **Commit**: efc6637
- **Severity**: MEDIUM
- **Category**: Physicality & Interruptibility + Performance
- **Estimated scope**: 1 file, ~60 lines

## Problem

The agentic finding animation runs on a time-based canvas, not a spring, and carries no velocity. The hunter dots travel linearly `t/6.5` `app.js:346` and `progress * (nodes.length-1)` `app.js:360`, hard-stop at boundaries, and cannot be grabbed mid-flight. The ASCII field also animates `filter: blur()` via canvas glyphs without hardware acceleration.

Locations:

```js
/* ui/app.js:258 — current hunter travel */
classifyFindings(x, y, frame, column, row) {
  const t = (performance.now() - this.sceneStartedAt) / 1000;
  const progress = isReturn ? 1 : Math.min(1, t / 6.5);
  // ...
  const rt = Math.min(1, (t - 6.5) / 1.2);
  return { x: from.x + (to.x - from.x) * rt, y: from.y + (to.y - from.y) * rt };
}
```

```js
/* ui/app.js:143 — current tick */
if (time - this.lastFrameAt >= 1000 / 12) { this.draw(time, false); }
```

```css
/* ui/styles.css:194 — current header uses keyframes not spring */
.site-header { animation: header-enter 500ms var(--ease-out) 1.7s forwards; }
```

Why it matters: the live harness is the product's core delight moment. A linear, non-interruptible canvas feels like a video, not a physical agent that can be redirected. The 12 FPS cadence is intentional for ASCII, but the hunter's path should be a spring so a new `Run agent` mid-flight blends velocity instead of snapping to ` findings_idle`.

## Target

Make the hunter spring-driven, velocity-aware, and hardware-accelerated, per Apple §4–§6:

```js
// target spring — Apple defaults: damping 1.0 response 0.4, bounce 0.2 only for flick
import { animate } from "motion";
animate(agentEl, { transform: `translate(${x}px, ${y}px)` }, { type: "spring", bounce: 0.2, duration: 0.5 });

// velocity handoff on interrupt: read current transform, pass release velocity
const current = getComputedStyle(agentEl).transform;
const velocity = releaseVelocity; // from pointer history
animate(agentEl, { transform: `translate(${targetX}px, ${targetY}px)` }, { type: "spring", bounce: 0.2, duration: 0.5, velocity });

// projection for snap
function project(v, d=0.998) { return (v/1000)*d/(1-d); }
const projected = currentPosition + project(releaseVelocity);
const targetNode = nearestNode(projected);
```

For the canvas, keep 12 FPS but drive `agentPos` via a spring value `springX`/`springY` that is updated with `requestAnimationFrame` and `animate` from the current `agentPos` to `targetNode`. Use `transform` only (no `filter: blur` over 20px) and `will-change: transform`.

## Repo conventions to follow

- The repo's canvas motion lives in `ui/app.js:34` `class AsciiField` and `ui/styles.css:21` tokens. Follow the existing ASCII glyph system; do not replace the canvas with DOM. Exemplar for spring-like behavior is the existing `lerp` helper at `ui/app.js:11` — replace it with a spring that carries velocity.
- Keep the DPR cap `2` and `radius 110` `ui/app.js:326` as is.

## Steps

1. In `ui/app.js:34`, add a `spring` state to `AsciiField`: `this.springX = 0; this.springY = 0; this.velocityX = 0; this.velocityY = 0;` and a method `animateTo(targetX, targetY, velocity)` that sets `this.targetX/Y` and uses a spring step each `tick` (or `motion` animate if the library is added).

2. In `ui/app.js:258` `classifyFindings`, replace the linear `progress = t/6.5` with a spring-eased progress: `this.springProgress = lerp(this.springProgress, 1, 0.08)` or a proper spring ODE with `damping 1.0 response 0.4`. Ensure `agentPos` is computed from `this.springX/Y`, not directly from `t`.

3. In `ui/app.js:105` `setScene`, read the current `agentPos` and pass it as the spring's initial value so a mid-flight `Run agent` re-targets from the presentation value, not from `0`.

4. In `ui/styles.css:194`, if a spring library is introduced, change `.site-header` to use `transform` transition with `var(--ease-drawer)` `cubic-bezier(0.32, 0.72, 0, 1)` for drawer-like feel, or keep the canvas spring for the header. Ensure `will-change: transform` is set only on the hunter glyphs during motion.

5. Add `prefers-reduced-motion` branch: when `reduceMotionQuery.matches`, skip the spring and snap to `targetNode` with `opacity` cross-fade only.

## Boundaries

- Do NOT change the ASCII glyph set or the `findings_idle`/`findings_done` annotation logic — motion only.
- Do NOT add `transition: all` or animate `width`/`height` — use `transform` and `opacity` only.
- Do NOT install a new dependency without a separate plan; this plan may stay CSS/JS-only if no spring library is desired.

## Verification

- **Mechanical**: `grep -rn "t / 6.5" ui/app.js` should be gone. `grep -rn "will-change" ui/styles.css` should show `transform` on the hunter canvas. `node --check ui/app.js` passes.
- **Feel check**: run the live harness, start a search, and mid-flight hit `Run agent` again or drag the canvas. Confirm:
  - The hunter dot does not snap to center; it curves from its current on-screen position to the new target.
  - Velocity is preserved: a fast re-trigger overshoots slightly (`bounce 0.2`) then settles at `damping 1.0`, not a hard stop.
  - In DevTools Animations at 10% speed, the path is continuous, not segmented.
  - On a phone, the gesture feels 1:1, no lag.
  - With `prefers-reduced-motion`, the hunter jumps with a 200ms opacity fade, no slide.
- **Done when**: hunter motion is spring-driven, interruptible from the presentation value, and never hard-stops at node boundaries.
