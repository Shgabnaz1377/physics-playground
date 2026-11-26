import { describe, expect, it } from 'vitest'
import { RK4 } from '@/physics/ode'
import {
  DoublePendulum,
  derivatives,
  normalModes,
  stateDistance,
  totalEnergy,
  type PendulumParams,
} from '@/physics/pendulum'

const P: PendulumParams = { m1: 1, m2: 1, l1: 1, l2: 1, g: 9.81 }

describe('RK4', () => {
  it('is fourth-order accurate on the harmonic oscillator', () => {
    const f = (y: Float64Array, out: Float64Array) => {
      out[0] = y[1]!
      out[1] = -y[0]!
    }
    const errorFor = (h: number) => {
      const rk = new RK4(2, f)
      const y = new Float64Array([1, 0])
      const n = Math.round(2 * Math.PI / h)
      for (let i = 0; i < n; i++) rk.step(y, h)
      const T = n * h
      return Math.hypot(y[0]! - Math.cos(T), y[1]! + Math.sin(T))
    }
    const e1 = errorFor(0.02)
    const e2 = errorFor(0.01)
    // Global error ~ h^4: halving h should cut the error by about 16.
    expect(e1 / e2).toBeGreaterThan(14)
    expect(e1 / e2).toBeLessThan(18)
  })
})

describe('double pendulum', () => {
  it('has equations of motion consistent with energy conservation (dE/dt = 0)', () => {
    const f = derivatives({ m1: 1.3, m2: 0.7, l1: 1.1, l2: 0.8, g: 9.81 })
    const p = { m1: 1.3, m2: 0.7, l1: 1.1, l2: 0.8, g: 9.81 }
    const states = [
      [0.3, -1.2, 0.5, 2.0],
      [2.5, 1.0, -3.0, 1.5],
      [-1.0, 3.0, 4.0, -6.0],
    ]
    const h = 1e-6
    for (const s of states) {
      const y = Float64Array.from(s)
      const dy = new Float64Array(4)
      f(y, dy)
      const fwd = y.map((v, i) => v + h * dy[i]!)
      const bwd = y.map((v, i) => v - h * dy[i]!)
      const dEdt = (totalEnergy(p, fwd) - totalEnergy(p, bwd)) / (2 * h)
      expect(Math.abs(dEdt)).toBeLessThan(1e-6)
    }
  })

  it('keeps the RK4 energy drift tiny for a chaotic trajectory', () => {
    const dp = new DoublePendulum(P, 2.0, 2.5)
    const e0 = dp.energy()
    let worst = 0
    for (let i = 0; i < 20000; i++) {
      dp.step(1e-3)
      worst = Math.max(worst, Math.abs((dp.energy() - e0) / e0))
    }
    // 20 s of chaotic motion at dt = 1 ms.
    expect(worst).toBeLessThan(1e-6)
  })

  it('drifts more with a larger step, as a fourth-order method should', () => {
    const drift = (h: number) => {
      const dp = new DoublePendulum(P, 1.5, 1.0)
      const e0 = dp.energy()
      const n = Math.round(5 / h)
      for (let i = 0; i < n; i++) dp.step(h)
      return Math.abs((dp.energy() - e0) / e0)
    }
    expect(drift(0.01)).toBeGreaterThan(drift(0.0025))
  })

  it('oscillates at the small-angle normal-mode frequencies', () => {
    const [wSlow, wFast] = normalModes(P)
    // Equal masses and lengths: w^2 = (g/l)(2 -/+ sqrt 2).
    expect(wSlow).toBeCloseTo(Math.sqrt(9.81 * (2 - Math.SQRT2)), 10)
    expect(wFast).toBeCloseTo(Math.sqrt(9.81 * (2 + Math.SQRT2)), 10)

    // In-phase mode: theta2 = sqrt(2) theta1. Time a full period by zero crossings.
    const eps = 1e-4
    const dp = new DoublePendulum(P, eps, Math.SQRT2 * eps)
    const h = 1e-4
    let prev = dp.y[0]!
    const crossings: number[] = []
    while (crossings.length < 3) {
      dp.step(h)
      const cur = dp.y[0]!
      if (prev > 0 && cur <= 0) crossings.push(dp.t - (h * cur) / (cur - prev))
      prev = cur
    }
    const period = crossings[2]! - crossings[1]!
    expect(period).toBeCloseTo((2 * Math.PI) / wSlow, 4)
  })

  it('separates nearby trajectories exponentially at high energy but not at low energy', () => {
    const grow = (t1: number, t2: number) => {
      const a = new DoublePendulum(P, t1, t2)
      const b = new DoublePendulum(P, t1 + 1e-9, t2)
      for (let i = 0; i < 15000; i++) {
        a.step(1e-3)
        b.step(1e-3)
      }
      return stateDistance(a.y, b.y) / 1e-9
    }
    expect(grow(2.0, 2.5)).toBeGreaterThan(1e4)
    expect(grow(0.1, 0.1)).toBeLessThan(1e2)
  })

  it('wraps angle differences when measuring distance', () => {
    expect(stateDistance([Math.PI - 0.01, 0, 0, 0], [-Math.PI + 0.01, 0, 0, 0])).toBeCloseTo(0.02, 12)
  })
})
