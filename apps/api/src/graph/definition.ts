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
  /** Total LLM tokens across the whole run. */
  tokens?: number
  /** Total tool-call invocations across the whole run. */
  tools?: number
  /** Total wall-clock seconds before the run is aborted. */
  wallClockSec?: number
  /** Optional per-tool call caps, keyed by tool name. Enforced alongside the global tool cap. */
  perTool?: Record<string, number>
}

/** Serialisable shape of a graph, used by the inspector to draw the topology. */
export interface GraphShape {
  name: string
  nodes: NodeDef[]
  edges: { from: string; to: string; conditional: boolean }[]
  budgets: BudgetDef
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

  /** Entry nodes are those no edge points to. */
  entryNodes(): NodeDef[] {
    return [...this.nodes.values()].filter((n) => !this.edges.some((e) => e.to === n.name))
  }

  toShape(): GraphShape {
    return {
      name: this.name,
      nodes: [...this.nodes.values()],
      edges: this.edges.map((e) => ({ from: e.from, to: e.to, conditional: Boolean(e.when) })),
      budgets: this.budgets,
    }
  }
}

export function graph(name: string) {
  return new Graph(name)
}
