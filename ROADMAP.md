# Roadmap

## Shipped (1.1.0)

- [x] Typed graph DSL with conditional edges
- [x] Postgres-backed durable state via Drizzle ORM, with an in-memory store for tests
- [x] Trace events per step and checkpoints
- [x] Real agent dispatch: supervisor, swarm, pipeline
- [x] Hard token / tool / wall-clock budgets enforced via AbortSignal
- [x] Per-tool call caps
- [x] Deterministic replay from a checkpointed step
- [x] BullMQ run queue with retry policies, in-process fallback
- [x] OpenTelemetry traces for runs, nodes, LLM calls, and tool calls
- [x] MCP tool adapter, budgeted through the shared registry
- [x] Next.js inspector with a run list, a run detail view, and an agent-graph visualisation
- [x] SarmaLink LLM adapter with an offline mode

## Planned

- [ ] Cost dashboard in the inspector (currency per run, per node, per tool)
- [ ] Per-tool rate limits (distinct from per-tool call caps)
- [ ] Streaming tool results so long-running tools surface progress
- [ ] CLI: `orchestrator runs ls / inspect / replay`
- [ ] Metric and log signals alongside OpenTelemetry traces
- [ ] Helm chart for Kubernetes deployment

## Won't ship

- Visual graph editor. Graphs are defined in code.
- Hosted SaaS. You run it yourself.
- Plugin marketplace. Use git for distribution.

## Contribute

Pull requests are welcome. Pick something from "Planned", open an issue, fork,
branch, and raise a PR. I will not merge ORM swaps (Drizzle stays), synchronous
executors (durability requires async), or anything that breaks the
OpenAI-compatible LLM adapter contract.

Releases are listed under [GitHub Releases](https://github.com/sarmakska/agent-orchestrator/releases).
