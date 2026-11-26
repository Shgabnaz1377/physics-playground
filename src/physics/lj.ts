import { gaussian, mulberry32 } from '@/lib/random'

/**
 * 2D Lennard-Jones fluid in a periodic square box, in reduced units
 * (sigma = epsilon = m = k_B = 1). Pair potential, truncated and shifted at rc:
 *   U(r) = 4 (r^-12 - r^-6) - U_LJ(rc)   for r < rc, 0 otherwise.
 * Integrated with velocity Verlet; forces use a cell list.
 */

export const RC = 2.5

const RC2 = RC * RC
const U_RC = 4 * (RC ** -12 - RC ** -6)

/** Shifted pair potential. */
export function pairPotential(r: number): number {
  if (r >= RC) return 0
  const ir6 = r ** -6
  return 4 * (ir6 * ir6 - ir6) - U_RC
}

/** Magnitude of the pair force, F(r) = -dU/dr (positive = repulsive). */
export function pairForce(r: number): number {
  if (r >= RC) return 0
  const ir = 1 / r
  const ir6 = ir ** 6
  return 24 * ir * (2 * ir6 * ir6 - ir6)
}

/** 2D Maxwell-Boltzmann speed distribution for unit mass: f(v) = (v/T) exp(-v^2 / 2T). */
export function maxwellBoltzmann2D(v: number, T: number): number {
  return (v / T) * Math.exp((-v * v) / (2 * T))
}

/** Probability that the speed lies in [a, b] under the 2D Maxwell-Boltzmann law (closed form). */
export function maxwellBoltzmann2DCdf(a: number, b: number, T: number): number {
  return Math.exp((-a * a) / (2 * T)) - Math.exp((-b * b) / (2 * T))
}

export interface LJOptions {
  N: number
  density: number
  temperature: number
  seed?: number
}

export class LJSystem {
  readonly N: number
  readonly L: number
  readonly x: Float64Array
  readonly y: Float64Array
  readonly vx: Float64Array
  readonly vy: Float64Array
  readonly fx: Float64Array
  readonly fy: Float64Array
  potential = 0
  /** Pair virial sum r . F, for the pressure. */
  virial = 0
  time = 0
  private readonly nc: number
  private readonly cellSize: number
  private readonly head: Int32Array
  private readonly next: Int32Array
  /** Use the cell list (true) or the O(N^2) reference loop (false). */
  useCells = true

  constructor(o: LJOptions) {
    this.N = o.N
    this.L = Math.sqrt(o.N / o.density)
    const n = o.N
    this.x = new Float64Array(n)
    this.y = new Float64Array(n)
    this.vx = new Float64Array(n)
    this.vy = new Float64Array(n)
    this.fx = new Float64Array(n)
    this.fy = new Float64Array(n)
    this.nc = Math.max(1, Math.floor(this.L / RC))
    this.cellSize = this.L / this.nc
    this.head = new Int32Array(this.nc * this.nc)
    this.next = new Int32Array(n)

    // Square lattice start (no overlaps), random Gaussian velocities at the target temperature.
    const rnd = mulberry32(o.seed ?? 1)
    const side = Math.ceil(Math.sqrt(n))
    const a = this.L / side
    for (let i = 0; i < n; i++) {
      this.x[i] = ((i % side) + 0.5) * a
      this.y[i] = (Math.floor(i / side) + 0.5) * a
      this.vx[i] = gaussian(rnd)
      this.vy[i] = gaussian(rnd)
    }
    this.removeDrift()
    this.scaleToTemperature(o.temperature)
    this.computeForces()
  }

  removeDrift(): void {
    let px = 0
    let py = 0
    for (let i = 0; i < this.N; i++) {
      px += this.vx[i]!
      py += this.vy[i]!
    }
    px /= this.N
    py /= this.N
    for (let i = 0; i < this.N; i++) {
      this.vx[i] = this.vx[i]! - px
      this.vy[i] = this.vy[i]! - py
    }
  }

  kinetic(): number {
    let k = 0
    for (let i = 0; i < this.N; i++) k += this.vx[i]! ** 2 + this.vy[i]! ** 2
    return 0.5 * k
  }

  /** Kinetic temperature with 2N - 2 degrees of freedom (total momentum is fixed). */
  temperature(): number {
    return (2 * this.kinetic()) / (2 * this.N - 2)
  }

  totalEnergy(): number {
    return this.kinetic() + this.potential
  }

  /** Virial pressure P = (N T + virial / 2) / A in 2D. */
  pressure(): number {
    return (this.N * this.temperature() + 0.5 * this.virial) / (this.L * this.L)
  }

  momentum(): [number, number] {
    let px = 0
    let py = 0
    for (let i = 0; i < this.N; i++) {
      px += this.vx[i]!
      py += this.vy[i]!
    }
    return [px, py]
  }

  scaleToTemperature(T: number): void {
    const cur = this.temperature()
    if (cur <= 0) return
    const s = Math.sqrt(T / cur)
    for (let i = 0; i < this.N; i++) {
      this.vx[i] = this.vx[i]! * s
      this.vy[i] = this.vy[i]! * s
    }
  }

  private wrap(d: number): number {
    const L = this.L
    if (d > 0.5 * L) return d - L
    if (d < -0.5 * L) return d + L
    return d
  }

  private pair(i: number, j: number): void {
    const dx = this.wrap(this.x[i]! - this.x[j]!)
    const dy = this.wrap(this.y[i]! - this.y[j]!)
    const r2 = dx * dx + dy * dy
    if (r2 >= RC2) return
    const ir2 = 1 / r2
    const ir6 = ir2 * ir2 * ir2
    // F/r = 24 (2 r^-14 - r^-8)
    const fOverR = 24 * ir2 * (2 * ir6 * ir6 - ir6)
    const fx = fOverR * dx
    const fy = fOverR * dy
    this.fx[i] = this.fx[i]! + fx
    this.fy[i] = this.fy[i]! + fy
    this.fx[j] = this.fx[j]! - fx
    this.fy[j] = this.fy[j]! - fy
    this.potential += 4 * (ir6 * ir6 - ir6) - U_RC
    this.virial += fOverR * r2
  }

  computeForces(): void {
    this.fx.fill(0)
    this.fy.fill(0)
    this.potential = 0
    this.virial = 0
    const N = this.N
    if (!this.useCells || this.nc < 3) {
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) this.pair(i, j)
      return
    }
    const { nc, cellSize, head, next } = this
    head.fill(-1)
    for (let i = 0; i < N; i++) {
      const cx = Math.min(nc - 1, Math.floor(this.x[i]! / cellSize))
      const cy = Math.min(nc - 1, Math.floor(this.y[i]! / cellSize))
      const c = cy * nc + cx
      next[i] = head[c]!
      head[c] = i
    }
    // Visit each cell and half of its neighbours (E, NE, N, NW) so every pair is counted once.
    const offsets = [
      [1, 0],
      [1, 1],
      [0, 1],
      [-1, 1],
    ] as const
    for (let cy = 0; cy < nc; cy++) {
      for (let cx = 0; cx < nc; cx++) {
        const c = cy * nc + cx
        for (let i = head[c]!; i !== -1; i = next[i]!) {
          for (let j = next[i]!; j !== -1; j = next[j]!) this.pair(i, j)
        }
        for (const [ox, oy] of offsets) {
          const c2 = ((cy + oy + nc) % nc) * nc + ((cx + ox + nc) % nc)
          for (let i = head[c]!; i !== -1; i = next[i]!) {
            for (let j = head[c2]!; j !== -1; j = next[j]!) this.pair(i, j)
          }
        }
      }
    }
  }

  /** One velocity-Verlet step. */
  step(dt: number): void {
    const { N, L, x, y, vx, vy, fx, fy } = this
    const h = 0.5 * dt
    for (let i = 0; i < N; i++) {
      vx[i] = vx[i]! + h * fx[i]!
      vy[i] = vy[i]! + h * fy[i]!
      let xi = x[i]! + dt * vx[i]!
      let yi = y[i]! + dt * vy[i]!
      xi -= Math.floor(xi / L) * L
      yi -= Math.floor(yi / L) * L
      x[i] = xi
      y[i] = yi
    }
    this.computeForces()
    for (let i = 0; i < N; i++) {
      vx[i] = vx[i]! + h * fx[i]!
      vy[i] = vy[i]! + h * fy[i]!
    }
    this.time += dt
  }

  /** Berendsen weak-coupling thermostat: relax T towards target with time constant tau. */
  berendsen(target: number, dt: number, tau: number): void {
    const T = this.temperature()
    if (T <= 0) return
    const lambda = Math.sqrt(1 + (dt / tau) * (target / T - 1))
    for (let i = 0; i < this.N; i++) {
      this.vx[i] = this.vx[i]! * lambda
      this.vy[i] = this.vy[i]! * lambda
    }
  }
}

/** Accumulate a histogram of particle speeds into `bins` (counts are added, not reset). */
export function accumulateSpeeds(vx: Float64Array, vy: Float64Array, bins: Float64Array, vmax: number): void {
  const nb = bins.length
  for (let i = 0; i < vx.length; i++) {
    const v = Math.hypot(vx[i]!, vy[i]!)
    const k = Math.floor((v / vmax) * nb)
    if (k < nb) bins[k] = bins[k]! + 1
  }
}
