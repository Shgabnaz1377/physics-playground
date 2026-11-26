import { num, oneOf } from '@/lib/params'

export const heatSpecs = {
  preset: oneOf(['radiator', 'blob', 'maze', 'bar'] as const, 'radiator'),
  r: num(0.24, 0.02, 0.25, 0.01),
  speed: num(10, 1, 60, 1),
  tool: oneOf(['wall', 'hot', 'cold', 'heat', 'erase'] as const, 'wall'),
  brush: num(2, 0, 8, 1),
}
