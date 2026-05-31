import type { BudgetDef } from '../graph/definition.js'
import { BudgetExceededError, TokenBudget } from './tokens.js'
import { ToolBudget } from './tools.js'

/**
 * Combined per-run budget. Bundles the token, tool-call, and wall-clock limits
 * declared on a graph and enforces them through a single object the executor
 * threads into every node. An AbortSignal is exposed so in-flight LLM and tool
 * calls can be cancelled the moment a limit is breached.
 */
export class RunBudget {
  readonly tokens?: TokenBudget
  readonly tools?: ToolBudget
  private readonly wallClockMs?: number
  private readonly startedAt = Date.now()
  private readonly controller = new AbortController()

  constructor(def: BudgetDef) {
    if (def.tokens !== undefined) this.tokens = new TokenBudget(def.tokens)
    if (def.tools !== undefined) this.tools = new ToolBudget(def.tools, def.perTool ?? {})
    if (def.wallClockSec !== undefined) this.wallClockMs = def.wallClockSec * 1000
  }

  get signal(): AbortSignal {
    return this.controller.signal
  }

  consumeTokens(n: number): void {
    try {
      this.tokens?.consume(n)
    } catch (e) {
      this.abortWith(e as Error)
      throw e
    }
  }

  callTool(name: string): void {
    try {
      this.tools?.call(name)
    } catch (e) {
      this.abortWith(e as Error)
      throw e
    }
  }

  checkWallClock(): void {
    if (this.wallClockMs === undefined) return
    if (Date.now() - this.startedAt > this.wallClockMs) {
      const err = new BudgetExceededError(
        'wall-clock',
        `Wall-clock budget exceeded: ${(Date.now() - this.startedAt) / 1000}s`,
      )
      this.abortWith(err)
      throw err
    }
  }

  snapshot() {
    return {
      tokensUsed: this.tokens?.spent ?? 0,
      toolsUsed: this.tools?.spent ?? 0,
      elapsedMs: Date.now() - this.startedAt,
    }
  }

  private abortWith(e: Error): void {
    if (!this.controller.signal.aborted) this.controller.abort(e)
  }
}
