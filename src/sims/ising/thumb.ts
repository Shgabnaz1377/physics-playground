import type { ThumbFactory } from '@/sims/registry'
import { hexToRgb, packRgba } from '@/lib/colormap'
import { IsingLattice } from '@/physics/ising'

export const createThumb: ThumbFactory = () => {
  const L = 80
  const lat = new IsingLattice(L, 3)
  lat.setParams(2.3, 0)
  for (let i = 0; i < 40; i++) lat.sweep()
  const off = document.createElement('canvas')
  off.width = L
  off.height = L
  const octx = off.getContext('2d')!
  const img = new ImageData(L, L)
  const px = new Uint32Array(img.data.buffer)
  let acc = 0
  return {
    step(dt) {
      acc += dt * 30
      while (acc >= 1) {
        lat.sweep()
        acc -= 1
      }
    },
    draw(ctx, w, h, colors) {
      const [r, g, b] = hexToRgb(colors.series[0])
      const up = packRgba(r, g, b)
      const down = colors.dark ? packRgba(19, 24, 36) : packRgba(226, 230, 237)
      for (let i = 0; i < px.length; i++) px[i] = lat.spins[i]! > 0 ? up : down
      octx.putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = false
      // Square lattice in a 16:10 card: fill the width and crop vertically.
      ctx.drawImage(off, 0, (h - w) / 2, w, w)
    },
  }
}
