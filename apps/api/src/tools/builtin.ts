import { z } from 'zod'
import { tool } from './registry.js'

/**
 * Built-in tools registered at start-up. These are deliberately small and
 * side-effect-free so the offline path stays deterministic. Real deployments
 * register their own tools alongside these.
 */

export const webSearch = tool('web_search', {
  description: 'Search the web for a query and return result titles.',
  schema: z.object({ query: z.string(), limit: z.number().int().min(1).max(20).default(5) }),
  handler: async ({ query, limit }) => ({
    query,
    results: Array.from({ length: limit }, (_, i) => ({ rank: i + 1, title: `Result ${i + 1} for ${query}` })),
  }),
})

export const sql = tool('sql', {
  description: 'Echo a read-only SQL statement (placeholder for a real warehouse adapter).',
  schema: z.object({ statement: z.string() }),
  handler: async ({ statement }) => ({ statement, rows: [] }),
})
