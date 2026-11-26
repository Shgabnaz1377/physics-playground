import { bool, num, oneOf } from '@/lib/params'

export const fourierSpecs = {
  shape: oneOf(['heart', 'star', 'square', 'trefoil'] as const, 'heart'),
  terms: num(24, 1, 256, 1),
  speed: num(0.15, 0.02, 1, 0.01),
  circles: bool(true),
  target: bool(true),
}
