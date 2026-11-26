import { num, oneOf } from '@/lib/params'

export const waveSpecs = {
  scene: oneOf(['double-slit', 'single-slit', 'two-sources'] as const, 'double-slit'),
  view: oneOf(['field', 'intensity'] as const, 'field'),
  wavelength: num(14, 6, 40, 1),
  separation: num(48, 10, 120, 2),
  slit: num(6, 2, 24, 1),
  courant: num(0.5, 0.1, 0.7, 0.05),
  speed: num(3, 1, 8, 1),
}
