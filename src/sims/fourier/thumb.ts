import type { ThumbFactory } from '@/sims/registry'
import { byAmplitude, dft, evaluate, resampleClosed, shape, type Point } from '@/physics/fourier'
import { drawEpicycles } from './draw'

export const createThumb: ThumbFactory = () => {
  const coeffs = byAmplitude(dft(resampleClosed(shape('heart'), 128)))
  const terms = 14
  const curve: Point[] = Array.from({ length: 301 }, (_, i) => evaluate(coeffs, i / 300, terms))
  let t = 0
  return {
    step(dt) {
      t = (t + dt * 0.12) % 1
    },
    draw(ctx, w, h, colors) {
      ctx.fillStyle = colors.bg
      ctx.fillRect(0, 0, w, h)
      const view = { cx: w / 2, cy: h / 2, scale: Math.min(w, h) * 0.42 }
      drawEpicycles(ctx, coeffs, terms, t, curve.slice(0, Math.floor(t * 300) + 1), view, colors, true)
    },
  }
}
