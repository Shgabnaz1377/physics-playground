import { mulberry32 } from '@/lib/random'

/**
 * 2D Ising model on an L x L square lattice with periodic boundaries:
 *   H = -J sum_<ij> s_i s_j - h sum_i s_i,   s_i = +/-1
 * sampled with single-spin-flip Metropolis. Units: J = k_B = 1.
 */

/** Onsager's exact critical temperature, 2 / ln(1 + sqrt 2). */
export const TC = 2 / Math.log(1 + Math.SQRT2)

export type IsingInit = 'random' | 'up'

export class IsingLattice {
  readonly N: number
  readonly spins: Int8Array
  /** Total energy, tracked incrementally. */
  energy = 0
  /** Sum of spins, tracked incrementally. */
  magnetization = 0
  sweeps = 0
  private T = TC
  private h = 0
  /** exp(-dE / T) for s in {-1, +1} and neighbour sum in {-4, -2, 0, 2, 4}. */
  private readonly accept = new Float64Array(10)
  private readonly rnd: () => number
  private readonly left: Int32Array
  private readonly right: Int32Array
  private readonly up: Int32Array
  private readonly down: Int32Array

  constructor(
    readonly L: number,
    seed = 1,
    init: IsingInit = 'random',
  ) {
    this.N = L * L
    this.spins = new Int8Array(this.N)
    this.rnd = mulberry32(seed)
    this.left = new Int32Array(this.N)
    this.right = new Int32Array(this.N)
    this.up = new Int32Array(this.N)
    this.down = new Int32Array(this.N)
    for (let y = 0; y < L; y++) {
      for (let x = 0; x < L; x++) {
        const i = y * L + x
        this.left[i] = y * L + ((x - 1 + L) % L)
        this.right[i] = y * L + ((x + 1) % L)
        this.up[i] = ((y - 1 + L) % L) * L + x
        this.down[i] = ((y + 1) % L) * L + x
      }
    }
    this.fill(init)
    this.setParams(TC, 0)
  }

  fill(init: IsingInit): void {
    for (let i = 0; i < this.N; i++) this.spins[i] = init === 'up' || this.rnd() < 0.5 ? 1 : -1
    this.recompute()
  }

  /** Overwrite the configuration (e.g. a known test pattern) and recompute observables. */
  setSpins(s: ArrayLike<number>): void {
    for (let i = 0; i < this.N; i++) this.spins[i] = s[i]! > 0 ? 1 : -1
    this.recompute()
  }

  get temperature(): number {
    return this.T
  }

  get field(): number {
    return this.h
  }

  setParams(T: number, h: number): void {
    this.T = T
    const hChanged = h !== this.h
    this.h = h
    for (let si = 0; si < 2; si++) {
      const s = si === 0 ? -1 : 1
      for (let k = 0; k < 5; k++) {
        const nb = 2 * k - 4
        const dE = 2 * s * (nb + h)
        this.accept[si * 5 + k] = dE <= 0 ? 1 : Math.exp(-dE / T)
      }
    }
    if (hChanged) this.recompute()
  }

  /** Recompute energy and magnetisation from scratch. */
  recompute(): void {
    const { spins, right, down, N } = this
    let bonds = 0
    let m = 0
    for (let i = 0; i < N; i++) {
      const s = spins[i]!
      bonds += s * (spins[right[i]!]! + spins[down[i]!]!)
      m += s
    }
    this.magnetization = m
    this.energy = -bonds - this.h * m
  }

  /** Energy change if spin i were flipped. */
  deltaE(i: number): number {
    const s = this.spins[i]!
    const nb = this.spins[this.left[i]!]! + this.spins[this.right[i]!]! + this.spins[this.up[i]!]! + this.spins[this.down[i]!]!
    return 2 * s * (nb + this.h)
  }

  /** One Metropolis sweep: N single-spin-flip attempts at random sites. */
  sweep(): void {
    const { spins, left, right, up, down, accept, rnd, N, h } = this
    let dEtot = 0
    let dM = 0
    for (let n = 0; n < N; n++) {
      const i = (rnd() * N) | 0
      const s = spins[i]!
      const nb = spins[left[i]!]! + spins[right[i]!]! + spins[up[i]!]! + spins[down[i]!]!
      const a = accept[(s > 0 ? 5 : 0) + ((nb + 4) >> 1)]!
      if (a >= 1 || rnd() < a) {
        spins[i] = -s as -1 | 1
        dEtot += 2 * s * (nb + h)
        dM -= 2 * s
      }
    }
    this.energy += dEtot
    this.magnetization += dM
    this.sweeps++
  }

  /** Energy per spin. */
  e(): number {
    return this.energy / this.N
  }

  /** Magnetisation per spin. */
  m(): number {
    return this.magnetization / this.N
  }
}

/** Complete elliptic integral of the first kind K(k) via the arithmetic-geometric mean. */
export function ellipticK(k: number): number {
  let a = 1
  let b = Math.sqrt(1 - k * k)
  for (let i = 0; i < 40 && Math.abs(a - b) > 1e-15; i++) {
    const an = (a + b) / 2
    b = Math.sqrt(a * b)
    a = an
  }
  return Math.PI / (2 * a)
}

/** Onsager/Yang spontaneous magnetisation per spin (h = 0, infinite lattice). */
export function onsagerMagnetization(T: number): number {
  if (T >= TC) return 0
  return (1 - Math.sinh(2 / T) ** -4) ** 0.125
}

/** Onsager internal energy per spin (h = 0, infinite lattice). */
export function onsagerEnergy(T: number): number {
  const b = 1 / T
  const k = (2 * Math.sinh(2 * b)) / Math.cosh(2 * b) ** 2
  const th = Math.tanh(2 * b)
  // The modulus reaches 1 exactly at Tc, where K diverges but its prefactor vanishes.
  const K = k >= 1 ? 0 : ellipticK(k)
  return (-1 / th) * (1 + (2 / Math.PI) * (2 * th * th - 1) * K)
}
