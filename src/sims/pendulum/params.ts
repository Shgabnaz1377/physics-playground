import { bool, num } from '@/lib/params'

export const pendulumSpecs = {
  theta1: num(120, -180, 180, 1),
  theta2: num(-10, -180, 180, 1),
  mass: num(1, 0.1, 5, 0.1),
  length: num(1, 0.3, 2, 0.05),
  g: num(9.81, 1, 25, 0.01),
  dt: num(0.002, 0.0005, 0.05, 0.0005),
  delta: num(-9, -12, -2, 1),
  speed: num(1, 0.1, 3, 0.1),
  trail: bool(true),
}
