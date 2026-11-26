import { VIRIDIS, buildLut, packRgba, unpackRgba } from '@/lib/colormap'
import type { Surface } from '@/physics/optim'

const LUT = buildLut(VIRIDIS)

/**
 * Render log(f - fmin) over the surface's domain as a colour field with
 * contour lines where the quantised level changes between neighbouring pixels.
 */
export function renderSurface(s: Surface, size: number, dark: boolean, levels = 22): ImageData {
  const [x0, x1, y0, y1] = s.domain
  const vals = new Float64Array(size * size)
  let lo = Infinity
  let hi = -Infinity
  for (let j = 0; j < size; j++) {
    const y = y1 - ((j + 0.5) / size) * (y1 - y0)
    for (let i = 0; i < size; i++) {
      const x = x0 + ((i + 0.5) / size) * (x1 - x0)
      const v = Math.log10(Math.max(s.f(x, y) - s.fmin, 0) + 1e-3)
      vals[j * size + i] = v
      if (v < lo) lo = v
      if (v > hi) hi = v
    }
  }
  const img = new ImageData(size, size)
  const px = new Uint32Array(img.data.buffer)
  const span = hi - lo || 1
  const level = (k: number) => Math.floor(((vals[k]! - lo) / span) * levels)
  const fade = dark ? 0.62 : 0.8
  const mixTo = dark ? 13 : 255
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const k = j * size + i
      const t = (vals[k]! - lo) / span
      const [r, g, b] = unpackRgba(LUT[Math.min(255, Math.max(0, Math.round(t * 255)))]!)
      // Soften the colormap towards the background so trajectories stand out.
      let rr = r * fade + mixTo * (1 - fade)
      let gg = g * fade + mixTo * (1 - fade)
      let bb = b * fade + mixTo * (1 - fade)
      const edge =
        (i + 1 < size && level(k) !== level(k + 1)) || (j + 1 < size && level(k) !== level(k + size))
      if (edge) {
        const e = dark ? 1.35 : 0.72
        rr *= e
        gg *= e
        bb *= e
      }
      px[k] = packRgba(Math.min(255, rr) | 0, Math.min(255, gg) | 0, Math.min(255, bb) | 0)
    }
  }
  return img
}

/** Map between model coordinates and a square canvas of the given size (y axis up). */
export function projector(s: Surface, ox: number, oy: number, size: number) {
  const [x0, x1, y0, y1] = s.domain
  return {
    X: (x: number) => ox + ((x - x0) / (x1 - x0)) * size,
    Y: (y: number) => oy + (1 - (y - y0) / (y1 - y0)) * size,
    invX: (px: number) => x0 + ((px - ox) / size) * (x1 - x0),
    invY: (py: number) => y1 - ((py - oy) / size) * (y1 - y0),
  }
}
