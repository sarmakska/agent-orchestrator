import Fastify from 'fastify'
import { z } from 'zod'
import { repository } from './state/repository.js'
import { Executor } from './graph/executor.js'

const PORT = Number(process.env.API_PORT || 4000)

const fastify = Fastify({ logger: { level: 'info' } })

fastify.get('/health', async () => ({ ok: true, version: '1.0.0' }))

const RunSchema = z.object({
  graph: z.string(),
  input: z.record(z.string(), z.any()).default({}),
})

fastify.post('/runs', async (req, reply) => {
  const body = RunSchema.parse(req.body)
  const run = await repository.createRun({ graph: body.graph, input: body.input })
  Executor.start(run.id).catch((e) => fastify.log.error(e, 'executor failed'))
  return { id: run.id, status: 'started' }
})

fastify.get('/runs/:id', async (req) => {
  const { id } = req.params as { id: string }
  return repository.getRun(id)
})

fastify.get('/runs/:id/trace', async (req) => {
  const { id } = req.params as { id: string }
  return repository.getTrace(id)
})

fastify.post('/runs/:id/replay', async (req) => {
  const { id } = req.params as { id: string }
  const { fromStep } = req.body as { fromStep?: number }
  const replay = await repository.replayRun(id, fromStep)
  Executor.start(replay.id).catch((e) => fastify.log.error(e, 'replay failed'))
  return { id: replay.id, replayedFrom: id, fromStep }
})

fastify.listen({ host: '0.0.0.0', port: PORT }).then(() => {
  fastify.log.info(`agent-orchestrator-api listening on :${PORT}`)
})
