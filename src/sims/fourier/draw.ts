import { epicycleChain, type Coefficient, type Point } from '@/physics/fourier'
import type { CanvasColors } from '@/composables/useTheme'

export interface View {
  cx: number
  cy: number
  scale: number
}

/** Draw the epicycle chain at time t and the traced curve for the current period. */
export function drawEpicycles(
  ctx: CanvasRenderingContext2D,
  coeffs: readonly Coefficient[],
  terms: number,
  t: number,
  trace: readonly Point[],
  view: View,
  colors: CanvasColors,
  showCircles: boolean,
): void {
  const X = (x: number) => view.cx + x * view.scale
  const Y = (y: number) => view.cy - y * view.scale
  const chain = epicycleChain(coeffs, t, terms)

  if (showCircles) {
    ctx.lineWidth = 1
    ctx.strokeStyle = colors.muted
    for (let j = 1; j < chain.length; j++) {
      const r = coeffs[j - 1]!.amp * view.scale
      if (r < 0.6) continue
      ctx.globalAlpha = Math.max(0.12, 0.45 - j * 0.004)
      ctx.beginPath()
      ctx.arc(X(chain[j - 1]![0]), Y(chain[j - 1]![1]), r, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 0.9
    ctx.strokeStyle = colors.fg
    ctx.beginPath()
    ctx.moveTo(X(chain[0]![0]), Y(chain[0]![1]))
    for (let j = 1; j < chain.length; j++) ctx.lineTo(X(chain[j]![0]), Y(chain[j]![1]))
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  if (trace.length > 1) {
    ctx.strokeStyle = colors.series[1]
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(X(trace[0]![0]), Y(trace[0]![1]))
    for (let i = 1; i < trace.length; i++) ctx.lineTo(X(trace[i]![0]), Y(trace[i]![1]))
    ctx.stroke()
  }

  const tip = chain[chain.length - 1]!
  ctx.fillStyle = colors.series[1]
  ctx.beginPath()
  ctx.arc(X(tip[0]), Y(tip[1]), 4, 0, Math.PI * 2)
  ctx.fill()
}
