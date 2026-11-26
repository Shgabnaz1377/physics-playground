import type { ThumbFactory } from '@/sims/registry'
import { INFERNO, buildLut, lutIndex, packRgba } from '@/lib/colormap'
import { Cell, buildPreset, paintDisc, stepHeat } from '@/physics/heat'

export const createThumb: ThumbFactory = () => {
  const nx = 96
  const ny = 60
  const g = buildPreset(nx, ny, 'maze')
  const off = document.createElement('canvas')
  off.width = nx
  off.height = ny
  const octx = off.getContext('2d')!
  const img = new ImageData(nx, ny)
  const px = new Uint32Array(img.data.buffer)
  const lut = buildLut(INFERNO)
  let t = 0
  return {
    step(dt) {
      t += dt
      for (let k = 0; k < 12; k++) stepHeat(g, 0.25)
      // Restart periodically so the card keeps showing heat flowing through the maze.
      if (t > 14) {
        t = 0
        paintDisc(g, nx / 2, ny / 2, nx, (i) => {
          if (g.kind[i] === Cell.Conductor) g.u[i] = 0
        })
      }
    },
    draw(ctx, w, h, colors) {
      const wall = colors.dark ? packRgba(120, 130, 150) : packRgba(90, 98, 115)
      for (let i = 0; i < px.length; i++) px[i] = g.kind[i] === Cell.Wall ? wall : lut[lutIndex(g.u[i]!, 0, 1)]!
      octx.putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(off, 0, 0, w, h)
    },
  }
}
