import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { and, desc, eq, lte } from 'drizzle-orm'
import { runs, traces, checkpoints } from './schema.js'
import type {
  AppendTraceInput,
  CheckpointRecord,
  CreateRunInput,
  RunRecord,
  StateStore,
  TraceRecord,
} from './store.js'

function toRun(row: typeof runs.$inferSelect): RunRecord {
  return {
    id: row.id,
    graph: row.graph,
    status: row.status,
    input: (row.input as Record<string, unknown>) ?? {},
    output: (row.output as Record<string, unknown> | null) ?? null,
    error: row.error,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    budgetTokens: row.budgetTokens,
    budgetTools: row.budgetTools,
    budgetWallSec: row.budgetWallSec,
    tokensUsed: row.tokensUsed,
    toolsUsed: row.toolsUsed,
    replayOf: row.replayOf,
    replayFromStep: row.replayFromStep,
  }
}

/** Durable state store backed by Postgres through Drizzle ORM. */
export class PostgresStore implements StateStore {
  readonly db: PostgresJsDatabase<{ typeof: typeof runs }>

  constructor(databaseUrl: string) {
    const sql = postgres(databaseUrl)
    this.db = drizzle(sql, { schema: { runs, traces, checkpoints } }) as any
  }

  async createRun(opts: CreateRunInput): Promise<RunRecord> {
    const [row] = await this.db
      .insert(runs)
      .values({
        graph: opts.graph,
        input: opts.input,
        replayOf: opts.replayOf ?? null,
        replayFromStep: opts.replayFromStep ?? null,
      })
      .returning()
    return toRun(row)
  }

  async getRun(id: string): Promise<RunRecord | undefined> {
    const [row] = await this.db.select().from(runs).where(eq(runs.id, id))
    return row ? toRun(row) : undefined
  }

  async listRuns(limit = 100): Promise<RunRecord[]> {
    const rows = await this.db.select().from(runs).orderBy(desc(runs.startedAt)).limit(limit)
    return rows.map(toRun)
  }

  async setStatus(id: string, status: string, fields: Partial<RunRecord> = {}): Promise<void> {
    await this.db.update(runs).set({ status, ...fields } as any).where(eq(runs.id, id))
  }

  async appendTrace(opts: AppendTraceInput): Promise<void> {
    await this.db.insert(traces).values({
      runId: opts.runId,
      step: opts.step,
      node: opts.node,
      kind: opts.kind,
      payload: opts.payload ?? null,
      durationMs: opts.durationMs ?? null,
    })
  }

  async getTrace(runId: string): Promise<TraceRecord[]> {
    const rows = await this.db.select().from(traces).where(eq(traces.runId, runId)).orderBy(traces.step)
    return rows.map((r) => ({
      id: r.id,
      runId: r.runId,
      step: r.step,
      node: r.node,
      kind: r.kind,
      payload: r.payload,
      startedAt: r.startedAt,
      durationMs: r.durationMs,
    }))
  }

  async checkpoint(runId: string, step: number, state: Record<string, unknown>): Promise<void> {
    await this.db.insert(checkpoints).values({ runId, step, state })
  }

  async getCheckpoint(runId: string, step: number): Promise<CheckpointRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(checkpoints)
      .where(and(eq(checkpoints.runId, runId), eq(checkpoints.step, step)))
    return row
      ? { id: row.id, runId: row.runId, step: row.step, state: row.state as Record<string, unknown>, createdAt: row.createdAt }
      : undefined
  }

  async latestCheckpoint(runId: string, atOrBefore: number): Promise<CheckpointRecord | undefined> {
    const [row] = await this.db
      .select()
      .from(checkpoints)
      .where(and(eq(checkpoints.runId, runId), lte(checkpoints.step, atOrBefore)))
      .orderBy(desc(checkpoints.step))
      .limit(1)
    return row
      ? { id: row.id, runId: row.runId, step: row.step, state: row.state as Record<string, unknown>, createdAt: row.createdAt }
      : undefined
  }
}
