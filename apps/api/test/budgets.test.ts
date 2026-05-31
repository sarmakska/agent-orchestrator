import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { RunBudget } from '../src/budgets/runBudget.js'
import { BudgetExceededError } from '../src/budgets/tokens.js'
import { ToolBudget } from '../src/budgets/tools.js'
import { callTool, tool } from '../src/tools/registry.js'
import { registerMcpTool } from '../src/tools/mcp.js'
import { jobOptions, defaultRetryPolicy } from '../src/queue/runQueue.js'

describe('per-tool budgets', () => {
  it('enforces a per-tool cap independently of the global cap', () => {
    const budget = new ToolBudget(10, { web_search: 1 })
    budget.call('web_search')
    expect(() => budget.call('web_search')).toThrow(/Per-tool budget exceeded for web_search/)
  })
})

describe('RunBudget', () => {
  it('aborts its signal when the token budget is breached', () => {
    const budget = new RunBudget({ tokens: 5 })
    expect(budget.signal.aborted).toBe(false)
    expect(() => budget.consumeTokens(10)).toThrow(BudgetExceededError)
    expect(budget.signal.aborted).toBe(true)
  })
})

describe('MCP tool budget enforcement', () => {
  it('charges MCP tool calls against the same run tool budget as built-in tools', async () => {
    registerMcpTool({
      name: 'mcp_lookup',
      description: 'remote lookup',
      schema: z.object({ q: z.string() }),
      serverUrl: 'http://localhost:9/never-called',
    })
    const budget = new RunBudget({ tools: 0 })
    // Budget is charged before the handler runs, so the network is never touched.
    await expect(callTool('mcp_lookup', { q: 'x' }, budget)).rejects.toThrow(/Tool budget exceeded/)
  })

  it('shares one budget across MCP and built-in tools', () => {
    tool('local_echo', { description: 'echo', schema: z.object({}).passthrough(), handler: async () => ({}) })
    const budget = new RunBudget({ tools: 1 })
    budget.callTool('local_echo')
    expect(() => budget.callTool('mcp_lookup')).toThrow(/Tool budget exceeded/)
  })
})

describe('queue retry policy', () => {
  it('applies attempts and exponential backoff from the default policy', () => {
    const opts = jobOptions()
    expect(opts.attempts).toBe(defaultRetryPolicy.attempts)
    expect(opts.backoff).toMatchObject({ type: 'exponential' })
  })
})
