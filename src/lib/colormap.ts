/**
 * Colour lookup tables packed as 32-bit RGBA words in little-endian byte order,
 * so a Uint32Array view over ImageData can be filled with one store per pixel.
 */

export type Stops = readonly string[]

export const VIRIDIS: Stops = [
  '#440154', '#482475', '#414487', '#355f8d', '#2a788e', '#21918c',
  '#22a884', '#44bf70', '#7ad151', '#bddf26', '#fde725',
]

export const INFERNO: Stops = [
  '#000004', '#160b39', '#420a68', '#6a176e', '#932667', '#bc3754',
  '#dd513a', '#f37819', '#fca50a', '#f6d746', '#fcffa4',
]

/** Diverging map with a light neutral centre (for light backgrounds). */
export const DIVERGING_LIGHT: Stops = [
  '#1d4e89', '#2f7fc1', '#8cc0e3', '#f4f4f2', '#f2a27d', '#d4553a', '#8c1d18',
]

/** Diverging map with a dark neutral centre (for dark backgrounds). */
export const DIVERGING_DARK: Stops = [
  '#bfe3ff', '#4ba3f0', '#1a4d80', '#0d1017', '#80401a', '#f08a3c', '#ffe1b8',
]

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function packRgba(r: number, g: number, b: number, a = 255): number {
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0
}

export function unpackRgba(word: number): [number, number, number, number] {
  return [word & 255, (word >>> 8) & 255, (word >>> 16) & 255, word >>> 24]
}

/** Linearly interpolate the stops into a table of `size` packed colours. */
export function buildLut(stops: Stops, size = 256): Uint32Array {
  const rgb = stops.map(hexToRgb)
  const lut = new Uint32Array(size)
  const segments = rgb.length - 1
  for (let i = 0; i < size; i++) {
    const t = (i / (size - 1)) * segments
    const k = Math.min(Math.floor(t), segments - 1)
    const f = t - k
    const a = rgb[k]!
    const b = rgb[k + 1]!
    lut[i] = packRgba(
      Math.round(a[0] + (b[0] - a[0]) * f),
      Math.round(a[1] + (b[1] - a[1]) * f),
      Math.round(a[2] + (b[2] - a[2]) * f),
    )
  }
  return lut
}

/** Map x in [lo, hi] to a LUT index, clamping outside the range. */
export function lutIndex(x: number, lo: number, hi: number, size = 256): number {
  const t = (x - lo) / (hi - lo)
  if (!(t > 0)) return 0
  if (t >= 1) return size - 1
  return (t * (size - 1)) | 0
}
