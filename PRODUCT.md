# Product Context: Blast Radius

## Register

Product UI. This is the working interface for an autonomous privacy agent, not a marketing page, portfolio, or architecture explainer.

## Product Purpose

Blast Radius helps people find personal information exposed online, understand which records likely belong to them, and remove or suppress it with minimal manual work. The agent decides where to search, sends work to specialist subagents, asks a question only when identity or authorization is unclear, rehearses consequential actions, and continues within a standing scope.

The repository contains the customer-facing UI and a server-side TrueForge
session proxy. When the runtime is configured, requests use the provisioned
`blast-radius` agent; a direct MCP path remains available for local connector
validation. Disconnected states must never claim that a live source was
searched or that a removal occurred unless a connected tool confirms it.

## Primary Users

People who discover that their address, phone number, family links, profiles, or account information are exposed online. They are not expected to understand databases, MCP, retention policies, foreign keys, or deletion plans.

## Desired Outcome

Within 30 seconds, a person should be able to state a goal in plain language, see useful work begin, understand what the agent is doing, and know when their input is required.

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
- Surface uncertainty, source provenance, and confidence without exposing internal chain of thought.
- Treat the existing approval system as the policy engine. Standing authorization satisfies routine in-scope actions; out-of-scope or conflicting actions interrupt the user.
- Rehearse destructive work before execution and preserve rollback evidence.
- Keep disconnected states honest. No live execution claims without a tool result.

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

Calm, private, reassuring, and forensic. Lead with plain language, with technical evidence available when needed.

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
