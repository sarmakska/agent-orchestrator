import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { graph } from '../src/graph/definition.js'
import { clearGraphs, Executor, register } from '../src/graph/executor.js'
import { repository, setStore } from '../src/state/repository.js'
import { MemoryStore } from '../src/state/memoryStore.js'
import { tool } from '../src/tools/registry.js'

// These tests exercise the full execute path against the in-memory store, with
// no Postgres or Redis. The LLM adapter runs in offline mode (no API key), so
// everything is deterministic.

beforeEach(() => {
  delete process.env.SARMALINK_API_KEY
  delete process.env.DATABASE_URL
  delete process.env.REDIS_URL
  setStore(new MemoryStore())
  clearGraphs()
})

afterEach(() => {
  clearGraphs()
})

describe('executor end-to-end', () => {
  it('runs a multi-node graph to completion and records a trace', async () => {
    tool('e2e_search', {
      description: 'test tool',
      schema: z.object({}).passthrough(),
      handler: async () => ({ hits: 3 }),
    })
    const g = graph('e2e-pipeline')
      .node('plan', { agent: 'supervisor', llm: 'sarmalink' })
      .node('search', { agent: 'pipeline', tools: ['e2e_search'] })
      .node('summarise', { agent: 'pipeline', llm: 'sarmalink' })
      .edge('plan', 'search')
      .edge('search', 'summarise')
      .budget({ tokens: 50000, tools: 10, wallClockSec: 60 })
    register(g)

    const run = await repository.createRun({ graph: 'e2e-pipeline', input: { topic: 'durable agents' } })
    await Executor.start(run.id)

    const finished = await repository.getRun(run.id)
    expect(finished?.status).toBe('completed')
    expect(finished?.toolsUsed).toBe(1)
    expect(finished?.tokensUsed).toBeGreaterThan(0)

    const trace = await repository.getTrace(run.id)
    const exits = trace.filter((t) => t.kind === 'exit').map((t) => t.node)
    expect(exits).toEqual(['plan', 'search', 'summarise'])
  })

  it('follows only conditional edges whose predicate is satisfied', async () => {
    tool('e2e_refund', {
      description: 'refund',
      schema: z.object({}).passthrough(),
      handler: async () => ({ ok: true }),
    })
    const g = graph('e2e-triage')
      .node('classify', { agent: 'supervisor', llm: 'sarmalink' })
      .node('refund', { agent: 'pipeline', tools: ['e2e_refund'] })
      .node('escalate', { agent: 'pipeline' })
      .edge('classify', 'refund', (ctx) => (ctx.input as any)?.intent === 'refund')
      .edge('classify', 'escalate', (ctx) => (ctx.input as any)?.intent !== 'refund')
      .budget({ tokens: 8000, tools: 10, wallClockSec: 60 })
    register(g)

    const run = await repository.createRun({ graph: 'e2e-triage', input: { intent: 'refund' } })
    await Executor.start(run.id)

    const trace = await repository.getTrace(run.id)
    const exits = trace.filter((t) => t.kind === 'exit').map((t) => t.node)
    expect(exits).toContain('refund')
    expect(exits).not.toContain('escalate')
  })

  it('halts with budget_exceeded when the tool budget is breached', async () => {
    tool('e2e_spam', {
      description: 'spam tool',
      schema: z.object({}).passthrough(),
      handler: async () => ({}),
    })
    const g = graph('e2e-budget')
      .node('a', { agent: 'pipeline', tools: ['e2e_spam', 'e2e_spam'] })
      .budget({ tools: 1 })
    register(g)

    const run = await repository.createRun({ graph: 'e2e-budget', input: {} })
    await Executor.start(run.id)

    const finished = await repository.getRun(run.id)
    expect(finished?.status).toBe('budget_exceeded')
    expect(finished?.error).toMatch(/Tool budget exceeded/)
  })

  it('replays a completed run from a checkpointed step without re-running earlier nodes', async () => {
    const g = graph('e2e-replay')
      .node('first', { agent: 'pipeline', llm: 'sarmalink' })
      .node('second', { agent: 'pipeline', llm: 'sarmalink' })
      .edge('first', 'second')
      .budget({ tokens: 50000 })
    register(g)

    const run = await repository.createRun({ graph: 'e2e-replay', input: { seed: 1 } })
    await Executor.start(run.id)
    expect((await repository.getRun(run.id))?.status).toBe('completed')

    const replay = await repository.replayRun(run.id, 1)
    await Executor.start(replay.id)

    const finished = await repository.getRun(replay.id)
    expect(finished?.status).toBe('completed')

    const trace = await repository.getTrace(replay.id)
    expect(trace.some((t) => t.kind === 'replay')).toBe(true)
    const exits = trace.filter((t) => t.kind === 'exit').map((t) => t.node)
    // 'first' was restored from the checkpoint, so only 'second' is re-executed.
    expect(exits).toEqual(['second'])
  })
})
