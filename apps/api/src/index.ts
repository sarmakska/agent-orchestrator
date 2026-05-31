import Fastify from 'fastify'
import cors from '@fastify/cors'
import { z } from 'zod'
import { startTelemetry } from './telemetry/tracing.js'
import { repository } from './state/repository.js'
import { getGraph, registeredGraphs } from './graph/executor.js'
import { enqueueRun, startWorker } from './queue/runQueue.js'
import './graphs/index.js'

startTelemetry()

const PORT = Number(process.env.API_PORT || 4000)

export async function buildServer() {
  const fastify = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } })
  await fastify.register(cors, { origin: true })

  fastify.get('/health', async () => ({ ok: true, version: '1.1.0' }))

  fastify.get('/graphs', async () => registeredGraphs().map((g) => g.toShape()))

  fastify.get('/graphs/:name', async (req, reply) => {
    const { name } = req.params as { name: string }
    const g = getGraph(name)
    if (!g) return reply.code(404).send({ error: `Graph ${name} not registered` })
    return g.toShape()
  })

  const RunSchema = z.object({
    graph: z.string(),
    input: z.record(z.string(), z.any()).default({}),
  })

  fastify.post('/runs', async (req, reply) => {
    const body = RunSchema.parse(req.body)
    if (!getGraph(body.graph)) {
      return reply.code(400).send({ error: `Graph ${body.graph} not registered` })
    }
    const run = await repository.createRun({ graph: body.graph, input: body.input })
    enqueueRun(run.id).catch((e) => fastify.log.error(e, 'enqueue failed'))
    return reply.code(202).send({ id: run.id, status: 'started' })
  })

  fastify.get('/runs', async (req) => {
    const { limit } = req.query as { limit?: string }
    return repository.listRuns(limit ? Number(limit) : undefined)
  })

  fastify.get('/runs/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const run = await repository.getRun(id)
    if (!run) return reply.code(404).send({ error: 'Run not found' })
    return run
  })

  fastify.get('/runs/:id/trace', async (req) => {
    const { id } = req.params as { id: string }
    return repository.getTrace(id)
  })

  fastify.post('/runs/:id/replay', async (req) => {
    const { id } = req.params as { id: string }
    const { fromStep } = (req.body ?? {}) as { fromStep?: number }
    const replay = await repository.replayRun(id, fromStep)
    enqueueRun(replay.id).catch((e) => fastify.log.error(e, 'replay enqueue failed'))
    return { id: replay.id, replayedFrom: id, fromStep: fromStep ?? 0 }
  })

  return fastify
}

const isEntrypoint = process.argv[1] && import.meta.url === `file://${process.argv[1]}`

if (isEntrypoint) {
  const fastify = await buildServer()
  const worker = startWorker()
  if (worker) fastify.log.info('run worker started (BullMQ)')
  await fastify.listen({ host: '0.0.0.0', port: PORT })
  fastify.log.info(`agent-orchestrator-api listening on :${PORT}`)
}
