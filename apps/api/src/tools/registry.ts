import type { z } from 'zod'

export interface ToolDef<T extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string
  description: string
  schema: T
  handler: (args: z.infer<T>) => Promise<unknown>
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

export async function callTool(name: string, rawArgs: unknown) {
  const t = REGISTRY.get(name)
  if (!t) throw new Error(`Tool not registered: ${name}`)
  const args = t.schema.parse(rawArgs)
  return t.handler(args as any)
}
