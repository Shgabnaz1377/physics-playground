import { gaussian, mulberry32 } from '@/lib/random'
import {
  OPTIMIZERS,
  configFor,
  noisyGrad,
  type Optimizer,
  type OptimizerId,
  type Surface,
  type Vec2,
} from '@/physics/optim'

export const ORDER: OptimizerId[] = ['sgd', 'momentum', 'rmsprop', 'adam']

export const LABELS: Record<OptimizerId, string> = {
  sgd: 'SGD',
  momentum: 'Momentum',
  rmsprop: 'RMSProp',
  adam: 'Adam',
}

/** One optimiser's run: its state, path through parameter space and loss history. */
export interface Runner {
  id: OptimizerId
  opt: Optimizer
  x: Vec2
  path: number[]
  loss: number[]
  diverged: boolean
  normal: () => number
}

export function makeRunners(s: Surface, start: Vec2, seed = 1): Runner[] {
  return ORDER.map((id, k) => {
    const rnd = mulberry32(seed * 31 + k)
    return {
      id,
      opt: OPTIMIZERS[id](),
      x: [start[0], start[1]],
      path: [start[0], start[1]],
      loss: [s.f(start[0], start[1]) - s.fmin],
      diverged: false,
      normal: () => gaussian(rnd),
    }
  })
}

/** Advance every active runner by one step. */
export function stepRunners(
  runners: Runner[],
  s: Surface,
  lrScale: number,
  beta: number,
  noise: number,
  active: (id: OptimizerId) => boolean,
): void {
  const span = s.domain[1] - s.domain[0]
  // Noise is expressed so that "1" moves plain SGD by about 2% of the view per step.
  const sigma = (noise * 0.02 * span) / s.lr
  for (const r of runners) {
    if (r.diverged || !active(r.id)) continue
    const g = noisyGrad(s, r.x, sigma, r.normal)
    r.opt.step(r.x, g, configFor(r.id, s, lrScale, beta))
    const f = s.f(r.x[0], r.x[1])
    if (!Number.isFinite(f) || Math.abs(r.x[0]) > 1e6 || Math.abs(r.x[1]) > 1e6) {
      r.diverged = true
      continue
    }
    r.path.push(r.x[0], r.x[1])
    r.loss.push(f - s.fmin)
  }
}
