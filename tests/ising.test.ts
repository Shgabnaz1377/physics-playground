import { describe, expect, it } from 'vitest'
import { IsingLattice, TC, ellipticK, onsagerEnergy, onsagerMagnetization } from '@/physics/ising'

function pattern(L: number, f: (x: number, y: number) => number): number[] {
  const out: number[] = []
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) out.push(f(x, y))
  return out
}

describe('Ising observables on known configurations', () => {
  const L = 8
  const N = L * L

  it('all up: E = -2N, M = N', () => {
    const lat = new IsingLattice(L, 1, 'up')
    expect(lat.energy).toBe(-2 * N)
    expect(lat.m()).toBe(1)
  })

  it('all up in a field: E = -(2 + h) N', () => {
    const lat = new IsingLattice(L, 1, 'up')
    lat.setParams(2, 0.5)
    expect(lat.energy).toBeCloseTo(-2.5 * N, 12)
  })

  it('checkerboard: E = +2N, M = 0', () => {
    const lat = new IsingLattice(L)
    lat.setSpins(pattern(L, (x, y) => ((x + y) % 2 ? 1 : -1)))
    expect(lat.energy).toBe(2 * N)
    expect(lat.magnetization).toBe(0)
  })

  it('stripes: horizontal bonds satisfied, vertical frustrated, E = 0', () => {
    const lat = new IsingLattice(L)
    lat.setSpins(pattern(L, (_x, y) => (y % 2 ? 1 : -1)))
    expect(lat.energy).toBeCloseTo(0, 12)
    expect(lat.magnetization).toBe(0)
  })

  it('flipping one spin in the ordered state costs 8J', () => {
    const lat = new IsingLattice(L, 1, 'up')
    expect(lat.deltaE(0)).toBe(8)
    expect(lat.deltaE(N - 1)).toBe(8)
  })

  it('handles periodic boundaries (wrap-around neighbours)', () => {
    const lat = new IsingLattice(4)
    // One down spin in a corner: its 4 bonds (two via wrap-around) are broken.
    lat.setSpins(pattern(4, (x, y) => (x === 0 && y === 0 ? -1 : 1)))
    expect(lat.energy).toBe(-2 * 16 + 8)
  })
})

describe('Metropolis dynamics', () => {
  it('keeps incremental E and M equal to a full recomputation', () => {
    const lat = new IsingLattice(16, 3)
    lat.setParams(2.4, 0.3)
    for (let i = 0; i < 200; i++) lat.sweep()
    const e = lat.energy
    const m = lat.magnetization
    lat.recompute()
    expect(e).toBeCloseTo(lat.energy, 9)
    expect(m).toBe(lat.magnetization)
  })

  it('stays ordered well below Tc and disorders well above', () => {
    const cold = new IsingLattice(32, 5, 'up')
    cold.setParams(1.0, 0)
    const hot = new IsingLattice(32, 6, 'up')
    hot.setParams(5.0, 0)
    for (let i = 0; i < 300; i++) {
      cold.sweep()
      hot.sweep()
    }
    let mc = 0
    let mh = 0
    for (let i = 0; i < 300; i++) {
      cold.sweep()
      hot.sweep()
      mc += Math.abs(cold.m())
      mh += Math.abs(hot.m())
    }
    expect(mc / 300).toBeGreaterThan(0.99)
    expect(mh / 300).toBeLessThan(0.15)
  })

  it('reproduces Onsager magnetisation and energy at T = 2.0 and the energy at T = 3.0', () => {
    const measure = (T: number, seed: number) => {
      const lat = new IsingLattice(32, seed, 'up')
      lat.setParams(T, 0)
      for (let i = 0; i < 500; i++) lat.sweep()
      let m = 0
      let e = 0
      const n = 2000
      for (let i = 0; i < n; i++) {
        lat.sweep()
        m += Math.abs(lat.m())
        e += lat.e()
      }
      return { m: m / n, e: e / n }
    }
    const low = measure(2.0, 11)
    expect(Math.abs(low.m - onsagerMagnetization(2.0))).toBeLessThan(0.02)
    expect(Math.abs(low.e - onsagerEnergy(2.0))).toBeLessThan(0.02)
    const high = measure(3.0, 12)
    expect(Math.abs(high.e - onsagerEnergy(3.0))).toBeLessThan(0.02)
  })
})

describe('exact solution helpers', () => {
  it('has Tc = 2 / ln(1 + sqrt 2)', () => {
    expect(TC).toBeCloseTo(2.269185, 6)
  })

  it('computes K(k) via the AGM', () => {
    expect(ellipticK(0)).toBeCloseTo(Math.PI / 2, 14)
    // K(1/sqrt 2) = Gamma(1/4)^2 / (4 sqrt(pi))
    expect(ellipticK(Math.SQRT1_2)).toBeCloseTo(1.8540746773013719, 12)
  })

  it('gives the known limits of the exact energy and magnetisation', () => {
    expect(onsagerEnergy(0.05)).toBeCloseTo(-2, 8)
    expect(onsagerEnergy(TC)).toBeCloseTo(-Math.SQRT2, 6)
    expect(onsagerMagnetization(0.5)).toBeCloseTo(1, 6)
    expect(onsagerMagnetization(TC + 0.01)).toBe(0)
    expect(onsagerMagnetization(TC - 1e-6)).toBeLessThan(0.3)
  })
})
