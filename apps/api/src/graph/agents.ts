import { SpanStatusCode } from '@opentelemetry/api'
import type { NodeDef } from './definition.js'
import type { RunBudget } from '../budgets/runBudget.js'
import { callSarmalink } from '../llm/sarmalink.js'
import { callTool, getTool } from '../tools/registry.js'
import { tracer } from '../telemetry/tracing.js'

export interface NodeResult {
  node: string
  agent: string
  output: unknown
  tokens: number
  toolCalls: number
}

/**
 * Run a single node according to its agent kind. Every LLM call and tool call
 * is charged against the run budget and wrapped in an OpenTelemetry span.
 *
 * - pipeline: one LLM pass, then each declared tool is invoked in order.
 * - supervisor: one LLM pass that decides routing; the content is exposed on
 *   the context so conditional edges can branch on it.
 * - swarm: `concurrency` parallel LLM passes, results merged.
 */
export async function runNode(
  node: NodeDef,
  ctx: Record<string, unknown>,
  budget: RunBudget,
): Promise<NodeResult> {
  budget.checkWallClock()
  switch (node.agent) {
    case 'swarm':
      return runSwarm(node, ctx, budget)
    case 'supervisor':
      return runSupervisor(node, ctx, budget)
    case 'pipeline':
    default:
      return runPipeline(node, ctx, budget)
  }
}

function prompt(node: NodeDef, ctx: Record<string, unknown>): string {
  return `Node ${node.name} (${node.agent}). Input: ${JSON.stringify(ctx.input ?? {})}`
}

async function llm(node: NodeDef, content: string, budget: RunBudget): Promise<string> {
  return tracer().startActiveSpan(`llm ${node.llm ?? 'sarmalink'}`, async (span) => {
    try {
      const res = await callSarmalink([{ role: 'user', content }], { signal: budget.signal })
      budget.consumeTokens(res.tokens)
      span.setAttribute('llm.tokens', res.tokens)
      return res.content
    } catch (e) {
      span.recordException(e as Error)
      span.setStatus({ code: SpanStatusCode.ERROR })
      throw e
    } finally {
      span.end()
    }
  })
}

async function invokeTools(
  node: NodeDef,
  ctx: Record<string, unknown>,
  budget: RunBudget,
): Promise<{ results: Record<string, unknown>; calls: number }> {
  const results: Record<string, unknown> = {}
  let calls = 0
  for (const name of node.tools ?? []) {
    const def = getTool(name)
    if (!def) throw new Error(`Node ${node.name} references unregistered tool: ${name}`)
    const args = buildToolArgs(def.name, ctx)
    results[name] = await tracer().startActiveSpan(`tool ${name}`, async (span) => {
      try {
        span.setAttribute('tool.mcp', Boolean(def.mcp))
        const out = await callTool(name, args, budget)
        calls++
        return out
      } catch (e) {
        span.recordException(e as Error)
        span.setStatus({ code: SpanStatusCode.ERROR })
        throw e
      } finally {
        span.end()
      }
    })
  }
  return { results, calls }
}

/** Derive tool arguments from run context. Real graphs override per tool; the
 *  default passes the run input through, which keeps the offline path working. */
function buildToolArgs(toolName: string, ctx: Record<string, unknown>): unknown {
  const input = (ctx.input ?? {}) as Record<string, unknown>
  return input[toolName] ?? input
}

async function runPipeline(node: NodeDef, ctx: Record<string, unknown>, budget: RunBudget): Promise<NodeResult> {
  let tokens = 0
  let content = ''
  if (node.llm) {
    content = await llm(node, prompt(node, ctx), budget)
    tokens = budget.snapshot().tokensUsed
  }
  const { results, calls } = await invokeTools(node, ctx, budget)
  return { node: node.name, agent: node.agent, output: { content, tools: results }, tokens, toolCalls: calls }
}

async function runSupervisor(node: NodeDef, ctx: Record<string, unknown>, budget: RunBudget): Promise<NodeResult> {
  const content = await llm(node, `${prompt(node, ctx)}\nDecide the next step.`, budget)
  return { node: node.name, agent: node.agent, output: { decision: content }, tokens: 0, toolCalls: 0 }
}

async function runSwarm(node: NodeDef, ctx: Record<string, unknown>, budget: RunBudget): Promise<NodeResult> {
  const branches = Math.max(1, node.concurrency ?? 1)
  const outputs = await Promise.all(
    Array.from({ length: branches }, (_, i) =>
      llm(node, `${prompt(node, ctx)}\nBranch ${i + 1} of ${branches}.`, budget),
    ),
  )
  const { results, calls } = await invokeTools(node, ctx, budget)
  return {
    node: node.name,
    agent: node.agent,
    output: { branches: outputs, tools: results },
    tokens: 0,
    toolCalls: calls,
  }
}
