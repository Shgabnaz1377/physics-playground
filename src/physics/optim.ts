/**
 * Two-dimensional loss surfaces and first-order optimisers, kept free of any
 * UI code so the update rules can be unit-tested against hand-computed steps.
 */

export type Vec2 = [number, number]

export interface Surface {
  id: SurfaceId
  name: string
  f: (x: number, y: number) => number
  grad: (x: number, y: number) => Vec2
  /** View window [xmin, xmax, ymin, ymax]. */
  domain: [number, number, number, number]
  minima: Vec2[]
  /** Global minimum value. */
  fmin: number
  start: Vec2
  /** A learning rate that works for SGD on this surface. */
  lr: number
}

export type SurfaceId = 'bowl' | 'rosenbrock' | 'himmelblau' | 'saddle' | 'rastrigin'

const KAPPA = 20

export const SURFACES: Record<SurfaceId, Surface> = {
  bowl: {
    id: 'bowl',
    name: 'Ill-conditioned bowl',
    // A quadratic with condition number 20, rotated by 30 degrees.
    f: (x, y) => {
      const [u, v] = rotate(x, y)
      return 0.5 * (u * u + KAPPA * v * v)
    },
    grad: (x, y) => {
      const [u, v] = rotate(x, y)
      // Gradient in rotated coordinates, rotated back.
      return unrotate(u, KAPPA * v)
    },
    domain: [-3, 3, -3, 3],
    minima: [[0, 0]],
    fmin: 0,
    start: [-2.6, 1.6],
    lr: 0.04,
  },
  rosenbrock: {
    id: 'rosenbrock',
    name: 'Rosenbrock valley',
    f: (x, y) => (1 - x) ** 2 + 100 * (y - x * x) ** 2,
    grad: (x, y) => [-2 * (1 - x) - 400 * x * (y - x * x), 200 * (y - x * x)],
    domain: [-2, 2, -1, 3],
    minima: [[1, 1]],
    fmin: 0,
    start: [-1.5, 2.2],
    lr: 0.0008,
  },
  himmelblau: {
    id: 'himmelblau',
    name: 'Himmelblau (four minima)',
    f: (x, y) => (x * x + y - 11) ** 2 + (x + y * y - 7) ** 2,
    grad: (x, y) => {
      const a = x * x + y - 11
      const b = x + y * y - 7
      return [4 * x * a + 2 * b, 2 * a + 4 * y * b]
    },
    domain: [-5, 5, -5, 5],
    minima: [
      [3, 2],
      [-2.805118, 3.131312],
      [-3.77931, -3.283186],
      [3.584428, -1.848126],
    ],
    fmin: 0,
    start: [-0.3, -0.9],
    lr: 0.005,
  },
  saddle: {
    id: 'saddle',
    name: 'Saddle with two wells',
    // f = x^2 - y^2 + y^4 / 4: saddle at the origin, minima at (0, +/- sqrt 2).
    f: (x, y) => x * x - y * y + 0.25 * y ** 4 + 1,
    grad: (x, y) => [2 * x, -2 * y + y ** 3],
    domain: [-2.5, 2.5, -2.5, 2.5],
    minima: [
      [0, Math.SQRT2],
      [0, -Math.SQRT2],
    ],
    fmin: 0,
    start: [-2.2, 0.002],
    lr: 0.02,
  },
  rastrigin: {
    id: 'rastrigin',
    name: 'Rastrigin (many local minima)',
    f: (x, y) => 20 + x * x - 10 * Math.cos(2 * Math.PI * x) + y * y - 10 * Math.cos(2 * Math.PI * y),
    grad: (x, y) => [
      2 * x + 20 * Math.PI * Math.sin(2 * Math.PI * x),
      2 * y + 20 * Math.PI * Math.sin(2 * Math.PI * y),
    ],
    domain: [-5.12, 5.12, -5.12, 5.12],
    minima: [[0, 0]],
    fmin: 0,
    start: [-4.4, 3.6],
    lr: 0.002,
  },
}

const C30 = Math.cos(Math.PI / 6)
const S30 = Math.sin(Math.PI / 6)

function rotate(x: number, y: number): Vec2 {
  return [C30 * x + S30 * y, -S30 * x + C30 * y]
}

function unrotate(u: number, v: number): Vec2 {
  return [C30 * u - S30 * v, S30 * u + C30 * v]
}

export interface OptimizerConfig {
  lr: number
  /** Momentum coefficient (heavy ball) and Adam's beta1. */
  beta1: number
  /** RMSProp decay and Adam's beta2. */
  beta2: number
  eps: number
}

export const DEFAULT_CONFIG: OptimizerConfig = { lr: 0.01, beta1: 0.9, beta2: 0.999, eps: 1e-8 }

export type OptimizerId = 'sgd' | 'momentum' | 'rmsprop' | 'adam'

export interface Optimizer {
  readonly id: OptimizerId
  /** Update x in place given the gradient g at x. */
  step(x: Vec2, g: Vec2, cfg: OptimizerConfig): void
  reset(): void
}

/** Plain gradient descent: x <- x - lr g. */
export function sgd(): Optimizer {
  return {
    id: 'sgd',
    step(x, g, c) {
      x[0] -= c.lr * g[0]
      x[1] -= c.lr * g[1]
    },
    reset() {},
  }
}

/** Heavy-ball momentum (PyTorch convention): v <- beta v + g, x <- x - lr v. */
export function momentum(): Optimizer {
  const v: Vec2 = [0, 0]
  return {
    id: 'momentum',
    step(x, g, c) {
      v[0] = c.beta1 * v[0] + g[0]
      v[1] = c.beta1 * v[1] + g[1]
      x[0] -= c.lr * v[0]
      x[1] -= c.lr * v[1]
    },
    reset() {
      v[0] = 0
      v[1] = 0
    },
  }
}

/** RMSProp: s <- rho s + (1 - rho) g^2, x <- x - lr g / (sqrt(s) + eps), with rho = beta2. */
export function rmsprop(): Optimizer {
  const s: Vec2 = [0, 0]
  return {
    id: 'rmsprop',
    step(x, g, c) {
      for (let k = 0; k < 2; k++) {
        s[k] = c.beta2 * s[k]! + (1 - c.beta2) * g[k]! * g[k]!
        x[k] = x[k]! - (c.lr * g[k]!) / (Math.sqrt(s[k]!) + c.eps)
      }
    },
    reset() {
      s[0] = 0
      s[1] = 0
    },
  }
}

/** Adam with bias correction (Kingma & Ba, 2015). */
export function adam(): Optimizer {
  const m: Vec2 = [0, 0]
  const v: Vec2 = [0, 0]
  let t = 0
  return {
    id: 'adam',
    step(x, g, c) {
      t++
      const b1t = 1 - c.beta1 ** t
      const b2t = 1 - c.beta2 ** t
      for (let k = 0; k < 2; k++) {
        m[k] = c.beta1 * m[k]! + (1 - c.beta1) * g[k]!
        v[k] = c.beta2 * v[k]! + (1 - c.beta2) * g[k]! * g[k]!
        const mHat = m[k]! / b1t
        const vHat = v[k]! / b2t
        x[k] = x[k]! - (c.lr * mHat) / (Math.sqrt(vHat) + c.eps)
      }
    },
    reset() {
      m[0] = m[1] = v[0] = v[1] = 0
      t = 0
    },
  }
}

export const OPTIMIZERS: Record<OptimizerId, () => Optimizer> = { sgd, momentum, rmsprop, adam }

/**
 * Hyper-parameters per optimiser for a surface. Adaptive methods normalise the
 * step, so they need a learning rate on the scale of the domain rather than of
 * 1 / curvature; RMSProp uses the conventional rho = 0.9.
 */
export function configFor(id: OptimizerId, s: Surface, lrScale: number, beta: number): OptimizerConfig {
  const span = s.domain[1] - s.domain[0]
  switch (id) {
    case 'sgd':
      return { ...DEFAULT_CONFIG, lr: s.lr * lrScale }
    case 'momentum':
      return { ...DEFAULT_CONFIG, lr: s.lr * lrScale, beta1: beta }
    case 'rmsprop':
      return { ...DEFAULT_CONFIG, lr: 0.0015 * span * lrScale, beta2: 0.9 }
    case 'adam':
      return { ...DEFAULT_CONFIG, lr: 0.008 * span * lrScale, beta1: beta }
  }
}

/** Gradient with optional isotropic Gaussian noise, imitating minibatch SGD. */
export function noisyGrad(s: Surface, x: Vec2, sigma: number, normal: () => number): Vec2 {
  const g = s.grad(x[0], x[1])
  if (sigma > 0) {
    g[0] += sigma * normal()
    g[1] += sigma * normal()
  }
  return g
}
