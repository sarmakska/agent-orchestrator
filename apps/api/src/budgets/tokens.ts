export class TokenBudget {
  constructor(private readonly limit: number, private used = 0) {}
  consume(n: number): void {
    this.used += n
    if (this.used > this.limit) throw new Error(`Token budget exceeded: ${this.used}/${this.limit}`)
  }
  remaining() { return this.limit - this.used }
}
