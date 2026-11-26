import { describe, expect, it } from 'vitest'
import {
  Cell,
  STABILITY_LIMIT,
  buildPreset,
  createHeatGrid,
  paintDisc,
  range,
  setCell,
  stepHeat,
  stepHeatUnchecked,
  totalHeat,
} from '@/physics/heat'
import { mulberry32 } from '@/lib/random'

describe('heat diffusion', () => {
  it('conserves total heat with insulated boundaries and internal walls', () => {
    const g = createHeatGrid(60, 40)
    const rnd = mulberry32(3)
    for (let i = 0; i < g.u.length; i++) g.u[i] = rnd()
    for (let y = 5; y < 35; y++) setCell(g, 30, y, Cell.Wall)
    paintDisc(g, 15, 20, 4, (i) => (g.kind[i] = Cell.Wall))
    const q0 = totalHeat(g)
    for (let n = 0; n < 5000; n++) stepHeat(g, 0.25)
    expect(Math.abs(totalHeat(g) - q0) / q0).toBeLessThan(1e-12)
  })

  it('relaxes a closed region to its mean temperature', () => {
    const g = createHeatGrid(20, 20)
    paintDisc(g, 5, 5, 3, (i) => (g.u[i] = 1))
    const mean = totalHeat(g) / 400
    for (let n = 0; n < 20000; n++) stepHeat(g, 0.25)
    const [lo, hi] = range(g)
    expect(lo).toBeCloseTo(mean, 6)
    expect(hi).toBeCloseTo(mean, 6)
  })

  it('keeps a sealed-off pocket at its own temperature', () => {
    const g = createHeatGrid(30, 30)
    // A closed square of wall around a hot pocket.
    for (let k = 10; k <= 20; k++) {
      setCell(g, k, 10, Cell.Wall)
      setCell(g, k, 20, Cell.Wall)
      setCell(g, 10, k, Cell.Wall)
      setCell(g, 20, k, Cell.Wall)
    }
    for (let y = 11; y < 20; y++) for (let x = 11; x < 20; x++) g.u[y * 30 + x] = 1
    for (let n = 0; n < 2000; n++) stepHeat(g, 0.2)
    expect(g.u[15 * 30 + 15]).toBe(1)
    expect(g.u[2 * 30 + 2]).toBe(0)
  })

  it('reaches the linear steady state between a hot and a cold reservoir', () => {
    const nx = 21
    const g = buildPreset(nx, 6, 'bar')
    for (let n = 0; n < 40000; n++) stepHeat(g, 0.25)
    for (let x = 0; x < nx; x++) {
      expect(g.u[3 * nx + x]).toBeCloseTo(1 - x / (nx - 1), 6)
    }
  })

  it('spreads a point source with variance growing by 2r per step per axis (discrete Einstein relation)', () => {
    const n = 101
    const g = createHeatGrid(n, n)
    g.u[50 * n + 50] = 1
    const r = 0.2
    const steps = 150
    for (let k = 0; k < steps; k++) stepHeat(g, r)
    let varX = 0
    let varY = 0
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = g.u[y * n + x]!
        varX += v * (x - 50) ** 2
        varY += v * (y - 50) ** 2
      }
    }
    expect(varX).toBeCloseTo(2 * r * steps, 6)
    expect(varY).toBeCloseTo(2 * r * steps, 6)
  })

  it('respects the maximum principle at r = 1/4 and violates it above', () => {
    const checker = () => {
      const g = createHeatGrid(30, 30)
      for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) g.u[y * 30 + x] = (x + y) % 2
      return g
    }
    const stable = checker()
    for (let k = 0; k < 500; k++) stepHeat(stable, STABILITY_LIMIT)
    const [lo, hi] = range(stable)
    expect(lo).toBeGreaterThanOrEqual(0)
    expect(hi).toBeLessThanOrEqual(1)

    const unstable = checker()
    for (let k = 0; k < 500; k++) stepHeatUnchecked(unstable, 0.3)
    const [ulo, uhi] = range(unstable)
    expect(Math.max(-ulo, uhi)).toBeGreaterThan(1e6)
  })

  it('refuses unstable steps', () => {
    expect(() => stepHeat(createHeatGrid(4, 4), 0.26)).toThrow(RangeError)
  })

  it('holds fixed-temperature cells at their values', () => {
    const g = buildPreset(40, 20, 'radiator')
    for (let k = 0; k < 500; k++) stepHeat(g, 0.25)
    expect(g.u[10 * 40 + 3]).toBe(1)
    expect(g.u[10 * 40 + 39]).toBe(0)
  })
})
