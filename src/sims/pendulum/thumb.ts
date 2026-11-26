import type { ThumbFactory } from '@/sims/registry'
import { DoublePendulum, bobPositions } from '@/physics/pendulum'
import { Trail, drawPendulum } from './draw'

export const createThumb: ThumbFactory = () => {
  const params = { m1: 1, m2: 1, l1: 1, l2: 1, g: 9.81 }
  const dp = new DoublePendulum(params, 2.2, 1.4)
  const trail = new Trail(260)
  return {
    step(dt) {
      const n = Math.round(dt / 0.002)
      for (let i = 0; i < n; i++) dp.step(0.002)
      const [, , x, y] = bobPositions(params, dp.y)
      trail.push(x, y)
    },
    draw(ctx, w, h, colors) {
      const scale = (Math.min(w, h) * 0.45) / 2
      const ox = w / 2
      const oy = h / 2
      ctx.fillStyle = colors.bg
      ctx.fillRect(0, 0, w, h)
      trail.draw(ctx, colors.series[0], (x) => ox + x * scale, (y) => oy + y * scale)
      drawPendulum(ctx, params, dp.y, ox, oy, scale, colors.fg, colors.series[0])
    },
  }
}
