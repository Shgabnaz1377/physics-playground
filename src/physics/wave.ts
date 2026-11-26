/**
 * 2D scalar wave equation  u_tt + gamma(x) u_t = c^2 (u_xx + u_yy)
 * on a uniform grid with dx = dy = 1 and c = 1, so the time step equals the
 * Courant number C = c dt / dx.
 *
 * Time integration is the standard second-order leapfrog (central differences
 * in time and space). It is stable for C <= 1/sqrt(2) in 2D. The outer frame
 * is held at u = 0; a "sponge" layer with smoothly increasing damping in
 * front of it absorbs outgoing waves so the domain behaves as if it were open.
 */

export const CFL_LIMIT_2D = 1 / Math.SQRT2

export type WaveScene = 'double-slit' | 'single-slit' | 'two-sources'

export interface WaveGrid {
  readonly nx: number
  readonly ny: number
  /** Field at the current time level n. */
  u: Float64Array
  /** Field at the previous time level n-1. */
  prev: Float64Array
  /** 1 where the cell is a rigid barrier (u held at 0). */
  readonly wall: Uint8Array
  /** Per-cell damping, gamma * dt / 2 at the default Courant number. */
  readonly sponge: Float64Array
  /** Exponential moving average of u^2 (time-averaged intensity). */
  readonly intensity: Float64Array
  /** Elapsed simulation time (in units of dx / c). */
  t: number
}

export interface Source {
  kind: 'point' | 'line'
  /** Column of the source; for a line source this is the whole column. */
  x: number
  /** Row of a point source. */
  y: number
  /** Phase offset in radians. */
  phase: number
}

export interface WaveParams {
  courant: number
  /** Source wavelength in grid cells. */
  wavelength: number
  amplitude: number
  sources: readonly Source[]
}

export function createGrid(nx: number, ny: number, spongeWidth = 0, spongeStrength = 0.12): WaveGrid {
  const n = nx * ny
  const sponge = new Float64Array(n)
  if (spongeWidth > 0) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const d = Math.min(x, y, nx - 1 - x, ny - 1 - y)
        if (d < spongeWidth) {
          const s = (spongeWidth - d) / spongeWidth
          sponge[y * nx + x] = spongeStrength * s * s
        }
      }
    }
  }
  return {
    nx,
    ny,
    u: new Float64Array(n),
    prev: new Float64Array(n),
    wall: new Uint8Array(n),
    sponge,
    intensity: new Float64Array(n),
    t: 0,
  }
}

/** Fill a vertical barrier at column x, leaving the given [start, end) row gaps open. */
export function addBarrier(g: WaveGrid, x: number, thickness: number, gaps: ReadonlyArray<[number, number]>): void {
  for (let y = 0; y < g.ny; y++) {
    const open = gaps.some(([a, b]) => y >= a && y < b)
    if (open) continue
    for (let dx = 0; dx < thickness; dx++) {
      const xx = x + dx
      if (xx > 0 && xx < g.nx - 1) g.wall[y * g.nx + xx] = 1
    }
  }
}

/** Row ranges of the openings for a slit barrier centred on the grid. */
export function slitGaps(ny: number, count: 1 | 2, separation: number, width: number): Array<[number, number]> {
  const cy = ny / 2
  const centres = count === 1 ? [cy] : [cy - separation / 2, cy + separation / 2]
  return centres.map((c) => [Math.round(c - width / 2), Math.round(c + width / 2)])
}

/** Apply hard (driven) sources for time t. */
export function applySources(g: WaveGrid, p: WaveParams, t: number): void {
  const omega = (2 * Math.PI) / p.wavelength // c = 1
  for (const s of p.sources) {
    const v = p.amplitude * Math.sin(omega * t + s.phase)
    if (s.kind === 'point') {
      g.u[s.y * g.nx + s.x] = v
    } else {
      for (let y = 1; y < g.ny - 1; y++) {
        const i = y * g.nx + s.x
        if (!g.wall[i]) g.u[i] = v
      }
    }
  }
}

/**
 * Advance one leapfrog step:
 *   u^{n+1} = (2u^n - (1 - s) u^{n-1} + C^2 lap(u^n)) / (1 + s)
 * where s = gamma dt / 2 is the local sponge damping.
 */
export function step(g: WaveGrid, courant: number): void {
  const { nx, ny, u, prev, wall, sponge } = g
  const c2 = courant * courant
  // Write u^{n+1} into `prev` (u^{n-1} is not needed after this cell is read).
  for (let y = 1; y < ny - 1; y++) {
    const row = y * nx
    for (let x = 1; x < nx - 1; x++) {
      const i = row + x
      if (wall[i]) {
        prev[i] = 0
        continue
      }
      const ui = u[i]!
      const lap = u[i - 1]! + u[i + 1]! + u[i - nx]! + u[i + nx]! - 4 * ui
      const s = sponge[i]!
      prev[i] = (2 * ui - (1 - s) * prev[i]! + c2 * lap) / (1 + s)
    }
  }
  g.prev = u
  g.u = prev
  g.t += courant
}

/** Advance with sources and update the running intensity average. */
export function advance(g: WaveGrid, p: WaveParams, steps: number, intensityRate = 0.01): void {
  for (let k = 0; k < steps; k++) {
    step(g, p.courant)
    applySources(g, p, g.t)
  }
  const a = intensityRate
  const { u, intensity } = g
  for (let i = 0; i < u.length; i++) intensity[i] = intensity[i]! + a * (u[i]! * u[i]! - intensity[i]!)
}

/**
 * Discrete energy conserved exactly by undamped leapfrog with fixed
 * boundaries (up to rounding):
 *   E = 1/2 sum ((u^n - u^{n-1}) / dt)^2 + 1/2 sum grad(u^n) . grad(u^{n-1})
 * with forward differences for the gradient over all grid edges.
 */
export function energy(g: WaveGrid, courant: number): number {
  const { nx, ny, u, prev } = g
  const dt = courant
  let kin = 0
  let pot = 0
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const i = y * nx + x
      const v = (u[i]! - prev[i]!) / dt
      kin += v * v
      if (x + 1 < nx) pot += (u[i + 1]! - u[i]!) * (prev[i + 1]! - prev[i]!)
      if (y + 1 < ny) pot += (u[i + nx]! - u[i]!) * (prev[i + nx]! - prev[i]!)
    }
  }
  return 0.5 * kin + 0.5 * pot
}

export function maxAbs(a: Float64Array): number {
  let m = 0
  for (let i = 0; i < a.length; i++) {
    const v = Math.abs(a[i]!)
    if (v > m || Number.isNaN(v)) m = Number.isNaN(v) ? Infinity : v
  }
  return m
}

/**
 * Discrete angular frequency of the Dirichlet eigenmode sin(kx x) sin(ky y)
 * under leapfrog: sin^2(w dt / 2) = C^2 (sin^2(kx/2) + sin^2(ky/2)).
 */
export function discreteOmega(kx: number, ky: number, courant: number): number {
  const s = courant * Math.sqrt(Math.sin(kx / 2) ** 2 + Math.sin(ky / 2) ** 2)
  return (2 / courant) * Math.asin(Math.min(1, s))
}

/** Add a Gaussian bump (e.g. a "drop" from a click), keeping the bump at rest. */
export function addPulse(g: WaveGrid, cx: number, cy: number, radius: number, amp: number): void {
  const r = Math.ceil(radius * 3)
  for (let y = Math.max(1, cy - r); y < Math.min(g.ny - 1, cy + r); y++) {
    for (let x = Math.max(1, cx - r); x < Math.min(g.nx - 1, cx + r); x++) {
      const i = y * g.nx + x
      if (g.wall[i]) continue
      const d2 = ((x - cx) ** 2 + (y - cy) ** 2) / (radius * radius)
      const b = amp * Math.exp(-d2)
      g.u[i] = g.u[i]! + b
      g.prev[i] = g.prev[i]! + b
    }
  }
}

export interface SceneOptions {
  nx: number
  ny: number
  scene: WaveScene
  separation: number
  slitWidth: number
  spongeWidth: number
}

export interface Scene {
  grid: WaveGrid
  sources: Source[]
  /** Column of the barrier (slit scenes) or -1. */
  barrierX: number
  /** Column where the far-field "screen" is sampled. */
  screenX: number
}

/** Build one of the preset experiments. */
export function buildScene(o: SceneOptions): Scene {
  const g = createGrid(o.nx, o.ny, o.spongeWidth)
  const sources: Source[] = []
  let barrierX = -1
  if (o.scene === 'two-sources') {
    const x = Math.round(o.nx * 0.25)
    const cy = o.ny / 2
    sources.push(
      { kind: 'point', x, y: Math.round(cy - o.separation / 2), phase: 0 },
      { kind: 'point', x, y: Math.round(cy + o.separation / 2), phase: 0 },
    )
  } else {
    barrierX = Math.round(o.nx * 0.3)
    addBarrier(g, barrierX, 2, slitGaps(o.ny, o.scene === 'single-slit' ? 1 : 2, o.separation, o.slitWidth))
    sources.push({ kind: 'line', x: o.spongeWidth + 2, y: 0, phase: 0 })
  }
  return { grid: g, sources, barrierX, screenX: o.nx - o.spongeWidth - 2 }
}

/**
 * Fraunhofer (far-field) intensity for N = 1 or 2 slits of width a and centre
 * separation d, at angle theta, normalised to 1 at theta = 0.
 */
export function fraunhofer(theta: number, wavelength: number, slits: 1 | 2, a: number, d: number): number {
  const s = Math.sin(theta)
  const beta = (Math.PI * a * s) / wavelength
  const envelope = beta === 0 ? 1 : (Math.sin(beta) / beta) ** 2
  if (slits === 1) return envelope
  const alpha = (Math.PI * d * s) / wavelength
  return envelope * Math.cos(alpha) ** 2
}
