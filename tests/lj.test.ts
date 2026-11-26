import { describe, expect, it } from 'vitest'
import {
  LJSystem,
  RC,
  accumulateSpeeds,
  maxwellBoltzmann2D,
  maxwellBoltzmann2DCdf,
  pairForce,
  pairPotential,
} from '@/physics/lj'

describe('Lennard-Jones pair interaction', () => {
  it('has F = -dU/dr everywhere inside the cutoff', () => {
    for (const r of [0.9, 1.0, 1.12, 1.5, 2.0, 2.4]) {
      const h = 1e-6
      const dUdr = (pairPotential(r + h) - pairPotential(r - h)) / (2 * h)
      expect(pairForce(r)).toBeCloseTo(-dUdr, 5)
    }
  })

  it('is shifted to zero at the cutoff and has its minimum at 2^(1/6)', () => {
    expect(pairPotential(RC - 1e-12)).toBeCloseTo(0, 9)
    expect(pairPotential(RC + 0.1)).toBe(0)
    const rmin = 2 ** (1 / 6)
    expect(pairForce(rmin)).toBeCloseTo(0, 12)
    expect(pairPotential(rmin)).toBeLessThan(pairPotential(rmin * 0.99))
    expect(pairPotential(rmin)).toBeLessThan(pairPotential(rmin * 1.01))
  })
})

describe('LJ molecular dynamics', () => {
  it('computes identical forces with the cell list and the O(N^2) loop', () => {
    const sys = new LJSystem({ N: 300, density: 0.4, temperature: 1, seed: 2 })
    for (let k = 0; k < 200; k++) sys.step(0.004)
    sys.useCells = true
    sys.computeForces()
    const fx = sys.fx.slice()
    const fy = sys.fy.slice()
    const pot = sys.potential
    sys.useCells = false
    sys.computeForces()
    let err = 0
    for (let i = 0; i < sys.N; i++) err = Math.max(err, Math.abs(fx[i]! - sys.fx[i]!), Math.abs(fy[i]! - sys.fy[i]!))
    expect(err).toBeLessThan(1e-9)
    expect(sys.potential).toBeCloseTo(pot, 9)
  })

  it('conserves total momentum (Newton’s third law)', () => {
    const sys = new LJSystem({ N: 200, density: 0.5, temperature: 1.5, seed: 4 })
    for (let k = 0; k < 1000; k++) sys.step(0.004)
    const [px, py] = sys.momentum()
    expect(Math.abs(px)).toBeLessThan(1e-10)
    expect(Math.abs(py)).toBeLessThan(1e-10)
  })

  it('conserves energy in NVE with velocity Verlet', () => {
    const sys = new LJSystem({ N: 200, density: 0.4, temperature: 1, seed: 5 })
    for (let k = 0; k < 500; k++) sys.step(0.002) // let the lattice melt first
    const e0 = sys.totalEnergy()
    let worst = 0
    for (let k = 0; k < 3000; k++) {
      sys.step(0.002)
      worst = Math.max(worst, Math.abs(sys.totalEnergy() - e0))
    }
    // Per-particle energy fluctuation stays tiny compared with kT = 1.
    expect(worst / sys.N).toBeLessThan(2e-3)
  })

  it('drives the temperature to the target with the Berendsen thermostat', () => {
    const sys = new LJSystem({ N: 200, density: 0.3, temperature: 3, seed: 6 })
    for (let k = 0; k < 3000; k++) {
      sys.step(0.004)
      sys.berendsen(0.8, 0.004, 0.1)
    }
    expect(sys.temperature()).toBeCloseTo(0.8, 1)
  })

  it('relaxes to the 2D Maxwell-Boltzmann speed distribution', () => {
    const sys = new LJSystem({ N: 400, density: 0.3, temperature: 1.2, seed: 7 })
    for (let k = 0; k < 1500; k++) sys.step(0.004)
    const nb = 30
    const vmax = 6
    const bins = new Float64Array(nb)
    let Tsum = 0
    let samples = 0
    let vx2 = 0
    let vy2 = 0
    for (let k = 0; k < 4000; k++) {
      sys.step(0.004)
      if (k % 20 === 0) {
        accumulateSpeeds(sys.vx, sys.vy, bins, vmax)
        Tsum += sys.temperature()
        for (let i = 0; i < sys.N; i++) {
          vx2 += sys.vx[i]! ** 2
          vy2 += sys.vy[i]! ** 2
        }
        samples++
      }
    }
    const T = Tsum / samples
    const total = bins.reduce((a, b) => a + b, 0)
    let tv = 0
    for (let k = 0; k < nb; k++) {
      const expected = maxwellBoltzmann2DCdf((k * vmax) / nb, ((k + 1) * vmax) / nb, T)
      tv += Math.abs(bins[k]! / total - expected)
    }
    // Total variation distance between the measured and predicted histograms.
    expect(tv / 2).toBeLessThan(0.03)
    // Equipartition: each velocity component carries kT/2.
    const n = samples * sys.N
    expect(vx2 / n).toBeCloseTo(T, 1)
    expect(vy2 / n).toBeCloseTo(T, 1)
  })
})

describe('Maxwell-Boltzmann (2D)', () => {
  it('is normalised and has mean speed sqrt(pi T / 2)', () => {
    const T = 1.7
    let norm = 0
    let mean = 0
    const dv = 1e-3
    for (let v = dv / 2; v < 20; v += dv) {
      norm += maxwellBoltzmann2D(v, T) * dv
      mean += v * maxwellBoltzmann2D(v, T) * dv
    }
    expect(norm).toBeCloseTo(1, 6)
    expect(mean).toBeCloseTo(Math.sqrt((Math.PI * T) / 2), 5)
    expect(maxwellBoltzmann2DCdf(0, Infinity, T)).toBe(1)
  })
})
