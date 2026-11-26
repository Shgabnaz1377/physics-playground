/**
 * Fixed-capacity rolling window of samples, used for live time-series plots.
 * Pushing beyond capacity drops the oldest sample in O(1).
 */
export class RollingSeries {
  private readonly buf: Float64Array
  private start = 0
  private count = 0

  constructor(readonly capacity: number) {
    if (!(capacity >= 1)) throw new RangeError('capacity must be >= 1')
    this.buf = new Float64Array(capacity)
  }

  get length(): number {
    return this.count
  }

  push(x: number): void {
    if (this.count < this.capacity) {
      this.buf[(this.start + this.count) % this.capacity] = x
      this.count++
    } else {
      this.buf[this.start] = x
      this.start = (this.start + 1) % this.capacity
    }
  }

  /** i-th sample, oldest first. */
  at(i: number): number {
    return this.buf[(this.start + i) % this.capacity]!
  }

  last(): number | undefined {
    return this.count ? this.at(this.count - 1) : undefined
  }

  clear(): void {
    this.start = 0
    this.count = 0
  }

  toArray(): number[] {
    const out = new Array<number>(this.count)
    for (let i = 0; i < this.count; i++) out[i] = this.at(i)
    return out
  }

  /** Mean of the most recent n samples (or all, if fewer). */
  meanOfLast(n: number): number {
    const k = Math.min(n, this.count)
    if (!k) return Number.NaN
    let s = 0
    for (let i = this.count - k; i < this.count; i++) s += this.at(i)
    return s / k
  }
}
