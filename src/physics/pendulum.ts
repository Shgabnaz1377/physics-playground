import { RK4 } from './ode'

/**
 * Planar double pendulum with point masses on massless rigid rods.
 * State vector: [theta1, theta2, omega1, omega2], angles from the downward vertical.
 */

export interface PendulumParams {
  m1: number
  m2: number
  l1: number
  l2: number
  g: number
}

export const STATE_DIM = 4

/** Equations of motion from the Lagrangian, solved for the angular accelerations. */
export function derivatives(p: PendulumParams): (y: Float64Array, out: Float64Array) => void {
  return (y, out) => {
    const { m1, m2, l1, l2, g } = p
    const t1 = y[0]!
    const t2 = y[1]!
    const w1 = y[2]!
    const w2 = y[3]!
    const d = t1 - t2
    const sd = Math.sin(d)
    const cd = Math.cos(d)
    const den = 2 * m1 + m2 - m2 * Math.cos(2 * d)
    out[0] = w1
    out[1] = w2
    out[2] =
      (-g * (2 * m1 + m2) * Math.sin(t1) -
        m2 * g * Math.sin(t1 - 2 * t2) -
        2 * sd * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * cd)) /
      (l1 * den)
    out[3] =
      (2 * sd * (w1 * w1 * l1 * (m1 + m2) + g * (m1 + m2) * Math.cos(t1) + w2 * w2 * l2 * m2 * cd)) /
      (l2 * den)
  }
}

export function kineticEnergy(p: PendulumParams, y: ArrayLike<number>): number {
  const { m1, m2, l1, l2 } = p
  const w1 = y[2]!
  const w2 = y[3]!
  return (
    0.5 * m1 * l1 * l1 * w1 * w1 +
    0.5 * m2 * (l1 * l1 * w1 * w1 + l2 * l2 * w2 * w2 + 2 * l1 * l2 * w1 * w2 * Math.cos(y[0]! - y[1]!))
  )
}

/** Potential energy with the pivot as the zero level. */
export function potentialEnergy(p: PendulumParams, y: ArrayLike<number>): number {
  const { m1, m2, l1, l2, g } = p
  return -(m1 + m2) * g * l1 * Math.cos(y[0]!) - m2 * g * l2 * Math.cos(y[1]!)
}

export function totalEnergy(p: PendulumParams, y: ArrayLike<number>): number {
  return kineticEnergy(p, y) + potentialEnergy(p, y)
}

/** Cartesian bob positions (y axis pointing down), pivot at the origin. */
export function bobPositions(p: PendulumParams, y: ArrayLike<number>): [number, number, number, number] {
  const x1 = p.l1 * Math.sin(y[0]!)
  const y1 = p.l1 * Math.cos(y[0]!)
  return [x1, y1, x1 + p.l2 * Math.sin(y[1]!), y1 + p.l2 * Math.cos(y[1]!)]
}

/** Small-oscillation normal-mode angular frequencies (exact for the linearised system). */
export function normalModes(p: PendulumParams): [number, number] {
  // Linearised: M q'' + K q = 0 with
  // M = [[(m1+m2) l1^2, m2 l1 l2], [m2 l1 l2, m2 l2^2]], K = diag((m1+m2) g l1, m2 g l2).
  const { m1, m2, l1, l2, g } = p
  const a = (m1 + m2) * l1 * l1
  const b = m2 * l1 * l2
  const c = m2 * l2 * l2
  const k1 = (m1 + m2) * g * l1
  const k2 = m2 * g * l2
  // det(K - w^2 M) = 0  ->  A w^4 + B w^2 + C = 0
  const A = a * c - b * b
  const B = -(k1 * c + k2 * a)
  const C = k1 * k2
  const disc = Math.sqrt(B * B - 4 * A * C)
  const lo = (-B - disc) / (2 * A)
  const hi = (-B + disc) / (2 * A)
  return [Math.sqrt(lo), Math.sqrt(hi)]
}

/** A double pendulum integrated with RK4 at a fixed step. */
export class DoublePendulum {
  readonly y = new Float64Array(STATE_DIM)
  t = 0
  private rk: RK4

  constructor(
    public params: PendulumParams,
    theta1: number,
    theta2: number,
    omega1 = 0,
    omega2 = 0,
  ) {
    this.y.set([theta1, theta2, omega1, omega2])
    this.rk = new RK4(STATE_DIM, derivatives(params))
  }

  setParams(p: PendulumParams): void {
    this.params = p
    this.rk = new RK4(STATE_DIM, derivatives(p))
  }

  step(h: number): void {
    this.rk.step(this.y, h)
    this.t += h
  }

  energy(): number {
    return totalEnergy(this.params, this.y)
  }
}

/**
 * Distance between two trajectories in state space, with angle differences
 * wrapped to (-pi, pi] so a full revolution does not count as divergence.
 */
export function stateDistance(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const wrap = (x: number) => Math.atan2(Math.sin(x), Math.cos(x))
  const d0 = wrap(a[0]! - b[0]!)
  const d1 = wrap(a[1]! - b[1]!)
  const d2 = a[2]! - b[2]!
  const d3 = a[3]! - b[3]!
  return Math.sqrt(d0 * d0 + d1 * d1 + d2 * d2 + d3 * d3)
}
