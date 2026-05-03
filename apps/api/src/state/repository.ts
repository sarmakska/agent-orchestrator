import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import { runs, traces, checkpoints } from './schema.js'

const sql = postgres(process.env.DATABASE_URL || 'postgresql://orchestrator:devpassword@localhost:5432/orchestrator')
export const db = drizzle(sql, { schema: { runs, traces, checkpoints } })

export const repository = {
  async createRun(opts: { graph: string; input: Record<string, unknown> }) {
    const [row] = await db.insert(runs).values({ graph: opts.graph, input: opts.input }).returning()
    return row
  },

  async getRun(id: string) {
    const [row] = await db.select().from(runs).where(eq(runs.id, id))
    return row
  },

  async setStatus(id: string, status: string, fields: Partial<typeof runs.$inferInsert> = {}) {
    return db.update(runs).set({ status, ...fields }).where(eq(runs.id, id))
  },

  async appendTrace(opts: { runId: string; step: number; node: string; kind: string; payload?: unknown; durationMs?: number }) {
    return db.insert(traces).values(opts as any).returning()
  },

  async getTrace(runId: string) {
    return db.select().from(traces).where(eq(traces.runId, runId))
  },

  async checkpoint(runId: string, step: number, state: Record<string, unknown>) {
    return db.insert(checkpoints).values({ runId, step, state })
  },

  async replayRun(originalId: string, fromStep?: number) {
    const original = await this.getRun(originalId)
    if (!original) throw new Error('Run not found')
    const [replay] = await db
      .insert(runs)
      .values({
        graph: original.graph,
        input: { ...original.input as Record<string, unknown>, _replayOf: originalId, _fromStep: fromStep ?? 0 },
      })
      .returning()
    return replay
  },
}
