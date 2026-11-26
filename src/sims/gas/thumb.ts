import type { ThumbFactory } from '@/sims/registry'
import { LJSystem } from '@/physics/lj'
import { drawParticles } from './draw'

export const createThumb: ThumbFactory = () => {
  const sys = new LJSystem({ N: 160, density: 0.3, temperature: 1.2, seed: 9 })
  return {
    step() {
      for (let k = 0; k < 3; k++) sys.step(0.004)
    },
    draw(ctx, w, h, colors) {
      ctx.fillStyle = colors.bg
      ctx.fillRect(0, 0, w, h)
      // Fill the card width; the periodic box is square, so crop it vertically.
      drawParticles(ctx, sys, 0, (h - w) / 2, w, 4.5 * Math.sqrt(1.2))
    },
  }
}
