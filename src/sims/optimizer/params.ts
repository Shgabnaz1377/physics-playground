import { bool, num, oneOf } from '@/lib/params'

export const optimizerSpecs = {
  surface: oneOf(['rosenbrock', 'bowl', 'himmelblau', 'saddle', 'rastrigin'] as const, 'rosenbrock'),
  /** log10 multiplier on each optimiser's tuned learning rate. */
  lr: num(0, -1.5, 1, 0.05),
  beta: num(0.9, 0, 0.99, 0.01),
  noise: num(0, 0, 3, 0.05),
  speed: num(4, 1, 40, 1),
  /** Start point in normalised view coordinates; -1 means the surface's default start. */
  sx: num(-1, -1, 1, 0.001),
  sy: num(-1, -1, 1, 0.001),
  sgd: bool(true),
  momentum: bool(true),
  rmsprop: bool(true),
  adam: bool(true),
}
