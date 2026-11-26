/**
 * Complex Fourier series of a closed planar curve z(t) = x(t) + i y(t), t in [0, 1).
 * The curve is sampled at N points equally spaced in arc length; the discrete
 * Fourier transform gives coefficients c_k with
 *   z(t) = sum_k c_k exp(2 pi i k t),
 * and each term is a rotating vector ("epicycle") of radius |c_k| and frequency k.
 */

export type Point = [number, number]

export interface Coefficient {
  /** Integer frequency k (negative = clockwise). */
  k: number
  re: number
  im: number
  amp: number
  phase: number
}

/** Resample a closed polyline to n points equally spaced along its length. */
export function resampleClosed(points: readonly Point[], n: number): Point[] {
  if (points.length < 2) throw new RangeError('need at least two points')
  const m = points.length
  const cum = new Float64Array(m + 1)
  for (let i = 0; i < m; i++) {
    const [ax, ay] = points[i]!
    const [bx, by] = points[(i + 1) % m]!
    cum[i + 1] = cum[i]! + Math.hypot(bx - ax, by - ay)
  }
  const total = cum[m]!
  if (total === 0) throw new RangeError('curve has zero length')
  const out: Point[] = []
  let seg = 0
  for (let j = 0; j < n; j++) {
    const s = (j / n) * total
    while (cum[seg + 1]! < s) seg++
    const len = cum[seg + 1]! - cum[seg]!
    const f = len > 0 ? (s - cum[seg]!) / len : 0
    const [ax, ay] = points[seg]!
    const [bx, by] = points[(seg + 1) % m]!
    out.push([ax + (bx - ax) * f, ay + (by - ay) * f])
  }
  return out
}

/**
 * DFT of the samples, c_k = (1/N) sum_n z_n exp(-2 pi i k n / N), for the N
 * frequencies k in [-floor(N/2), ceil(N/2) - 1]. O(N^2), which is instant for
 * the few hundred samples used here and keeps the code transparent.
 */
export function dft(samples: readonly Point[]): Coefficient[] {
  const N = samples.length
  const out: Coefficient[] = []
  const kMin = -Math.floor(N / 2)
  for (let k = kMin; k < kMin + N; k++) {
    let re = 0
    let im = 0
    for (let n = 0; n < N; n++) {
      const [x, y] = samples[n]!
      const a = (-2 * Math.PI * k * n) / N
      const c = Math.cos(a)
      const s = Math.sin(a)
      re += x * c - y * s
      im += x * s + y * c
    }
    re /= N
    im /= N
    out.push({ k, re, im, amp: Math.hypot(re, im), phase: Math.atan2(im, re) })
  }
  return out
}

/** Coefficients ordered by decreasing amplitude (the order epicycles are drawn in). */
export function byAmplitude(coeffs: readonly Coefficient[]): Coefficient[] {
  return [...coeffs].sort((a, b) => b.amp - a.amp || Math.abs(a.k) - Math.abs(b.k))
}

/** Sum of the first `terms` coefficients at time t in [0, 1). */
export function evaluate(coeffs: readonly Coefficient[], t: number, terms = coeffs.length): Point {
  let x = 0
  let y = 0
  for (let j = 0; j < Math.min(terms, coeffs.length); j++) {
    const c = coeffs[j]!
    const a = 2 * Math.PI * c.k * t
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    x += c.re * cos - c.im * sin
    y += c.re * sin + c.im * cos
  }
  return [x, y]
}

/** Centres of the epicycle chain at time t: [origin, after term 1, ..., tip]. */
export function epicycleChain(coeffs: readonly Coefficient[], t: number, terms: number): Point[] {
  const chain: Point[] = [[0, 0]]
  let x = 0
  let y = 0
  for (let j = 0; j < Math.min(terms, coeffs.length); j++) {
    const c = coeffs[j]!
    const a = 2 * Math.PI * c.k * t
    x += c.re * Math.cos(a) - c.im * Math.sin(a)
    y += c.re * Math.sin(a) + c.im * Math.cos(a)
    chain.push([x, y])
  }
  return chain
}

/**
 * Relative RMS error of the truncated series over the samples. By Parseval's
 * theorem this equals sqrt(sum of omitted |c_k|^2 / sum of all |c_k|^2).
 */
export function truncationError(sorted: readonly Coefficient[], terms: number): number {
  let all = 0
  let kept = 0
  for (let j = 0; j < sorted.length; j++) {
    const p = sorted[j]!.amp ** 2
    all += p
    if (j < terms) kept += p
  }
  return all > 0 ? Math.sqrt(Math.max(0, all - kept) / all) : 0
}

export type ShapeId = 'heart' | 'star' | 'square' | 'trefoil'

/** Preset closed curves, roughly within [-1, 1]^2 with y pointing up. */
export function shape(id: ShapeId, n = 400): Point[] {
  if (id === 'star') {
    // Five-pointed star as a 10-vertex polygon (resampled later).
    return Array.from({ length: 10 }, (_, i): Point => {
      const r = i % 2 === 0 ? 1 : 0.42
      const a = Math.PI / 2 + (Math.PI * i) / 5
      return [r * Math.cos(a), r * Math.sin(a)]
    })
  }
  if (id === 'square') {
    return [
      [-0.8, -0.8],
      [0.8, -0.8],
      [0.8, 0.8],
      [-0.8, 0.8],
    ]
  }
  return Array.from({ length: n }, (_, i): Point => {
    const t = (2 * Math.PI * i) / n
    if (id === 'heart') {
      const x = 16 * Math.sin(t) ** 3
      const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
      return [x / 17, y / 17 + 0.1]
    }
    const r = 0.55 + 0.4 * Math.cos(3 * t)
    return [r * Math.cos(t), r * Math.sin(t)]
  })
}
