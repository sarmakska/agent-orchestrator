import { randomUUID } from 'node:crypto'
import type {
  AppendTraceInput,
  CheckpointRecord,
  CreateRunInput,
  RunRecord,
  StateStore,
  TraceRecord,
} from './store.js'

/**
 * In-memory state store. Used by the test suite and by offline development when
 * DATABASE_URL is not set. Holds runs, traces, and checkpoints in process maps.
 */
export class MemoryStore implements StateStore {
  private runs = new Map<string, RunRecord>()
  private traces: TraceRecord[] = []
  private checkpoints: CheckpointRecord[] = []

  async createRun(opts: CreateRunInput): Promise<RunRecord> {
    const row: RunRecord = {
      id: randomUUID(),
      graph: opts.graph,
      status: 'pending',
      input: opts.input,
      output: null,
      error: null,
      startedAt: new Date(),
      finishedAt: null,
      budgetTokens: null,
      budgetTools: null,
      budgetWallSec: null,
      tokensUsed: 0,
      toolsUsed: 0,
      replayOf: opts.replayOf ?? null,
      replayFromStep: opts.replayFromStep ?? null,
    }
    this.runs.set(row.id, row)
    return { ...row }
  }

  async getRun(id: string): Promise<RunRecord | undefined> {
    const row = this.runs.get(id)
    return row ? { ...row } : undefined
  }

  async listRuns(limit = 100): Promise<RunRecord[]> {
    return [...this.runs.values()]
      .sort((a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0))
      .slice(0, limit)
      .map((r) => ({ ...r }))
  }

  async setStatus(id: string, status: string, fields: Partial<RunRecord> = {}): Promise<void> {
    const row = this.runs.get(id)
    if (!row) return
    Object.assign(row, { status, ...fields })
  }

  async appendTrace(opts: AppendTraceInput): Promise<void> {
    this.traces.push({
      id: randomUUID(),
      runId: opts.runId,
      step: opts.step,
      node: opts.node,
      kind: opts.kind,
      payload: opts.payload ?? null,
      startedAt: new Date(),
      durationMs: opts.durationMs ?? null,
    })
  }

  async getTrace(runId: string): Promise<TraceRecord[]> {
    return this.traces
      .filter((t) => t.runId === runId)
      .sort((a, b) => a.step - b.step || (a.startedAt?.getTime() ?? 0) - (b.startedAt?.getTime() ?? 0))
      .map((t) => ({ ...t }))
  }

  async checkpoint(runId: string, step: number, state: Record<string, unknown>): Promise<void> {
    this.checkpoints.push({ id: randomUUID(), runId, step, state, createdAt: new Date() })
  }

  async getCheckpoint(runId: string, step: number): Promise<CheckpointRecord | undefined> {
    const row = this.checkpoints.find((c) => c.runId === runId && c.step === step)
    return row ? { ...row } : undefined
  }

  async latestCheckpoint(runId: string, atOrBefore: number): Promise<CheckpointRecord | undefined> {
    const matches = this.checkpoints
      .filter((c) => c.runId === runId && c.step <= atOrBefore)
      .sort((a, b) => b.step - a.step)
    return matches[0] ? { ...matches[0] } : undefined
  }
}
