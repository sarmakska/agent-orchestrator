import type { z } from 'zod'
import type { RunBudget } from '../budgets/runBudget.js'

export interface ToolDef<T extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string
  description: string
  schema: T
  handler: (args: z.infer<T>) => Promise<unknown>
  /** Marks tools surfaced over the Model Context Protocol. Budget enforcement is identical. */
  mcp?: boolean
}

const REGISTRY = new Map<string, ToolDef>()

export function tool<T extends z.ZodTypeAny>(name: string, def: Omit<ToolDef<T>, 'name'>): ToolDef<T> {
  const t = { name, ...def }
  REGISTRY.set(name, t as ToolDef)
  return t
}

export function getTool(name: string): ToolDef | undefined {
  return REGISTRY.get(name)
}

export function listTools(): ToolDef[] {
  return [...REGISTRY.values()]
}

/**
 * Invoke a registered tool.
 *
 * Arguments are validated against the tool's Zod schema before the handler
 * runs. When a RunBudget is supplied the call is charged against the run's
 * tool-call budget first, so a breach aborts before any side effect. MCP tools
 * and built-in tools share the same budget and the same code path.
 */
export async function callTool(name: string, rawArgs: unknown, budget?: RunBudget) {
  const t = REGISTRY.get(name)
  if (!t) throw new Error(`Tool not registered: ${name}`)
  budget?.callTool(name)
  const args = t.schema.parse(rawArgs)
  return t.handler(args as any)
}
