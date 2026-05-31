import { pgTable, uuid, text, jsonb, integer, timestamp } from 'drizzle-orm/pg-core'

export const runs = pgTable('runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  graph: text('graph').notNull(),
  status: text('status').notNull().default('pending'),
  input: jsonb('input').notNull(),
  output: jsonb('output'),
  error: text('error'),
  startedAt: timestamp('started_at').defaultNow(),
  finishedAt: timestamp('finished_at'),
  budgetTokens: integer('budget_tokens'),
  budgetTools: integer('budget_tools'),
  budgetWallSec: integer('budget_wall_sec'),
  tokensUsed: integer('tokens_used').notNull().default(0),
  toolsUsed: integer('tools_used').notNull().default(0),
  replayOf: uuid('replay_of'),
  replayFromStep: integer('replay_from_step'),
})

export const traces = pgTable('traces', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  step: integer('step').notNull(),
  node: text('node').notNull(),
  kind: text('kind').notNull(),         // 'enter' | 'tool_call' | 'llm_call' | 'exit' | 'error'
  payload: jsonb('payload'),
  startedAt: timestamp('started_at').defaultNow(),
  durationMs: integer('duration_ms'),
})

export const checkpoints = pgTable('checkpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => runs.id, { onDelete: 'cascade' }),
  step: integer('step').notNull(),
  state: jsonb('state').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})
