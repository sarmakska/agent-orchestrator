import { Queue, Worker, type JobsOptions } from 'bullmq'
import { Executor } from '../graph/executor.js'

/**
 * Run queue with BullMQ retry policies.
 *
 * When REDIS_URL is set, runs are enqueued to Redis and processed by a worker
 * with a configurable retry policy (attempts + exponential backoff). Failed
 * jobs are retried automatically; the run row records the final status. When
 * REDIS_URL is absent the queue degrades to in-process execution so the API,
 * the examples, and the test suite all work with no Redis.
 */
const QUEUE_NAME = 'agent-runs'

export interface RetryPolicy {
  attempts: number
  backoffMs: number
}

export const defaultRetryPolicy: RetryPolicy = {
  attempts: Number(process.env.RUN_RETRY_ATTEMPTS ?? 3),
  backoffMs: Number(process.env.RUN_RETRY_BACKOFF_MS ?? 2000),
}

export function jobOptions(policy: RetryPolicy = defaultRetryPolicy): JobsOptions {
  return {
    attempts: policy.attempts,
    backoff: { type: 'exponential', delay: policy.backoffMs },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  }
}

let queue: Queue | undefined

function connection() {
  const url = process.env.REDIS_URL
  if (!url) return undefined
  return { url }
}

export function getQueue(): Queue | undefined {
  const conn = connection()
  if (!conn) return undefined
  if (!queue) queue = new Queue(QUEUE_NAME, { connection: conn, defaultJobOptions: jobOptions() })
  return queue
}

/** Enqueue a run. Falls back to in-process execution when Redis is not configured. */
export async function enqueueRun(runId: string): Promise<void> {
  const q = getQueue()
  if (!q) {
    await Executor.start(runId)
    return
  }
  await q.add('run', { runId }, jobOptions())
}

/** Start a worker that processes enqueued runs with the retry policy applied. */
export function startWorker(): Worker | undefined {
  const conn = connection()
  if (!conn) return undefined
  return new Worker(
    QUEUE_NAME,
    async (job) => {
      await Executor.start(job.data.runId)
    },
    { connection: conn },
  )
}
