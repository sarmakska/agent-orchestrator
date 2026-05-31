import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'

// Drive the real Fastify server through inject. No external services: the
// in-memory store and offline LLM keep the whole flow self-contained.

let app: FastifyInstance

beforeAll(async () => {
  delete process.env.DATABASE_URL
  delete process.env.REDIS_URL
  delete process.env.SARMALINK_API_KEY
  const { buildServer } = await import('../src/index.js')
  app = await buildServer()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

async function poll(id: string, attempts = 50): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const res = await app.inject({ method: 'GET', url: `/runs/${id}` })
    const status = res.json().status
    if (status === 'completed' || status === 'failed' || status === 'budget_exceeded') return status
    await new Promise((r) => setTimeout(r, 20))
  }
  throw new Error('run did not settle')
}

describe('HTTP API', () => {
  it('reports health and lists registered graphs', async () => {
    const health = await app.inject({ method: 'GET', url: '/health' })
    expect(health.json()).toMatchObject({ ok: true, version: '1.1.0' })

    const graphs = await app.inject({ method: 'GET', url: '/graphs' })
    const names = graphs.json().map((g: { name: string }) => g.name)
    expect(names).toContain('research-swarm')
    expect(names).toContain('triage')
  })

  it('exposes a single graph shape for the inspector visualisation', async () => {
    const res = await app.inject({ method: 'GET', url: '/graphs/research-swarm' })
    const shape = res.json()
    expect(shape.nodes.map((n: { name: string }) => n.name)).toEqual(['plan', 'search', 'analyse', 'summarise'])
    expect(shape.edges).toContainEqual({ from: 'plan', to: 'search', conditional: false })
  })

  it('rejects a run against an unregistered graph', async () => {
    const res = await app.inject({ method: 'POST', url: '/runs', payload: { graph: 'nope', input: {} } })
    expect(res.statusCode).toBe(400)
  })

  it('starts a run, executes it, and returns the trace', async () => {
    const start = await app.inject({
      method: 'POST',
      url: '/runs',
      payload: { graph: 'triage', input: { intent: 'escalate' } },
    })
    expect(start.statusCode).toBe(202)
    const { id } = start.json()

    const status = await poll(id)
    expect(status).toBe('completed')

    const trace = await app.inject({ method: 'GET', url: `/runs/${id}/trace` })
    const nodes = trace.json().map((t: { node: string }) => t.node)
    expect(nodes).toContain('classify')
    expect(nodes).toContain('escalate')

    const list = await app.inject({ method: 'GET', url: '/runs' })
    expect(list.json().some((r: { id: string }) => r.id === id)).toBe(true)
  })
})
