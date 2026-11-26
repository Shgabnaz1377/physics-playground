import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONFIG,
  OPTIMIZERS,
  SURFACES,
  adam,
  configFor,
  momentum,
  rmsprop,
  sgd,
  type OptimizerId,
  type SurfaceId,
  type Vec2,
} from '@/physics/optim'

const cfg = (over: Partial<typeof DEFAULT_CONFIG>) => ({ ...DEFAULT_CONFIG, ...over })

describe('loss surfaces', () => {
  const ids = Object.keys(SURFACES) as SurfaceId[]

  it('have analytic gradients that match finite differences', () => {
    const pts: Vec2[] = [
      [0.3, -0.7],
      [-1.2, 1.9],
      [1.7, 0.4],
      [-0.05, 2.2],
    ]
    for (const id of ids) {
      const s = SURFACES[id]
      for (const [x, y] of pts) {
        const h = 1e-6
        const gx = (s.f(x + h, y) - s.f(x - h, y)) / (2 * h)
        const gy = (s.f(x, y + h) - s.f(x, y - h)) / (2 * h)
        const [ax, ay] = s.grad(x, y)
        expect(ax).toBeCloseTo(gx, 3)
        expect(ay).toBeCloseTo(gy, 3)
      }
    }
  })

  it('reach fmin with zero gradient at every listed minimum', () => {
    for (const id of ids) {
      const s = SURFACES[id]
      for (const [x, y] of s.minima) {
        expect(s.f(x, y)).toBeCloseTo(s.fmin, 8)
        const [gx, gy] = s.grad(x, y)
        expect(Math.hypot(gx, gy)).toBeLessThan(1e-4)
      }
    }
  })
})

describe('optimizer update rules', () => {
  it('SGD contracts a quadratic by exactly (1 - lr a) per step', () => {
    const a = 3
    const lr = 0.1
    const x: Vec2 = [2, 0]
    const opt = sgd()
    for (let k = 0; k < 10; k++) opt.step(x, [a * x[0], 0], cfg({ lr }))
    expect(x[0]).toBeCloseTo(2 * (1 - lr * a) ** 10, 14)
  })

  it('momentum follows v = beta v + g, x = x - lr v', () => {
    const opt = momentum()
    const c = cfg({ lr: 0.1, beta1: 0.9 })
    const x: Vec2 = [1, -2]
    opt.step(x, [2, 4], c)
    expect(x).toEqual([1 - 0.1 * 2, -2 - 0.1 * 4])
    opt.step(x, [1, -1], c)
    // v2 = 0.9 * (2, 4) + (1, -1) = (2.8, 2.6)
    expect(x[0]).toBeCloseTo(0.8 - 0.28, 14)
    expect(x[1]).toBeCloseTo(-2.4 - 0.26, 14)
  })

  it('Adam takes a first step of size lr in the direction of -sign(g)', () => {
    const opt = adam()
    const c = cfg({ lr: 0.05 })
    const x: Vec2 = [0, 0]
    opt.step(x, [1e-3, -250], c)
    expect(x[0]).toBeCloseTo(-0.05, 6)
    expect(x[1]).toBeCloseTo(0.05, 9)
  })

  it('Adam applies bias correction on the second step', () => {
    const opt = adam()
    const c = cfg({ lr: 0.1, beta1: 0.9, beta2: 0.999, eps: 0 })
    const x: Vec2 = [0, 0]
    opt.step(x, [1, 0], c)
    opt.step(x, [3, 0], c)
    const m = 0.9 * 0.1 * 1 + 0.1 * 3
    const v = 0.999 * 0.001 * 1 + 0.001 * 9
    const mHat = m / (1 - 0.9 ** 2)
    const vHat = v / (1 - 0.999 ** 2)
    expect(x[0]).toBeCloseTo(-0.1 - (0.1 * mHat) / Math.sqrt(vHat), 12)
  })

  it('RMSProp scales the first step by 1 / sqrt(1 - rho)', () => {
    const opt = rmsprop()
    const c = cfg({ lr: 0.01, beta2: 0.9, eps: 0 })
    const x: Vec2 = [0, 0]
    opt.step(x, [5, -0.2], c)
    expect(x[0]).toBeCloseTo(-0.01 / Math.sqrt(0.1), 12)
    expect(x[1]).toBeCloseTo(0.01 / Math.sqrt(0.1), 12)
  })

  it('reset clears optimizer state', () => {
    const opt = adam()
    const x: Vec2 = [0, 0]
    opt.step(x, [1, 1], cfg({ lr: 0.1 }))
    opt.reset()
    const y: Vec2 = [0, 0]
    opt.step(y, [1, 1], cfg({ lr: 0.1 }))
    expect(y[0]).toBeCloseTo(-0.1, 6)
  })
})

describe('optimizers on the test surfaces', () => {
  const run = (id: OptimizerId, sid: SurfaceId, steps: number, start?: Vec2) => {
    const s = SURFACES[sid]
    const opt = OPTIMIZERS[id]()
    const c = configFor(id, s, 1, 0.9)
    const x: Vec2 = start ? [...start] : [...s.start]
    for (let k = 0; k < steps; k++) opt.step(x, s.grad(x[0], x[1]), c)
    return { x, loss: s.f(x[0], x[1]) - s.fmin }
  }

  it('all converge on the ill-conditioned bowl', () => {
    for (const id of ['sgd', 'momentum', 'adam'] as const) {
      expect(run(id, 'bowl', 3000).loss).toBeLessThan(1e-6)
    }
    // RMSProp without decay keeps taking steps of about lr, so it settles within a few lr of the minimum.
    const { x } = run('rmsprop', 'bowl', 3000)
    const lr = configFor('rmsprop', SURFACES.bowl, 1, 0.9).lr
    expect(Math.hypot(x[0], x[1])).toBeLessThan(3 * lr)
  })

  it('momentum beats plain SGD along the Rosenbrock valley', () => {
    const plain = run('sgd', 'rosenbrock', 2000).loss
    const heavy = run('momentum', 'rosenbrock', 2000).loss
    expect(heavy).toBeLessThan(plain)
  })

  it('lands in one of the four Himmelblau minima', () => {
    for (const id of ['sgd', 'momentum', 'adam'] as const) {
      const { x } = run(id, 'himmelblau', 4000)
      const d = Math.min(...SURFACES.himmelblau.minima.map(([a, b]) => Math.hypot(x[0] - a, x[1] - b)))
      expect(d).toBeLessThan(0.05)
    }
  })

  it('escapes the saddle point when started next to it', () => {
    const { x } = run('momentum', 'saddle', 3000)
    expect(Math.abs(Math.abs(x[1]) - Math.SQRT2)).toBeLessThan(0.05)
  })
})
