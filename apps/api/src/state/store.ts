/**
 * State store contract.
 *
 * Two implementations satisfy it: a Postgres-backed store (the durable default)
 * and an in-memory store used for tests and offline development. Both expose
 * identical semantics so the executor never knows which one it is talking to.
 */

export interface RunRecord {
  id: string
  graph: string
  status: string
  input: Record<string, unknown>
  output: Record<string, unknown> | null
  error: string | null
  startedAt: Date | null
  finishedAt: Date | null
  budgetTokens: number | null
  budgetTools: number | null
  budgetWallSec: number | null
  tokensUsed: number
  toolsUsed: number
  replayOf: string | null
  replayFromStep: number | null
}

export interface TraceRecord {
  id: string
  runId: string
  step: number
  node: string
  kind: string
  payload: unknown
  startedAt: Date | null
  durationMs: number | null
}

export interface CheckpointRecord {
  id: string
  runId: string
  step: number
  state: Record<string, unknown>
  createdAt: Date | null
}

export interface CreateRunInput {
  graph: string
  input: Record<string, unknown>
  replayOf?: string | null
  replayFromStep?: number | null
}

export interface AppendTraceInput {
  runId: string
  step: number
  node: string
  kind: string
  payload?: unknown
  durationMs?: number
}

export interface StateStore {
  createRun(opts: CreateRunInput): Promise<RunRecord>
  getRun(id: string): Promise<RunRecord | undefined>
  listRuns(limit?: number): Promise<RunRecord[]>
  setStatus(id: string, status: string, fields?: Partial<RunRecord>): Promise<void>
  appendTrace(opts: AppendTraceInput): Promise<void>
  getTrace(runId: string): Promise<TraceRecord[]>
  checkpoint(runId: string, step: number, state: Record<string, unknown>): Promise<void>
  getCheckpoint(runId: string, step: number): Promise<CheckpointRecord | undefined>
  latestCheckpoint(runId: string, atOrBefore: number): Promise<CheckpointRecord | undefined>
}
