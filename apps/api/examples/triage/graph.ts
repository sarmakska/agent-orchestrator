import { z } from 'zod'
import { graph } from '../../src/graph/definition.js'
import { tool } from '../../src/tools/registry.js'

/**
 * Support triage with conditional routing.
 *
 * A supervisor classifies the request, then conditional edges route to a refund
 * pipeline or an escalation pipeline based on the run context. The executor only
 * follows an edge whose `when` predicate returns truthy.
 */
tool('stripe_refund', {
  description: 'Refund a Stripe charge by ID.',
  schema: z.object({ chargeId: z.string(), amountPence: z.number().int() }),
  handler: async ({ chargeId, amountPence }) => ({ refundId: `re_${chargeId}`, amountPence }),
})

export const triage = graph('triage')
  .node('classify', { agent: 'supervisor', llm: 'sarmalink' })
  .node('refund', { agent: 'pipeline', tools: ['stripe_refund'] })
  .node('escalate', { agent: 'pipeline' })
  .edge('classify', 'refund', (ctx) => (ctx.input as Record<string, unknown>)?.intent === 'refund')
  .edge('classify', 'escalate', (ctx) => (ctx.input as Record<string, unknown>)?.intent !== 'refund')
  .budget({ tokens: 8000, tools: 10, wallClockSec: 60, perTool: { stripe_refund: 1 } })
