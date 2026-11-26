import { describe, expect, it } from 'vitest'
import {
  byAmplitude,
  dft,
  epicycleChain,
  evaluate,
  resampleClosed,
  shape,
  truncationError,
  type Point,
} from '@/physics/fourier'

function circle(n: number, k: number, r = 1, phase = 0): Point[] {
  return Array.from({ length: n }, (_, j) => {
    const a = (2 * Math.PI * k * j) / n + phase
    return [r * Math.cos(a), r * Math.sin(a)] as Point
  })
}

describe('Fourier series of closed curves', () => {
  it('maps a pure rotation to a single coefficient', () => {
    const c = dft(circle(64, 3, 2, 0.4))
    for (const x of c) {
      if (x.k === 3) {
        expect(x.amp).toBeCloseTo(2, 12)
        expect(x.phase).toBeCloseTo(0.4, 12)
      } else {
        expect(x.amp).toBeLessThan(1e-12)
      }
    }
  })

  it('uses negative frequencies for clockwise motion', () => {
    const c = dft(circle(32, -2))
    expect(byAmplitude(c)[0]!.k).toBe(-2)
  })

  it('reconstructs every sample exactly with all terms', () => {
    const samples = resampleClosed(shape('star'), 128)
    const c = dft(samples)
    for (let n = 0; n < samples.length; n++) {
      const [x, y] = evaluate(c, n / samples.length)
      expect(x).toBeCloseTo(samples[n]![0], 10)
      expect(y).toBeCloseTo(samples[n]![1], 10)
    }
  })

  it('satisfies Parseval: sum |c_k|^2 = mean |z_n|^2', () => {
    const samples = resampleClosed(shape('heart'), 200)
    const power = dft(samples).reduce((s, c) => s + c.amp ** 2, 0)
    const mean = samples.reduce((s, [x, y]) => s + x * x + y * y, 0) / samples.length
    expect(power).toBeCloseTo(mean, 12)
  })

  it('has a truncation error equal to the RMS error predicted by Parseval', () => {
    const samples = resampleClosed(shape('square'), 128)
    const sorted = byAmplitude(dft(samples))
    const norm = Math.sqrt(samples.reduce((s, [x, y]) => s + x * x + y * y, 0) / samples.length)
    let previous = Infinity
    for (const terms of [1, 3, 9, 27, 81]) {
      let sq = 0
      for (let n = 0; n < samples.length; n++) {
        const [x, y] = evaluate(sorted, n / samples.length, terms)
        sq += (x - samples[n]![0]) ** 2 + (y - samples[n]![1]) ** 2
      }
      const rms = Math.sqrt(sq / samples.length) / norm
      const predicted = truncationError(sorted, terms)
      expect(rms).toBeCloseTo(predicted, 10)
      expect(predicted).toBeLessThan(previous)
      previous = predicted
    }
    expect(truncationError(sorted, sorted.length)).toBe(0)
  })

  it('chains epicycles so the tip equals the partial sum', () => {
    const c = byAmplitude(dft(resampleClosed(shape('trefoil'), 64)))
    const chain = epicycleChain(c, 0.37, 10)
    expect(chain).toHaveLength(11)
    const [x, y] = evaluate(c, 0.37, 10)
    expect(chain[10]![0]).toBeCloseTo(x, 12)
    expect(chain[10]![1]).toBeCloseTo(y, 12)
  })

  it('resamples a closed polyline to equal arc-length spacing', () => {
    const pts = resampleClosed(shape('square'), 64)
    // Perimeter 6.4 -> spacing 0.1, and the corners are hit exactly.
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i]!
      const [bx, by] = pts[(i + 1) % pts.length]!
      expect(Math.abs(bx - ax) + Math.abs(by - ay)).toBeCloseTo(0.1, 12)
    }
    expect(pts[0]).toEqual([-0.8, -0.8])
    expect(() => resampleClosed([[0, 0]], 8)).toThrow(RangeError)
    expect(() => resampleClosed([[1, 1], [1, 1]], 8)).toThrow(RangeError)
  })
})
