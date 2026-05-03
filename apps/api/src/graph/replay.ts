import { repository } from '../state/repository.js'

/**
 * Deterministic replay.
 *
 * Given an existing run, create a new run with the same graph and input.
 * Optionally start from a specific step (skipping earlier nodes whose state
 * was checkpointed). The Executor walks the graph again; trace events show
 * the new run produced an identical sequence (or where it diverged).
 */
export async function replay(runId: string, fromStep?: number) {
  const replay = await repository.replayRun(runId, fromStep)
  return replay
}
