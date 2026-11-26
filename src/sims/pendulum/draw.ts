import { bobPositions, type PendulumParams } from '@/physics/pendulum'

/** Fixed-size ring buffer of 2D points for drawing fading trails. */
export class Trail {
  private readonly xs: Float64Array
  private readonly ys: Float64Array
  private head = 0
  private count = 0

  constructor(readonly capacity: number) {
    this.xs = new Float64Array(capacity)
    this.ys = new Float64Array(capacity)
  }

  push(x: number, y: number): void {
    this.xs[this.head] = x
    this.ys[this.head] = y
    this.head = (this.head + 1) % this.capacity
    if (this.count < this.capacity) this.count++
  }

  clear(): void {
    this.count = 0
    this.head = 0
  }

  /** Draw oldest-to-newest in a few alpha bands, mapping model to screen coordinates. */
  draw(ctx: CanvasRenderingContext2D, color: string, toX: (x: number) => number, toY: (y: number) => number): void {
    const n = this.count
    if (n < 2) return
    const start = (this.head - n + this.capacity) % this.capacity
    const bands = 8
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.lineJoin = 'round'
    for (let b = 0; b < bands; b++) {
      const i0 = Math.floor((b * (n - 1)) / bands)
      const i1 = Math.floor(((b + 1) * (n - 1)) / bands)
      ctx.globalAlpha = ((b + 1) / bands) * 0.85
      ctx.beginPath()
      for (let i = i0; i <= i1; i++) {
        const k = (start + i) % this.capacity
        const x = toX(this.xs[k]!)
        const y = toY(this.ys[k]!)
        if (i === i0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
}

export function drawPendulum(
  ctx: CanvasRenderingContext2D,
  p: PendulumParams,
  state: ArrayLike<number>,
  ox: number,
  oy: number,
  scale: number,
  rodColor: string,
  bobColor: string,
  alpha = 1,
): void {
  const [x1, y1, x2, y2] = bobPositions(p, state)
  const r1 = 5 + 4 * Math.cbrt(p.m1)
  const r2 = 5 + 4 * Math.cbrt(p.m2)
  ctx.globalAlpha = alpha
  ctx.strokeStyle = rodColor
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(ox, oy)
  ctx.lineTo(ox + x1 * scale, oy + y1 * scale)
  ctx.lineTo(ox + x2 * scale, oy + y2 * scale)
  ctx.stroke()
  ctx.fillStyle = bobColor
  ctx.beginPath()
  ctx.arc(ox + x1 * scale, oy + y1 * scale, r1, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(ox + x2 * scale, oy + y2 * scale, r2, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
}
