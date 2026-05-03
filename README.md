# agent-orchestrator

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/Node-22-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Postgres](https://img.shields.io/badge/Postgres-17-336791?logo=postgresql&logoColor=white)](https://postgresql.org)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-C5F74F)](https://orm.drizzle.team)
[![Open Source](https://img.shields.io/badge/Open_Source-%E2%9D%A4-red)](https://github.com/sarmakska/agent-orchestrator)

**Multi-agent workflows with deterministic replay, durable state, and tool budgets.**

Built by [Sarma Linux](https://sarmalinux.com).

---

## What this is

Most agent frameworks are demos with delusions of grandeur. They fall over the moment a tool times out or a model hallucinates a parameter. This orchestrator is built around the assumption that everything will fail, repeatedly, and that you need to debug what your agents did six hours after the fact.

Workflows are typed graphs. State is durable in Postgres. Every step writes a trace event that can be replayed deterministically. Agents have explicit tool, token, and wall-clock budgets, all enforced. Supports supervisor, swarm, and pipeline patterns. Ships with a web inspector to walk runs step by step.

## Architecture

```mermaid
graph LR
  C[Client SDK] --> API[Fastify API]
  API --> EX[Graph Executor]
  EX --> R[Tool Registry]
  R --> T1[builtin: web_search]
  R --> T2[builtin: sql]
  R --> T3[your tools]
  EX --> LLM[LLM provider]
  EX --> S[(Postgres state)]
  EX --> Q[Redis BullMQ]
  S --> I[Inspector UI]
  Q --> EX

  classDef ext fill:#a78bfa,stroke:#a78bfa,color:#fff
  class LLM ext
```

## Why another orchestrator

Honest answer: every existing framework I tried in production left me debugging strange failures at 2am. The orchestrators that survive 2am have these properties:

1. **Durable state.** Process crashes, resumes from the last checkpoint.
2. **Deterministic replay.** Given the trace, I can reproduce the run exactly.
3. **Hard budgets.** Token, tool-call, and wall-clock limits that actually halt execution.
4. **Visible execution.** Every step recorded, queryable, replayable from any point.

This orchestrator has all four. Most don't.

## Quick start

```bash
git clone https://github.com/sarmakska/agent-orchestrator.git
cd agent-orchestrator
pnpm install
docker compose up -d postgres redis
cp .env.example .env
pnpm migrate
pnpm dev
```

Inspector at `http://localhost:3000`. API at `http://localhost:4000`.

## Defining a graph

```ts
import { graph } from '@sarmalinux/agent-orchestrator'

export const research = graph('research-swarm')
  .node('plan',     { agent: 'supervisor', llm: 'sarmalink' })
  .node('search',   { agent: 'pipeline',   tools: ['web_search'] })
  .node('analyse',  { agent: 'swarm',      llm: 'sarmalink', concurrency: 3 })
  .node('summarise',{ agent: 'pipeline',   llm: 'sarmalink' })
  .edge('plan', 'search')
  .edge('search', 'analyse')
  .edge('analyse', 'summarise')
  .budget({ tokens: 50000, tools: 100, wallClockSec: 300 })
```

Run:

```ts
const run = await research.run({ topic: 'mediasoup vs LiveKit in 2026' })
console.log(run.id)  // inspect at http://localhost:3000/runs/<run.id>
```

## Tool authoring

```ts
import { tool } from '@sarmalinux/agent-orchestrator'
import { z } from 'zod'

export const stripeRefund = tool('stripe_refund', {
  description: 'Refund a Stripe charge by ID',
  schema: z.object({ chargeId: z.string(), amountPence: z.number().int() }),
  handler: async ({ chargeId, amountPence }) => {
    // call Stripe...
    return { refundId: 're_...' }
  },
})
```

Drop into the registry, reference by name from any node.

## Roadmap

- [x] Graph DSL with typed nodes and edges
- [x] Postgres-backed durable state
- [x] Deterministic replay
- [x] Token / tool / wall-clock budgets
- [x] Supervisor, swarm, pipeline patterns
- [x] Inspector UI with live graph view
- [ ] Per-tool rate limits
- [ ] Cost dashboards
- [ ] OpenTelemetry trace export
- [ ] kubectl-style CLI

## License

MIT.

Built by [Sarma Linux](https://sarmalinux.com).
