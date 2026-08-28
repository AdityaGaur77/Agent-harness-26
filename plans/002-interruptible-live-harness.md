# 002 — Make live harness motion interruptible

- **Status**: DONE
- **Resolution**: Satisfied by the agent-workspace rewrite. Activity rows, subagent state, panels, and run controls now use retargetable transitions with generation cancellation.
- **Commit**: efc6637
- **Severity**: HIGH
- **Category**: Interruptibility
- **Estimated scope**: 2 files, ~40 lines

## Problem

Rapidly-triggered and reversible UI uses `@keyframes` which restart from zero on interrupt, breaking the fluid feel. The live harness is the agentic core and is triggered repeatedly (Run agent, subagents fanning, log stacking). A user spamming Run again or toggling Configure mid-animation sees jumps.

Locations:

```css
/* ui/styles.css:1048 — current */
@keyframes findings-pulse { 0%,100% { box-shadow: 0 0 0 5px ... } 50% { box-shadow: 0 0 0 9px ... } }

/* ui/styles.css:1203 — current */
@keyframes log-enter { to { opacity: 1; transform: translateY(0); } }
.log-entry { animation: log-enter 360ms var(--ease-out) forwards; }

/* ui/styles.css:1760 — current */
@keyframes header-enter { to { transform: translateY(0); opacity: 1; } }
.site-header { animation: header-enter 500ms var(--ease-out) 1.7s forwards; }

/* ui/styles.css:1767 — current */
@keyframes char-enter { to { opacity: 1; } }
.char-reveal { animation: char-enter 150ms ease forwards; }
```

```js
/* ui/app.js:1200 — current log insertion */
row.className = "log-entry is-live";
row.innerHTML = `...`;
findingsLog.appendChild(row);
```

Why it matters: `findings-pulse` on the backend dot and subagent dots pulses infinitely via keyframes; interrupting it (switching from searching to done) snaps. `log-enter` on every hunter log restarts from `opacity 0 translateY(4px)`; stacking 8 logs quickly creates a stutter. `header-enter` and `char-enter` are one-shot but still not retargetable. Audit §4: anything triggered rapidly or reversible mid-motion must use transitions or springs, not keyframes. Spring config for interruptible motion: `{ type: "spring", duration: 0.5, bounce: 0.2 }` keep bounce 0.1–0.3.

## Target

Replace keyframes with interruptible transitions/springs that retarget from the current state:

```css
/* target log entry — no keyframes */
.log-entry {
  opacity: 0; transform: translateY(4px);
  transition: opacity 280ms var(--ease-out), transform 280ms var(--ease-out);
}
.log-entry.is-in { opacity: 1; transform: translateY(0); }
.log-entry.is-live { border-left-color: var(--signal); }
```

```css
/* target findings pulse — transition + class toggle, no @keyframes */
.findings-backend i, .subagent .dot { transition: box-shadow 300ms var(--ease-out), background 300ms var(--ease-out); }
.findings-backend.is-searching i { box-shadow: 0 0 0 9px color-mix(in srgb, var(--signal) 8%, transparent); }
```

```js
// target spring for subagent card pop
import { animate } from "motion"; // or keep CSS transition but use transform
animate(subagentEl, { transform: "translateY(-1px)" }, { type: "spring", duration: 0.5, bounce: 0.2 });
```

For header/char, keep single-run but make them transition-based via `@starting-style` or `data-mounted` so they can be interrupted on theme toggle.

## Repo conventions to follow

- The repo uses plain CSS transitions in `ui/styles.css` and `requestAnimationFrame` canvas in `ui/app.js`. For this plan, stay in CSS transitions (no new dependency) to match existing convention. The spring example is illustrative; if a spring library is added, add it in a follow-up. Exemplar for transition style: `.tool-row { transition: background 200ms var(--ease-out), transform 200ms var(--ease-out); }` at `ui/styles.css:590`.
- Animations that are one-shot marketing (hero header) may keep keyframes only if they are not reversible; this plan focuses on the live harness which is reversible.

## Steps

1. In `ui/styles.css`, delete the `@keyframes findings-pulse` block at `1048` and the `animation: findings-pulse` lines at `1045` and `1141`. Replace with a transition on `box-shadow` as in the target. Keep the `is-searching` and `is-active` states toggling `box-shadow` 5px to 9px via `transition: box-shadow 300ms var(--ease-out)`.

2. In `ui/styles.css`, delete `@keyframes log-enter` at `1203` and the `animation: log-enter` on `.log-entry` at `1200`. Add `transition: opacity 280ms var(--ease-out), transform 280ms var(--ease-out)` with initial `opacity 0 translateY(4px)`. In `ui/app.js:1200`, after `appendChild`, add `requestAnimationFrame(() => row.classList.add("is-in"))` so the transition retargets from the current style.

3. In `ui/styles.css`, delete `@keyframes header-enter` and `@keyframes char-enter` at `1760`/`1767` if they are only used for one-shot reveals. Replace `site-header` animation with `transition: transform 400ms var(--ease-out), opacity 400ms var(--ease-out)` and a `data-mounted` attribute set in `ui/app.js` on `DOMContentLoaded` to trigger it. This makes the header retargetable on interrupt.

4. In `ui/app.js`, for subagent cards, change the instantaneous `classList.add("is-active")` to also trigger a spring via `element.animate` or CSS `transition: transform 280ms var(--ease-out)` so that rapid spam of Run agent never restarts from zero but blends from the current `translateY`.

## Boundaries

- Do NOT add a new motion library in this plan; use CSS transitions as the repo does. A spring library can be a separate plan.
- Do NOT touch the ASCII canvas `AsciiField` tick logic in this plan — that is plan 003.
- Do NOT change markup structure beyond adding `is-in` and `data-mounted`.

## Verification

- **Mechanical**: `grep -rn "@keyframes" ui/styles.css` should show zero results for `findings-pulse` and `log-enter` (only header/char may remain if kept). `grep -rn "animation:" ui/styles.css` should not show those two. `node ui/scripts/check.mjs` still passes.
- **Feel check**: run the live harness, spam `Run agent` 5 times quickly and toggle `Configure` mid-pulse. Confirm:
  - Subagent dots and backend dot never snap; they smoothly grow/shrink from the current glow.
  - Log entries stack without stutter; each new entry slides from the current position, not from 0.
  - Spamming the toggle never restarts an animation from zero.
  - In DevTools Animations at 10% speed, no keyframe restart is visible.
  - With `prefers-reduced-motion`, motion drops to opacity only.
- **Done when**: no keyframes remain on rapidly-triggered harness UI and all transitions retarget from the current value.
