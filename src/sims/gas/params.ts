import { bool, num } from '@/lib/params'

export const gasSpecs = {
  N: num(400, 50, 1000, 50),
  density: num(0.35, 0.05, 0.8, 0.01),
  T: num(1, 0.1, 4, 0.05),
  thermostat: bool(false),
  dt: num(0.004, 0.001, 0.01, 0.001),
  speed: num(4, 1, 20, 1),
}
