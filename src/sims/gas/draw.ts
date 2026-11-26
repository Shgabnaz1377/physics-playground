import { VIRIDIS, buildLut, unpackRgba } from '@/lib/colormap'
import type { LJSystem } from '@/physics/lj'

const PALETTE = Array.from(buildLut(VIRIDIS, 64), (w) => {
  const [r, g, b] = unpackRgba(w)
  return `rgb(${r} ${g} ${b})`
})

/** Draw particles as discs of diameter sigma, coloured by speed relative to vmax. */
export function drawParticles(
  ctx: CanvasRenderingContext2D,
  sys: LJSystem,
  ox: number,
  oy: number,
  size: number,
  vmax: number,
): void {
  const s = size / sys.L
  const r = Math.max(1, 0.5 * s)
  // Bucket by colour so each colour is one fill() call.
  const buckets: number[][] = PALETTE.map(() => [])
  for (let i = 0; i < sys.N; i++) {
    const v = Math.hypot(sys.vx[i]!, sys.vy[i]!)
    const k = Math.min(PALETTE.length - 1, Math.floor((v / vmax) * PALETTE.length))
    buckets[k]!.push(i)
  }
  for (let k = 0; k < PALETTE.length; k++) {
    const list = buckets[k]!
    if (!list.length) continue
    ctx.fillStyle = PALETTE[k]!
    ctx.beginPath()
    for (const i of list) {
      const px = ox + sys.x[i]! * s
      const py = oy + sys.y[i]! * s
      ctx.moveTo(px + r, py)
      ctx.arc(px, py, r, 0, Math.PI * 2)
    }
    ctx.fill()
  }
}
