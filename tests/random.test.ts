import { describe, expect, it } from 'vitest'
import { gaussian, mulberry32 } from '@/lib/random'

describe('random', () => {
  it('is deterministic for a seed and uniform on [0, 1)', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    let sum = 0
    for (let i = 0; i < 20000; i++) {
      const x = a()
      expect(x).toBe(b())
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
      sum += x
    }
    expect(sum / 20000).toBeCloseTo(0.5, 2)
  })

  it('produces standard normal deviates', () => {
    const rnd = mulberry32(7)
    const n = 50000
    let m = 0
    let m2 = 0
    for (let i = 0; i < n; i++) {
      const z = gaussian(rnd)
      m += z
      m2 += z * z
    }
    expect(m / n).toBeCloseTo(0, 1)
    expect(m2 / n).toBeCloseTo(1, 1)
  })
})
