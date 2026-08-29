# Blast Radius workspace design QA

## Reference and render

- Approved written direction: /Volumes/MacExt1TB/Documents/ChatGPT/Agent Harness/.worktrees/awwwards-ui/PRODUCT.md
- Design system: /Volumes/MacExt1TB/Documents/ChatGPT/Agent Harness/.worktrees/awwwards-ui/DESIGN.md
- Static Image Gen concept, used only as a composition reference: /Users/aaravvivek/.codex/generated_images/01a045c2-6a2b-7cd1-843f-a90cfbcdf50d/exec-6263af5a-b2a7-4f4d-9338-f4097a3115cf.png
- Latest Browser/IAB render: /Users/aaravvivek/.codex/visualizations/2026/08/28/01a045c2-6a2b-7cd1-843f-a90cfbcdf50d/blast-radius-desktop-final.png
- Verified viewport: 1260 × 924 at DPR 1
- URL: http://localhost:4173/

Both reference and implementation screenshots were inspected with view_image at original detail.

## Fidelity ledger

| Comparison point | Concept evidence | Render evidence | Resolution |
|---|---|---|---|
| Product skeleton | Mission rail, central agent, evidence inspector | Same three-region shell opens immediately | Match |
| ASCII presence | Large ordered target-like ASCII field | Code-native spring ASCII owns the top of the conversation and changes by run state | Widened rings and source lanes; kept shorter vertically so the identity question remains visible |
| Typography | Serif agent voice, compact sans controls, mono evidence | Merriweather conversation and headings; Avenir Next chrome; SF Mono evidence | Match |
| Palette | Mineral white, carbon, one cobalt signal | Seven semantic OKLCH tokens, one cobalt hue, no gradients or extra status colors | Match |
| Container model | Rails, lists, hairlines, no card grid | Open mission/evidence lists; one bordered question artifact and one composer | Match |
| First-viewport hierarchy | Working agent before explanation | Mission, ASCII state, user request, agent declaration, and required question all visible | Match after reducing vertical dead space |
| Feature coverage | Agent, evidence, subagents, scope, rehearsal, audit | All seven harness tools, connector health, blast radius, rollback, compaction, scope, and audit are present | Match |
| Interaction | Conversation drives agent work | Yes/no clarification, alternate-city answer, autonomous run, pause/resume, new mission, archived missions, evidence reveal, connector errors | Verified |

## Above-the-fold copy

The implementation keeps the approved product copy and adds only functional or honesty-critical strings: Synthetic demo, No live removal, the identity disambiguation question, and the standing authorization state. No marketing eyebrow, feature claim, fake metric, or portfolio copy was added.

## Browser checks

- Page identity: passed
- Meaningful DOM: passed
- Framework overlay: none
- Console warnings/errors: none
- First viewport screenshot: passed
- Clarifying-question path: passed
- Alternate-city path: passed
- Autonomous completion: passed
- Pause and resume: passed; state and timer remained held
- Empty connector error: passed
- Synthetic-data honesty: passed

## Responsive note

The implementation includes dedicated 1120px and 760px rail/sheet layouts, fixed 100dvh, and body overflow containment. A separate mobile screenshot could not be captured because Browser/IAB blocked the isolated mobile-frame URL under its URL security policy. No alternate browser workaround was used.

## Sign-off

Desktop implementation is coherent with the approved design: hierarchy, typography, palette, container model, and the complete core interaction have no material mismatch. The only unrendered QA item is a separate narrow-viewport screenshot.
