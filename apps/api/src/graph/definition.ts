/**
 * Typed graph DSL.
 *
 *   const g = graph('my-graph')
 *     .node('a', { agent: 'pipeline', llm: 'sarmalink' })
 *     .node('b', { agent: 'pipeline', tools: ['web_search'] })
 *     .edge('a', 'b')
 *     .budget({ tokens: 10000, tools: 50, wallClockSec: 120 })
 */

export type AgentKind = 'supervisor' | 'swarm' | 'pipeline'

export interface NodeDef {
  name: string
  agent: AgentKind
  llm?: string
  tools?: string[]
  concurrency?: number
}

export interface EdgeDef {
  from: string
  to: string
  when?: (ctx: Record<string, unknown>) => boolean
}

export interface BudgetDef {
  tokens?: number
  tools?: number
  wallClockSec?: number
}

export class Graph {
  readonly name: string
  readonly nodes = new Map<string, NodeDef>()
  readonly edges: EdgeDef[] = []
  budgets: BudgetDef = {}

  constructor(name: string) {
    this.name = name
  }

  node(name: string, def: Omit<NodeDef, 'name'>): this {
    this.nodes.set(name, { name, ...def })
    return this
  }

  edge(from: string, to: string, when?: EdgeDef['when']): this {
    this.edges.push({ from, to, when })
    return this
  }

  budget(b: BudgetDef): this {
    this.budgets = { ...this.budgets, ...b }
    return this
  }
}

export function graph(name: string) {
  return new Graph(name)
}
