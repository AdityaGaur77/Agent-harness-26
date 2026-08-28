# Animation Plans

Generated from commit `efc6637` on 2026-08-28. All plans are self-contained; an executor needs no prior context.

| # | Title | Severity | Category | Status |
|---|-------|----------|----------|--------|
| 001 | Fix easing and duration tokens | HIGH | Easing & duration | DONE |
| 002 | Make live harness motion interruptible | HIGH | Interruptibility | DONE |
| 003 | Spring hunter canvas with velocity handoff | MEDIUM | Physicality & Performance | DONE |

## Recommended execution order

1. **001** first — tokens are foundational; other plans depend on the new `--ease-out` / `--ease-in-out` / `--ease-drawer` values.
2. **002** next — removes the feel-breaking keyframe restarts on the most frequently-hit surface (live harness log + subagents).
3. **003** last — upgrades the canvas delight moment; depends on 001's tokens for the spring defaults.

## Dependencies

- 002 and 003 both assume 001's tokens exist. If executing 002 or 003 alone, inline the audit curves `cubic-bezier(0.23, 1, 0.32, 1)` etc. directly.
- No plan adds a dependency; 003 may optionally introduce `motion` but can stay CSS-only.

## How to execute

Pick a plan and run it with any agent:

```
improve-animations execute 001
```

Or hand the markdown file to a cheaper model. Each plan contains exact file:line excerpts, target code, repo conventions, ordered steps, boundaries, and feel checks.

## Status

- TODO = not started
- DOING = in progress
- DONE = verified and merged

Plans 001–003 were satisfied by the fresh agent-workspace implementation rather than patched into the retired presentation page.

Update this table as plans are executed. Run `improve-animations reconcile` to refresh file:line references after code moves.

## Missed opportunities (not yet planned)

- Findings results `found 42 records` appears via `hidden` toggle with no transition — should cross-fade with `translateY(4px) → 0` `280ms var(--ease-out)`.
- Outcome `comparison` metrics `33` / `24` teleport on scroll — could stagger 40ms per metric for cohesion without blocking interaction.
