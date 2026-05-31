# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Real agent dispatch in the executor. The `supervisor`, `swarm`, and `pipeline`
  node kinds now call the LLM adapter and the tool registry rather than returning
  a placeholder. Swarm nodes fan out `concurrency` parallel LLM passes.
- Hard budget enforcement wired into the executor through a single `RunBudget`.
  Token, tool-call, and wall-clock limits are charged on every LLM and tool call,
  and a breach aborts the run via an `AbortSignal` and lands it in
  `budget_exceeded`.
- Per-tool call caps via `budget({ perTool: { web_search: 20 } })`, enforced
  alongside the global tool cap.
- OpenTelemetry tracing. Every run, node, LLM call, and tool call is wrapped in a
  span. Spans export over OTLP/HTTP when `OTEL_EXPORTER_OTLP_ENDPOINT` is set.
- BullMQ run queue with a configurable retry policy (attempts plus exponential
  backoff). Runs degrade to in-process execution when `REDIS_URL` is unset.
- Model Context Protocol (MCP) tool adapter. MCP tools live in the same registry
  as built-in tools and are charged against the same tool budget, so an agent
  cannot dodge the cap by routing through MCP.
- Deterministic replay from a checkpointed step. A replay run rehydrates context
  from the latest checkpoint at or before the requested step and resumes the walk
  without re-executing earlier nodes.
- Pluggable state store. A Postgres-backed store is the durable default; an
  in-memory store is used for tests and offline development. Both satisfy one
  `StateStore` interface.
- Inspector: agent-graph visualisation. A run detail page draws the graph
  topology as SVG, highlights executed nodes, and lists the per-step trace.
- API: `GET /runs`, `GET /graphs`, and `GET /graphs/:name` endpoints. `POST /runs`
  now rejects unregistered graphs and returns `202 Accepted`.
- Worked examples under `apps/api/examples`: a research swarm and a conditional
  support triage graph, both registered at start-up.
- End-to-end tests covering the executor, the HTTP API, budgets, MCP enforcement,
  and replay, all runnable with no Postgres or Redis.
- `drizzle.config.ts` for migration generation.

### Changed

- The LLM adapter returns token usage and accepts an `AbortSignal`. With no API
  key it runs in offline mode and returns deterministic output.
- The `runs` table gained `replay_of` and `replay_from_step` columns to track
  replay lineage.
- CI runs on Node 24 and uses `pnpm/action-setup@v4`.
- Security contact moved to security@sarmalinux.com with a supported-versions
  block.
- Bumped `@types/node` to 25 to match the runtime.

### Notes

- Major dependency upgrades (Next.js 16, TypeScript 6, Vitest 4, Zod 4, Drizzle
  ORM 0.45) are tracked as open issues and deliberately held until they can be
  validated, rather than applied blind.

## [1.0.0]

- Initial public release: typed graph DSL, Postgres-backed durable state via
  Drizzle, trace events per step, checkpoints, budget primitives, the SarmaLink
  LLM adapter, and the Next.js inspector run list.
