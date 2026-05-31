import { SpanStatusCode } from '@opentelemetry/api'
import { repository } from '../state/repository.js'
import { RunBudget } from '../budgets/runBudget.js'
import { BudgetExceededError } from '../budgets/tokens.js'
import { tracer } from '../telemetry/tracing.js'
import { runNode } from './agents.js'
import type { Graph } from './definition.js'

const REGISTRY = new Map<string, Graph>()

export function register(g: Graph): void {
  REGISTRY.set(g.name, g)
}

export function getGraph(name: string): Graph | undefined {
  return REGISTRY.get(name)
}

export function registeredGraphs(): Graph[] {
  return [...REGISTRY.values()]
}

/** Reset the registry. Used by tests to avoid cross-test leakage. */
export function clearGraphs(): void {
  REGISTRY.clear()
}

export const Executor = {
  /**
   * Walk a run's graph to completion.
   *
   * Budgets are enforced through a single RunBudget: every LLM and tool call is
   * charged, and a breach aborts the run via the budget's AbortSignal. Each node
   * exit is checkpointed, so a replay run can resume from a recorded step rather
   * than re-executing earlier nodes. The whole run, and every node within it, is
   * wrapped in OpenTelemetry spans.
   */
  async start(runId: string): Promise<void> {
    const run = await repository.getRun(runId)
    if (!run) throw new Error('Run not found')
    const graph = REGISTRY.get(run.graph)
    if (!graph) {
      await repository.setStatus(runId, 'failed', { error: `Graph ${run.graph} not registered`, finishedAt: new Date() })
      return
    }

    await tracer().startActiveSpan(`run ${graph.name}`, async (span) => {
      span.setAttribute('run.id', runId)
      span.setAttribute('graph.name', graph.name)
      await repository.setStatus(runId, 'running', {
        budgetTokens: graph.budgets.tokens ?? null,
        budgetTools: graph.budgets.tools ?? null,
        budgetWallSec: graph.budgets.wallClockSec ?? null,
      })

      const budget = new RunBudget(graph.budgets)
      const ctx: Record<string, unknown> = { input: run.input }
      const visited = new Set<string>()
      let step = 0

      // Replay: rehydrate context from the latest checkpoint at or before the
      // requested step on the original run, and mark earlier nodes as visited.
      if (run.replayOf) {
        const from = run.replayFromStep ?? 0
        const cp = await repository.latestCheckpoint(run.replayOf, from)
        if (cp) {
          Object.assign(ctx, cp.state)
          for (const key of Object.keys(cp.state)) {
            if (graph.nodes.has(key)) visited.add(key)
          }
          step = cp.step
          await repository.appendTrace({
            runId, step, node: '_replay', kind: 'replay',
            payload: { replayOf: run.replayOf, resumedFromStep: cp.step, restoredNodes: [...visited] },
          })
        }
      }

      const queue = graph.entryNodes().filter((n) => !visited.has(n.name))

      // After a replay restore, seed the queue with nodes whose upstreams are
      // all satisfied by the restored set, so the walk resumes from the cut.
      if (visited.size > 0) {
        for (const node of graph.nodes.values()) {
          if (visited.has(node.name) || queue.includes(node)) continue
          const incoming = graph.edges.filter((e) => e.to === node.name)
          const reachable =
            incoming.length > 0 &&
            incoming.every((e) => visited.has(e.from)) &&
            incoming.some((e) => !e.when || e.when(ctx))
          if (reachable) queue.push(node)
        }
      }

      try {
        while (queue.length > 0) {
          const node = queue.shift()!
          if (visited.has(node.name)) continue
          visited.add(node.name)

          step++
          const nodeStart = Date.now()
          await repository.appendTrace({ runId, step, node: node.name, kind: 'enter', payload: { agent: node.agent } })

          budget.checkWallClock()
          const result = await tracer().startActiveSpan(`node ${node.name}`, async (nodeSpan) => {
            nodeSpan.setAttribute('node.agent', node.agent)
            try {
              return await runNode(node, ctx, budget)
            } catch (e) {
              nodeSpan.recordException(e as Error)
              nodeSpan.setStatus({ code: SpanStatusCode.ERROR })
              throw e
            } finally {
              nodeSpan.end()
            }
          })

          ctx[node.name] = result.output
          const snap = budget.snapshot()
          await repository.setStatus(runId, 'running', { tokensUsed: snap.tokensUsed, toolsUsed: snap.toolsUsed })
          await repository.checkpoint(runId, step, structuredClone(ctx))
          await repository.appendTrace({
            runId, step, node: node.name, kind: 'exit',
            payload: { result, ...snap }, durationMs: Date.now() - nodeStart,
          })

          for (const edge of graph.edges) {
            if (edge.from !== node.name) continue
            const next = graph.nodes.get(edge.to)
            if (!next || visited.has(next.name)) continue
            const upstreamSatisfied = graph.edges
              .filter((e) => e.to === next.name)
              .every((e) => visited.has(e.from))
            if (upstreamSatisfied && (!edge.when || edge.when(ctx))) queue.push(next)
          }
        }

        await repository.setStatus(runId, 'completed', {
          output: ctx,
          finishedAt: new Date(),
          ...budget.snapshot(),
        })
        span.setStatus({ code: SpanStatusCode.OK })
      } catch (e) {
        const snap = budget.snapshot()
        await repository.appendTrace({
          runId, step, node: 'executor', kind: 'error', payload: { error: (e as Error).message },
        })
        const status = e instanceof BudgetExceededError ? 'budget_exceeded' : 'failed'
        await repository.setStatus(runId, status, {
          error: (e as Error).message,
          finishedAt: new Date(),
          tokensUsed: snap.tokensUsed,
          toolsUsed: snap.toolsUsed,
        })
        span.recordException(e as Error)
        span.setStatus({ code: SpanStatusCode.ERROR })
      } finally {
        span.end()
      }
    })
  },
}
