import { BudgetExceededError } from './tokens.js'

/**
 * Tool-call budget.
 *
 * Enforces a hard cap on the total number of tool invocations across a run,
 * plus optional per-tool caps. MCP tools and built-in tools share the same
 * budget, so an agent cannot escape the limit by routing through MCP.
 */
export class ToolBudget {
  private used = 0
  private perTool = new Map<string, number>()

  constructor(
    private readonly limit: number,
    private readonly perToolLimits: Record<string, number> = {},
    used = 0,
  ) {
    this.used = used
  }

  call(name = 'unknown'): void {
    this.used++
    const toolCount = (this.perTool.get(name) ?? 0) + 1
    this.perTool.set(name, toolCount)

    if (this.used > this.limit) {
      throw new BudgetExceededError('tools', `Tool budget exceeded: ${this.used}/${this.limit}`)
    }
    const perLimit = this.perToolLimits[name]
    if (perLimit !== undefined && toolCount > perLimit) {
      throw new BudgetExceededError(
        'tools',
        `Per-tool budget exceeded for ${name}: ${toolCount}/${perLimit}`,
      )
    }
  }

  get spent() { return this.used }
  remaining() { return this.limit - this.used }
}
