import { describe, expect, it } from 'vitest'
import {
  bool,
  defaults,
  num,
  oneOf,
  parseParams,
  serializeParams,
  stepDecimals,
} from '@/lib/params'

const specs = {
  T: num(2.27, 0.5, 5, 0.01),
  size: num(128, 32, 256, 32),
  cold: bool(false),
  mode: oneOf(['slit', 'sources'] as const, 'slit'),
}

describe('params', () => {
  it('uses defaults for an empty query', () => {
    expect(defaults(specs)).toEqual({ T: 2.27, size: 128, cold: false, mode: 'slit' })
  })

  it('parses and clamps numbers', () => {
    const v = parseParams(specs, { T: '9', size: '-4' })
    expect(v.T).toBe(5)
    expect(v.size).toBe(32)
  })

  it('rejects garbage and unknown enum values', () => {
    const v = parseParams(specs, { T: 'abc', mode: 'laser', cold: 'maybe' })
    expect(v).toEqual(defaults(specs))
  })

  it('accepts array-valued query entries from the router', () => {
    expect(parseParams(specs, { T: ['3.5', '1'] }).T).toBe(3.5)
  })

  it('serialises only non-default values and round-trips', () => {
    const values = { T: 1.5, size: 128, cold: true, mode: 'sources' as const }
    const q = serializeParams(specs, values)
    expect(q).toEqual({ T: '1.5', cold: '1', mode: 'sources' })
    expect(parseParams(specs, q)).toEqual(values)
  })

  it('rounds to the step precision', () => {
    expect(serializeParams(specs, { ...defaults(specs), T: 1.23456 })).toEqual({ T: '1.23' })
  })

  it('computes decimals from a step', () => {
    expect(stepDecimals(1)).toBe(0)
    expect(stepDecimals(0.05)).toBe(2)
    expect(stepDecimals(1e-7)).toBe(7)
  })

  it('refuses inconsistent specs', () => {
    expect(() => num(10, 0, 5)).toThrow(RangeError)
    expect(() => oneOf(['a', 'b'], 'c' as 'a')).toThrow(RangeError)
  })
})
