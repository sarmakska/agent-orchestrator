import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { graph } from '../src/graph/definition.js'
import { TokenBudget } from '../src/budgets/tokens.js'
import { ToolBudget } from '../src/budgets/tools.js'
import { callTool, getTool, tool } from '../src/tools/registry.js'

describe('graph DSL', () => {
  it('builds a typed graph with nodes, edges and budgets', () => {
    const g = graph('research-swarm')
      .node('plan', { agent: 'supervisor', llm: 'sarmalink' })
      .node('search', { agent: 'pipeline', tools: ['web_search'] })
      .edge('plan', 'search')
      .budget({ tokens: 50000, tools: 100, wallClockSec: 300 })

    expect(g.name).toBe('research-swarm')
    expect(g.nodes.size).toBe(2)
    expect(g.nodes.get('plan')?.agent).toBe('supervisor')
    expect(g.edges).toHaveLength(1)
    expect(g.edges[0]).toMatchObject({ from: 'plan', to: 'search' })
    expect(g.budgets.tokens).toBe(50000)
  })
})

describe('budgets', () => {
  it('halts execution when the token budget is exceeded', () => {
    const budget = new TokenBudget(100)
    budget.consume(60)
    expect(budget.remaining()).toBe(40)
    expect(() => budget.consume(50)).toThrow(/Token budget exceeded/)
  })

  it('halts execution when the tool budget is exceeded', () => {
    const budget = new ToolBudget(1)
    budget.call()
    expect(() => budget.call()).toThrow(/Tool budget exceeded/)
  })
})

describe('tool registry', () => {
  it('registers a tool and validates arguments against its schema', async () => {
    tool('echo', {
      description: 'Echoes its input back',
      schema: z.object({ message: z.string() }),
      handler: async ({ message }) => ({ message }),
    })

    expect(getTool('echo')?.name).toBe('echo')
    await expect(callTool('echo', { message: 'hello' })).resolves.toEqual({ message: 'hello' })
    await expect(callTool('echo', { message: 42 })).rejects.toThrow()
    await expect(callTool('missing', {})).rejects.toThrow(/Tool not registered/)
  })
})
