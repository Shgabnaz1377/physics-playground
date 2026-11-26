/**
 * 2D heat equation  u_t = alpha (u_xx + u_yy)  with explicit (FTCS) time
 * stepping on a uniform grid, written in conservative flux form:
 *
 *   u_i^{n+1} = u_i^n + r * sum_{j in nbrs(i)} (u_j^n - u_i^n),   r = alpha dt / dx^2
 *
 * Only pairs of neighbouring, non-wall cells exchange heat, so the outer
 * boundary and internal walls are perfectly insulating (zero normal flux) and
 * the heat exchanged between two cells is equal and opposite. With no fixed-
 * temperature cells the total heat is therefore conserved to rounding error.
 * The scheme is stable (and obeys a discrete maximum principle) for r <= 1/4.
 */

export const STABILITY_LIMIT = 0.25

export const Cell = {
  Conductor: 0,
  Wall: 1,
  Hot: 2,
  Cold: 3,
} as const
export type Cell = (typeof Cell)[keyof typeof Cell]

export interface HeatGrid {
  readonly nx: number
  readonly ny: number
  u: Float64Array
  next: Float64Array
  readonly kind: Uint8Array
  /** Temperature imposed on Hot cells. */
  hot: number
  /** Temperature imposed on Cold cells. */
  cold: number
  steps: number
}

export function createHeatGrid(nx: number, ny: number, initial = 0): HeatGrid {
  const n = nx * ny
  const u = new Float64Array(n).fill(initial)
  return { nx, ny, u, next: new Float64Array(n), kind: new Uint8Array(n), hot: 1, cold: 0, steps: 0 }
}

export function setCell(g: HeatGrid, x: number, y: number, kind: Cell): void {
  if (x < 0 || y < 0 || x >= g.nx || y >= g.ny) return
  const i = y * g.nx + x
  g.kind[i] = kind
  if (kind === Cell.Hot) g.u[i] = g.hot
  else if (kind === Cell.Cold) g.u[i] = g.cold
  else if (kind === Cell.Wall) g.u[i] = 0
}

/** Apply fn to every cell within a disc. */
export function paintDisc(g: HeatGrid, cx: number, cy: number, radius: number, fn: (i: number, x: number, y: number) => void): void {
  const r = Math.max(0, radius)
  const r2 = r * r + 0.25
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(g.ny - 1, Math.ceil(cy + r)); y++) {
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(g.nx - 1, Math.ceil(cx + r)); x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) fn(y * g.nx + x, x, y)
    }
  }
}

/** One explicit step. Throws if r would make the scheme unstable. */
export function stepHeat(g: HeatGrid, r: number): void {
  if (!(r >= 0 && r <= STABILITY_LIMIT)) {
    throw new RangeError(`r = ${r} outside the stable range [0, ${STABILITY_LIMIT}]`)
  }
  stepHeatUnchecked(g, r)
}

/** One explicit step without the stability guard (used to demonstrate instability in tests). */
export function stepHeatUnchecked(g: HeatGrid, r: number): void {
  const { nx, ny, u, next, kind } = g
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const i = y * nx + x
      const k = kind[i]!
      if (k !== Cell.Conductor) {
        next[i] = u[i]!
        continue
      }
      const ui = u[i]!
      let flux = 0
      if (x > 0 && kind[i - 1] !== Cell.Wall) flux += u[i - 1]! - ui
      if (x < nx - 1 && kind[i + 1] !== Cell.Wall) flux += u[i + 1]! - ui
      if (y > 0 && kind[i - nx] !== Cell.Wall) flux += u[i - nx]! - ui
      if (y < ny - 1 && kind[i + nx] !== Cell.Wall) flux += u[i + nx]! - ui
      next[i] = ui + r * flux
    }
  }
  g.next = u
  g.u = next
  g.steps++
}

/** Total heat (sum of u) over conducting cells. */
export function totalHeat(g: HeatGrid): number {
  let s = 0
  for (let i = 0; i < g.u.length; i++) if (g.kind[i] === Cell.Conductor) s += g.u[i]!
  return s
}

export function conductorCount(g: HeatGrid): number {
  let n = 0
  for (let i = 0; i < g.kind.length; i++) if (g.kind[i] === Cell.Conductor) n++
  return n
}

export function range(g: HeatGrid): [number, number] {
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < g.u.length; i++) {
    if (g.kind[i] === Cell.Wall) continue
    const v = g.u[i]!
    if (v < lo) lo = v
    if (v > hi) hi = v
  }
  return [lo, hi]
}

export type HeatPreset = 'blob' | 'radiator' | 'maze' | 'bar'

/** Build one of the starting scenes. */
export function buildPreset(nx: number, ny: number, preset: HeatPreset): HeatGrid {
  const g = createHeatGrid(nx, ny, 0)
  if (preset === 'blob') {
    paintDisc(g, nx * 0.3, ny * 0.45, ny * 0.16, (i) => (g.u[i] = 1))
    paintDisc(g, nx * 0.7, ny * 0.6, ny * 0.1, (i) => (g.u[i] = 1))
    for (let y = Math.round(ny * 0.2); y < Math.round(ny * 0.8); y++) setCell(g, Math.round(nx * 0.5), y, Cell.Wall)
  } else if (preset === 'radiator') {
    // A room with a window (cold) on the right, a radiator (hot) on the left and a partial wall.
    for (let y = Math.round(ny * 0.3); y < Math.round(ny * 0.7); y++) {
      setCell(g, 3, y, Cell.Hot)
      setCell(g, 4, y, Cell.Hot)
    }
    for (let y = Math.round(ny * 0.15); y < Math.round(ny * 0.85); y++) setCell(g, nx - 1, y, Cell.Cold)
    for (let y = 0; y < Math.round(ny * 0.55); y++) setCell(g, Math.round(nx * 0.55), y, Cell.Wall)
    g.u.forEach((_, i) => {
      if (g.kind[i] === Cell.Conductor) g.u[i] = 0.3
    })
  } else if (preset === 'maze') {
    const step = Math.round(ny / 6)
    for (let k = 1; k < 6; k++) {
      const x = Math.round((k * nx) / 6)
      const gapTop = k % 2 === 1
      for (let y = 0; y < ny; y++) {
        const inGap = gapTop ? y < step : y >= ny - step
        if (!inGap) setCell(g, x, y, Cell.Wall)
      }
    }
    for (let y = 0; y < ny; y++) setCell(g, 0, y, Cell.Hot)
  } else {
    // A bar between a hot and a cold reservoir: steady state is a linear profile.
    for (let y = 0; y < ny; y++) {
      setCell(g, 0, y, Cell.Hot)
      setCell(g, nx - 1, y, Cell.Cold)
    }
  }
  return g
}
