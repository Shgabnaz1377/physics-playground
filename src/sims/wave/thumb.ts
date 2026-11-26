import type { ThumbFactory } from '@/sims/registry'
import { DIVERGING_DARK, DIVERGING_LIGHT, buildLut, lutIndex } from '@/lib/colormap'
import { advance, buildScene } from '@/physics/wave'

export const createThumb: ThumbFactory = () => {
  const nx = 120
  const ny = 75
  const scene = buildScene({ nx, ny, scene: 'two-sources', separation: 22, slitWidth: 4, spongeWidth: 10 })
  const params = { courant: 0.5, wavelength: 9, amplitude: 1, sources: scene.sources }
  const off = document.createElement('canvas')
  off.width = nx
  off.height = ny
  const octx = off.getContext('2d')!
  const img = new ImageData(nx, ny)
  const px = new Uint32Array(img.data.buffer)
  const lutLight = buildLut(DIVERGING_LIGHT)
  const lutDark = buildLut(DIVERGING_DARK)
  let acc = 0

  return {
    step(dt) {
      acc += dt * 60
      while (acc >= 1) {
        advance(scene.grid, params, 2)
        acc -= 1
      }
    },
    draw(ctx, w, h, colors) {

      const lut = colors.dark ? lutDark : lutLight
      const u = scene.grid.u
      for (let i = 0; i < px.length; i++) px[i] = lut[lutIndex(u[i]!, -0.35, 0.35)]!
      octx.putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(off, 0, 0, w, h)
    },
  }
}
