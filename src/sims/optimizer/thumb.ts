import type { ThumbFactory } from '@/sims/registry'
import { SURFACES } from '@/physics/optim'
import { renderSurface, projector } from './field'
import { makeRunners, stepRunners, type Runner } from './race'

export const createThumb: ThumbFactory = () => {
  const s = SURFACES.himmelblau
  const start: [number, number] = [-0.2, -0.4]
  let runners: Runner[] = makeRunners(s, start)
  let field: HTMLCanvasElement | null = null
  let fieldDark: boolean | null = null
  let t = 0
  return {
    step(dt) {
      t += dt
      if (t > 7) {
        t = 0
        runners = makeRunners(s, start)
      }
      stepRunners(runners, s, 0.6, 0.9, 0, () => true)
    },
    draw(ctx, w, h, colors) {
      if (!field || fieldDark !== colors.dark) {
        field = document.createElement('canvas')
        field.width = 160
        field.height = 160
        field.getContext('2d')!.putImageData(renderSurface(s, 160, colors.dark, 16), 0, 0)
        fieldDark = colors.dark
      }
      // Square surface in a 16:10 card: fill the width, crop vertically.
      const oy = (h - w) / 2
      ctx.drawImage(field, 0, oy, w, w)
      const P = projector(s, 0, oy, w)
      runners.forEach((r, k) => {
        ctx.strokeStyle = colors.series[k]!
        ctx.lineWidth = 2
        ctx.beginPath()
        for (let i = 0; i < r.path.length; i += 2) {
          if (i) ctx.lineTo(P.X(r.path[i]!), P.Y(r.path[i + 1]!))
          else ctx.moveTo(P.X(r.path[i]!), P.Y(r.path[i + 1]!))
        }
        ctx.stroke()
      })
    },
  }
}
