# Product Context: Blast Radius

## Register

Product UI. This is the working interface for an autonomous privacy agent, not a marketing page, portfolio, or architecture explainer.

## Product Purpose

Blast Radius helps ordinary people find personal information exposed across the internet, understand which records likely belong to them, and remove or suppress that information with minimal manual work. The agent reasons about what to search for, fans work out to specialist subagents, asks the person a question only when identity or authorization is ambiguous, rehearses consequential actions, then continues autonomously inside a standing scope.

The current repository is a frontend demonstration backed by synthetic customer 4471. It must distinguish simulated evidence from connected tools. Never claim that a live source was searched or that a removal occurred unless a connected tool confirms it.

## Primary Users

People who discover that their address, phone number, family links, profiles, or account information are exposed online. They are not expected to understand databases, MCP, retention policies, foreign keys, or deletion plans.

## Desired Outcome

Within 30 seconds, a person should be able to state the goal in plain language, see that the agent has begun useful work, understand what it is doing, and know when their input is genuinely required.

## Core Journey

1. The person describes the privacy goal in natural language.
2. The agent infers likely identity attributes and search categories.
3. Specialist subagents search sources in parallel and return evidence.
4. The agent asks a conversational question only when a match is ambiguous.
5. The agent correlates evidence, checks policy and dependency conflicts, and rehearses the removal plan in a safe copy.
6. The agent executes permitted work autonomously inside standing authorization.
7. The agent monitors outcomes, records provenance, and reports unresolved sources.

## Agent Contract

- Reason before asking. Do not turn the conversation into a form.
- Ask only questions that materially change identity, scope, or authorization.
- Operate autonomously inside the user's standing scope.
- Surface uncertainty, source provenance, and confidence without dumping internal chain of thought.
- Treat the existing approval system as the policy engine. Standing authorization satisfies routine in-scope actions; out-of-scope or conflicting actions interrupt the user.
- Rehearse destructive work before execution and preserve rollback evidence.
- Keep the synthetic demo honest. No live execution claims.

## Required Capability Coverage

- Natural-language missions and agent questions
- Dynamic parallel subagents
- Connector configuration and health testing
- Subject identity resolution and record discovery
- Schema and relationship inspection
- Retention and policy conflict detection
- Blast-radius visualization
- Shadow snapshot and deletion rehearsal
- Standing authorization and scope controls
- Autonomous execution history
- Rollback and audit evidence
- Compacted large tool responses with expandable details
- Loading, empty, error, paused, completed, and disconnected states

## Personality

Calm, private, reassuring, and forensic. Plain language first; technical evidence remains one disclosure away.

## Strategic Principles

- Open on the agent workspace, never on a hero or feature parade.
- Make agent state visible through conversation, evidence, and purposeful ASCII motion.
- Keep the center focused on the person's mission. Put technical depth in the inspector.
- Use progressive disclosure instead of nested cards, modal stacks, or jargon.
- Preserve the Mews/Spark behavior: interruptible agent runs, live activity, subagent state, connector configuration, and responsive ASCII movement.

## Anti-References

- Portfolio website framing
- SaaS landing-page clichés
- Generic AI chat clone with an empty message column
- Terminal cosplay and unreadable ASCII noise
- Multicolored dashboards and arbitrary status palettes
- Neon lime, purple gradients, glassmorphism, glowing blobs, and pill overload
- Repeated feature-card grids
- Architecture explanation before the working agent

