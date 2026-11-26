import { num, oneOf } from '@/lib/params'

export const isingSpecs = {
  T: num(2.27, 0.5, 5, 0.01),
  h: num(0, -1, 1, 0.01),
  speed: num(2, 1, 20, 1),
  size: oneOf(['64', '128', '256'] as const, '128'),
  start: oneOf(['random', 'up'] as const, 'random'),
}
