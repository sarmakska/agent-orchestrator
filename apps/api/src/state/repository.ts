import { MemoryStore } from './memoryStore.js'
import { PostgresStore } from './postgresStore.js'
import type { StateStore } from './store.js'

/**
 * Select the state store from the environment. When DATABASE_URL is set we use
 * the durable Postgres store; otherwise we fall back to the in-memory store so
 * the executor, the API, and the test suite all run with no external services.
 */
function createStore(): StateStore {
  const url = process.env.DATABASE_URL
  if (url) return new PostgresStore(url)
  return new MemoryStore()
}

let store: StateStore = createStore()

/** Override the store. Used by tests to inject a fresh in-memory store. */
export function setStore(next: StateStore): void {
  store = next
}

export const repository = {
  store: () => store,

  createRun: (opts: Parameters<StateStore['createRun']>[0]) => store.createRun(opts),
  getRun: (id: string) => store.getRun(id),
  listRuns: (limit?: number) => store.listRuns(limit),
  setStatus: (id: string, status: string, fields?: Parameters<StateStore['setStatus']>[2]) =>
    store.setStatus(id, status, fields),
  appendTrace: (opts: Parameters<StateStore['appendTrace']>[0]) => store.appendTrace(opts),
  getTrace: (runId: string) => store.getTrace(runId),
  checkpoint: (runId: string, step: number, state: Record<string, unknown>) =>
    store.checkpoint(runId, step, state),
  getCheckpoint: (runId: string, step: number) => store.getCheckpoint(runId, step),
  latestCheckpoint: (runId: string, atOrBefore: number) => store.latestCheckpoint(runId, atOrBefore),

  /**
   * Create a replay run. The new run carries the original graph and input plus
   * a pointer back to the original run and the step to resume from. The
   * executor reads the checkpoint at that step and continues the walk.
   */
  async replayRun(originalId: string, fromStep?: number) {
    const original = await store.getRun(originalId)
    if (!original) throw new Error('Run not found')
    return store.createRun({
      graph: original.graph,
      input: original.input,
      replayOf: originalId,
      replayFromStep: fromStep ?? 0,
    })
  },
}
