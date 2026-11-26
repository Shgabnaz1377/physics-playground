import { describe, expect, it } from 'vitest'
import {
  CFL_LIMIT_2D,
  addBarrier,
  addPulse,
  advance,
  buildScene,
  createGrid,
  discreteOmega,
  energy,
  fraunhofer,
  maxAbs,
  slitGaps,
  step,
  type WaveGrid,
} from '@/physics/wave'
import { mulberry32 } from '@/lib/random'

function noisy(nx: number, ny: number, seed = 1): WaveGrid {
  const g = createGrid(nx, ny)
  const rnd = mulberry32(seed)
  for (let y = 1; y < ny - 1; y++) {
    for (let x = 1; x < nx - 1; x++) {
      const v = (rnd() - 0.5) * 1e-3
      g.u[y * nx + x] = v
      g.prev[y * nx + x] = v
    }
  }
  return g
}

describe('wave equation: CFL stability', () => {
  it('has the 2D limit 1/sqrt(2)', () => {
    expect(CFL_LIMIT_2D).toBeCloseTo(0.70710678, 8)
  })

  it('stays bounded just below the limit', () => {
    const g = noisy(48, 40)
    for (let i = 0; i < 600; i++) step(g, 0.7)
    expect(maxAbs(g.u)).toBeLessThan(1e-2)
  })

  it('blows up just above the limit', () => {
    const g = noisy(48, 40)
    for (let i = 0; i < 600; i++) step(g, 0.75)
    expect(maxAbs(g.u)).toBeGreaterThan(1e6)
  })
})

describe('wave equation: accuracy and conservation', () => {
  it('conserves the discrete energy without damping', () => {
    const g = createGrid(60, 50)
    addPulse(g, 25, 22, 3, 1)
    const C = 0.5
    step(g, C)
    const e0 = energy(g, C)
    for (let i = 0; i < 2000; i++) step(g, C)
    expect(e0).toBeGreaterThan(0)
    expect(Math.abs(energy(g, C) - e0) / e0).toBeLessThan(1e-9)
  })

  it('reproduces the exact discrete eigenmode frequency', () => {
    const nx = 41
    const ny = 31
    const mx = 3
    const my = 2
    const kx = (mx * Math.PI) / (nx - 1)
    const ky = (my * Math.PI) / (ny - 1)
    const C = 0.6
    const w = discreteOmega(kx, ky, C)
    const g = createGrid(nx, ny)
    const mode = (x: number, y: number) => Math.sin(kx * x) * Math.sin(ky * y)
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        g.u[y * nx + x] = mode(x, y)
        g.prev[y * nx + x] = mode(x, y) * Math.cos(w * C) // u at t = -dt
      }
    }
    const steps = 500
    for (let i = 0; i < steps; i++) step(g, C)
    let err = 0
    const amp = Math.cos(w * C * steps)
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) err = Math.max(err, Math.abs(g.u[y * nx + x]! - amp * mode(x, y)))
    }
    expect(err).toBeLessThan(1e-9)
    // And the discrete frequency approaches the continuum one, c|k|, as C -> 0.
    expect(discreteOmega(kx, ky, 1e-4)).toBeCloseTo(
      2 * Math.sqrt(Math.sin(kx / 2) ** 2 + Math.sin(ky / 2) ** 2),
      6,
    )
  })

  it('absorbs outgoing waves in the sponge layer', () => {
    const g = createGrid(80, 80, 16)
    addPulse(g, 40, 40, 3, 1)
    const C = 0.5
    step(g, C)
    const e0 = energy(g, C)
    for (let i = 0; i < 800; i++) step(g, C)
    expect(energy(g, C) / e0).toBeLessThan(0.02)
  })
})

describe('wave equation: geometry and sources', () => {
  it('keeps barrier cells at zero and leaves slits open', () => {
    const g = createGrid(40, 40)
    const gaps = slitGaps(40, 2, 12, 4)
    expect(gaps).toEqual([
      [12, 16],
      [24, 28],
    ])
    addBarrier(g, 20, 1, gaps)
    expect(g.wall[13 * 40 + 20]).toBe(0)
    expect(g.wall[20 * 40 + 20]).toBe(1)
    addPulse(g, 15, 20, 3, 1)
    for (let i = 0; i < 200; i++) step(g, 0.5)
    for (let y = 0; y < 40; y++) if (g.wall[y * 40 + 20]) expect(g.u[y * 40 + 20]).toBe(0)
  })

  it('drives a source at the requested wavelength', () => {
    const scene = buildScene({ nx: 120, ny: 60, scene: 'two-sources', separation: 20, slitWidth: 4, spongeWidth: 10 })
    const params = { courant: 0.5, wavelength: 16, amplitude: 1, sources: scene.sources }
    const s = scene.sources[0]!
    const samples: number[] = []
    for (let i = 0; i < 64; i++) {
      advance(scene.grid, params, 1)
      samples.push(scene.grid.u[s.y * 120 + s.x]!)
    }
    // Period = wavelength / c = 16 time units = 32 steps at C = 0.5.
    for (let i = 0; i < 32; i++) expect(samples[i + 32]).toBeCloseTo(samples[i]!, 9)
    expect(Math.max(...samples)).toBeCloseTo(1, 2)
  })

  it('has the textbook Fraunhofer pattern', () => {
    const lambda = 10
    const d = 40
    // Central maximum, and first double-slit minimum at d sin(theta) = lambda / 2.
    expect(fraunhofer(0, lambda, 2, 4, d)).toBe(1)
    expect(fraunhofer(Math.asin(lambda / (2 * d)), lambda, 2, 4, d)).toBeCloseTo(0, 12)
    // First single-slit zero at a sin(theta) = lambda.
    expect(fraunhofer(Math.asin(lambda / 20), lambda, 1, 20, d)).toBeCloseTo(0, 12)
  })
})
