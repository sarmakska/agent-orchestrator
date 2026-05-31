export class BudgetExceededError extends Error {
  constructor(public readonly kind: 'tokens' | 'tools' | 'wall-clock', message: string) {
    super(message)
    this.name = 'BudgetExceededError'
  }
}

export class TokenBudget {
  constructor(private readonly limit: number, private used = 0) {}
  consume(n: number): void {
    this.used += n
    if (this.used > this.limit) {
      throw new BudgetExceededError('tokens', `Token budget exceeded: ${this.used}/${this.limit}`)
    }
  }
  get spent() { return this.used }
  remaining() { return this.limit - this.used }
}
