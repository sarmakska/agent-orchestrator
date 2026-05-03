import { repository } from '../state/repository.js'
import type { Graph } from './definition.js'

const REGISTRY = new Map<string, Graph>()

export function register(g: Graph) {
  REGISTRY.set(g.name, g)
}

export const Executor = {
  async start(runId: string) {
    const run = await repository.getRun(runId)
    if (!run) throw new Error('Run not found')
    const graph = REGISTRY.get(run.graph)
    if (!graph) {
      await repository.setStatus(runId, 'failed', { error: `Graph ${run.graph} not registered` })
      return
    }
    await repository.setStatus(runId, 'running')

    const start = Date.now()
    let step = 0
    const ctx: Record<string, unknown> = { input: run.input }

    // Topological-ish walk
    const visited = new Set<string>()
    const queue = [...graph.nodes.values()].filter(
      (n) => !graph.edges.some((e) => e.to === n.name),
    )

    while (queue.length > 0) {
      const node = queue.shift()!
      if (visited.has(node.name)) continue
      visited.add(node.name)

      step++
      const nodeStart = Date.now()
      await repository.appendTrace({ runId, step, node: node.name, kind: 'enter', payload: { ctx } })

      try {
        const result = await runNode(runId, step, node, ctx, graph)
        ctx[node.name] = result
        await repository.checkpoint(runId, step, ctx)
        await repository.appendTrace({
          runId, step, node: node.name, kind: 'exit',
          payload: { result }, durationMs: Date.now() - nodeStart,
        })
      } catch (e) {
        await repository.appendTrace({
          runId, step, node: node.name, kind: 'error',
          payload: { error: (e as Error).message }, durationMs: Date.now() - nodeStart,
        })
        await repository.setStatus(runId, 'failed', { error: (e as Error).message, finishedAt: new Date() })
        return
      }

      const elapsed = (Date.now() - start) / 1000
      if (graph.budgets.wallClockSec && elapsed > graph.budgets.wallClockSec) {
        await repository.setStatus(runId, 'budget_exceeded', { error: 'wall-clock budget exceeded', finishedAt: new Date() })
        return
      }

      // Enqueue downstream nodes whose dependencies are satisfied
      for (const edge of graph.edges) {
        if (edge.from === node.name) {
          const next = graph.nodes.get(edge.to)
          if (!next || visited.has(next.name)) continue
          const upstreamSatisfied = graph.edges
            .filter((e) => e.to === next.name)
            .every((e) => visited.has(e.from))
          if (upstreamSatisfied) {
            if (!edge.when || edge.when(ctx)) queue.push(next)
          }
        }
      }
    }

    await repository.setStatus(runId, 'completed', { output: ctx, finishedAt: new Date() })
  },
}

async function runNode(_runId: string, _step: number, node: any, ctx: Record<string, unknown>, _graph: Graph): Promise<unknown> {
  // Real implementation: dispatch to agent kind (supervisor / swarm / pipeline),
  // call LLM via adapter, invoke tools through registry. The starter returns a
  // structured stub; replace with concrete adapters as you wire providers.
  return { node: node.name, agent: node.agent, processedAt: Date.now() }
}
