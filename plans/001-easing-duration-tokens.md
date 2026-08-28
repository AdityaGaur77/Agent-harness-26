# 001 — Fix easing and duration tokens

- **Status**: DONE
- **Resolution**: Satisfied by the agent-workspace rewrite. The approved easing tokens and 100–280ms UI durations now live in the new ui/styles.css.
- **Commit**: efc6637
- **Severity**: HIGH
- **Category**: Easing & duration
- **Estimated scope**: 1 file, ~20 lines

## Problem

Easings are weak and durations are slow on high-frequency UI. All motion uses the single weak token `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)` and `--ease-spring: cubic-bezier(0.16, 1, 0.3, 1)` which do not match the audit's strong curves. Button and tool interactions that fire tens of times per day feel sluggish, and tooltip-free but header and reveal animations exceed the UI budget.

Locations and current code:

```css
/* ui/styles.css:21 — current */
--ease-out: cubic-bezier(0.22, 1, 0.36, 1);
--ease-spring: cubic-bezier(0.16, 1, 0.3, 1);
```

```css
/* ui/styles.css:134 — current skip link */
.skip-link { transition: transform 180ms var(--ease-out); }
```

```css
/* ui/styles.css:386 — current button */
.button { transition: background 240ms var(--ease-spring), color 240ms var(--ease-spring), transform 240ms var(--ease-spring), box-shadow 240ms var(--ease-spring); }
```

```css
/* ui/styles.css:590 — current tool row */
.tool-row { transition: background 240ms var(--ease-spring), transform 240ms var(--ease-spring), padding 240ms var(--ease-out); }
```

```css
/* ui/styles.css:693 — current demo progress */
.demo-progress button::before { transition: transform 400ms var(--ease-out); }
```

```css
/* ui/styles.css:1746 — current reveal */
[data-reveal] { transition: transform 900ms var(--ease-out), opacity 700ms ease; }
```

```css
/* ui/styles.css:194 — current header */
.site-header { animation: header-enter 500ms var(--ease-out) 1.7s forwards; }
```

Why it matters: `ease-in` is absent but the weak `ease-out` still starts too gently; 240ms on buttons exceeds the 100–160ms button budget; 400ms on progress and 900ms on reveal exceed the 300ms UI ceiling and make every scroll feel syrupy. Frequency: tool rows, buttons, and reveals are hit constantly while exploring the explainer.

## Target

Introduce the exact audit tokens and tighten durations to the budgets:

```css
/* target tokens in ui/styles.css:21 */
:root {
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
}
```

Targets per element (AUDIT.md §2):

```css
/* target button press */
.button { transition: background 160ms var(--ease-out), color 160ms var(--ease-out), transform 160ms var(--ease-out), box-shadow 160ms var(--ease-out); }
.button:active { transition-duration: 100ms; } /* keep already correct 100ms scale */

/* target tool row */
.tool-row { transition: background 200ms var(--ease-out), transform 200ms var(--ease-out); }

/* target demo progress */
.demo-progress button::before { transition: transform 250ms var(--ease-out); }

/* target reveal */
[data-reveal] { transition: transform 280ms var(--ease-out), opacity 280ms var(--ease-out); }

/* target header */
.site-header { animation: header-enter 400ms var(--ease-out) 0.8s forwards; }
@keyframes header-enter { to { transform: translateY(0); opacity: 1; } } /* keep but tighten delay from 1.7s to 0.8s */
```

## Repo conventions to follow

- Easing tokens live in `ui/styles.css:21` as `:root` custom properties. Add new curves there, matching the existing comment style. Exemplar is the current `--ease-out` line. Keep `--ease-spring` for spring-approximation if used, but do not use it for UI entrances; UI entrances use `--ease-out` per audit decision order.
- Duration values are inline in each rule; keep them as `ms` literals, not variables, as the repo currently does.

## Steps

1. In `ui/styles.css:21`, replace the two easing lines with the three audit curves exactly. Keep `--radius`, `--elev-*`, `--header-height` untouched. Result must be `--ease-out: cubic-bezier(0.23, 1, 0.32, 1); --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1); --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);` in that order.

2. In `ui/styles.css:386`, change `.button` transition durations from `240ms` to `160ms` for all properties, and keep `var(--ease-out)` for all. Verify no `var(--ease-spring)` remains on `.button`.

3. In `ui/styles.css:590`, change `.tool-row` to `background 200ms var(--ease-out), transform 200ms var(--ease-out)` and remove the `padding` transition and any `var(--ease-spring)`.

4. In `ui/styles.css:693`, change `.demo-progress button::before` from `400ms` to `250ms`.

5. In `ui/styles.css:1746`, change `[data-reveal]` to `transform 280ms var(--ease-out), opacity 280ms var(--ease-out)` and remove the bare `ease`.

6. In `ui/styles.css:194`, change `animation: header-enter 500ms var(--ease-out) 1.7s` to `400ms var(--ease-out) 0.8s`.

## Boundaries

- Do NOT touch `ui/app.js` or `ui/index.html` in this plan.
- Do NOT change markup or add new dependencies.
- Do NOT alter `findings-pulse` or `log-enter` keyframes — those are covered in plan 002.
- Do NOT introduce new tokens beyond the three listed.

## Verification

- **Mechanical**: `node ui/scripts/check.mjs` still `34/34` or `35/35`, `grep -rn "cubic-bezier" ui/styles.css` shows exactly the three audit curves and no `0.22, 1, 0.36, 1`.
- **Feel check**: open the site, scroll through the explainer, and hover tool rows and buttons rapidly. Confirm:
  - Button press snaps back in ~160ms, not dragging.
  - Tool row highlight follows pointer without lag.
  - Progress underline snaps in 250ms.
  - Reveal on scroll feels crisp under 300ms, not syrupy.
  - In DevTools Animations panel at 10% speed, no entrance drags beyond 300ms.
  - Toggle `prefers-reduced-motion` and confirm still fades gently.
- **Done when**: all six locations show the target durations/curves and no UI animation exceeds 300ms except marketing hero.
