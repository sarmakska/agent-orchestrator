export class ToolBudget {
  constructor(private readonly limit: number, private used = 0) {}
  call() {
    this.used++
    if (this.used > this.limit) throw new Error(`Tool budget exceeded: ${this.used}/${this.limit}`)
  }
}
